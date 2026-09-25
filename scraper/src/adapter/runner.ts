/**
 * Runs the pinned upstream engine as a child process and streams its results.
 *
 * Design notes:
 *  - The engine writes to a results file; we tail that file incrementally so
 *    leads reach Supabase while the scrape is still running (§5 "process results
 *    incrementally").
 *  - The child is killed on cancel/timeout/shutdown, and partial results are
 *    still persisted — an interrupted run is recoverable, not lost (§31).
 *  - No unauthenticated scraping endpoint is exposed: the worker pulls jobs from
 *    Postgres over its own service-role connection.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildArgs, buildQueries, UPSTREAM, type ScrapeRequest, type UpstreamPlace } from "./upstream";
import { parseIncremental } from "../parsers/results";
import { config } from "../config";

export interface RunnerEvents {
  onRecord(record: UpstreamPlace): Promise<void> | void;
  onLog(line: string): void;
  shouldStop(): boolean;
}

export interface RunOutcome {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  recordsSeen: number;
  error?: string;
}

const TAIL_POLL_MS = 400;

export class ScrapeRunner {
  private child: ChildProcess | null = null;
  private offset = 0;
  private killed = false;

  constructor(
    private readonly jobId: string,
    private readonly workDir: string,
  ) {}

  async prepare(): Promise<{ inputPath: string; resultsPath: string }> {
    await mkdir(this.workDir, { recursive: true });
    return {
      inputPath: join(this.workDir, `queries-${this.jobId}.txt`),
      resultsPath: join(this.workDir, `results-${this.jobId}.json`),
    };
  }

  async run(request: ScrapeRequest, events: RunnerEvents): Promise<RunOutcome> {
    const { inputPath, resultsPath } = await this.prepare();

    const queries = buildQueries(request.queries, [], request.limit);
    await writeFile(inputPath, queries.join("\n"), "utf8");
    // Truncate any stale file from a previous attempt for the same job.
    await writeFile(resultsPath, "", "utf8");

    const args = buildArgs(request, inputPath, resultsPath);
    events.onLog(`exec: ${config.scraperBin} ${args.join(" ")}`);

    const startedAt = Date.now();
    let recordsSeen = 0;
    let timedOut = false;
    let cancelled = false;
    let error: string | undefined;

    this.child = spawn(config.scraperBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/ms-playwright" },
    });

    this.child.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) events.onLog(`out: ${line.trim()}`);
      }
    });
    this.child.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) events.onLog(`err: ${line.trim()}`);
      }
    });

    const tailTimer = setInterval(() => {
      void this.tail(resultsPath, (record) => {
        recordsSeen += 1;
        void events.onRecord(record);
      });
    }, TAIL_POLL_MS);

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      events.onLog(`job exceeded max runtime (${config.maxJobRuntimeMs}ms); terminating engine`);
      this.stop("SIGTERM");
    }, config.maxJobRuntimeMs);

    const controlTimer = setInterval(() => {
      if (events.shouldStop()) {
        cancelled = true;
        events.onLog("stop requested; terminating engine");
        this.stop("SIGTERM");
      }
    }, 1_000);

    try {
      const { code, signal } = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        this.child!.on("close", (code, signal) => resolve({ code, signal }));
        this.child!.on("error", (err) => {
          error = err.message;
          resolve({ code: -1, signal: null });
        });
      });

      // Drain anything written between the last poll and exit.
      await this.tail(resultsPath, (record) => {
        recordsSeen += 1;
        void events.onRecord(record);
      });

      return {
        exitCode: code,
        signal,
        timedOut,
        cancelled,
        recordsSeen,
        error: error ?? (code && code !== 0 ? `engine exited with code ${code}` : undefined),
        ...(startedAt ? {} : {}),
      };
    } finally {
      clearInterval(tailTimer);
      clearInterval(controlTimer);
      clearTimeout(timeoutTimer);
      this.child = null;
    }
  }

  /** Reads only the bytes appended since the previous poll. */
  private async tail(path: string, onRecord: (record: UpstreamPlace) => void): Promise<void> {
    try {
      if (!existsSync(path)) return;
      const info = await stat(path);
      if (info.size <= this.offset) return;

      const length = info.size - this.offset;
      const chunk = await readRange(path, this.offset, length);
      this.offset = info.size;

      const { records, buffer } = parseIncremental(chunk, this.buffer);
      // Rewind by any incomplete trailing line so it is re-read next poll.
      this.offset -= Buffer.byteLength(buffer, "utf8");
      this.buffer = buffer;

      for (const record of records) onRecord(record);
    } catch {
      // A transient read error must not abort the job; the next poll retries.
    }
  }

  private buffer = "";

  stop(signal: NodeJS.Signals = "SIGTERM") {
    if (this.killed || !this.child) return;
    this.killed = true;
    try {
      this.child.kill(signal);
    } catch {
      /* already gone */
    }
    // Escalate if the browser ignores SIGTERM.
    setTimeout(() => {
      try {
        this.child?.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }, 10_000).unref();
  }

  async cleanup(paths: string[]): Promise<void> {
    for (const p of paths) {
      try {
        await rm(p, { force: true });
      } catch {
        /* best effort */
      }
    }
  }
}

function readRange(path: string, start: number, length: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path, { start, end: start + length - 1 })
      .on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      .on("error", reject);
  });
}

export { UPSTREAM };
