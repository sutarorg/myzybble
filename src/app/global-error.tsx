"use client";

/** Last-resort boundary for failures in the root layout itself. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f3ec",
          color: "#0b100e",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.45 }}>
            zybble
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.65 }}>
            {error.digest ? `Reference: ${error.digest}` : "Please reload the page."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#0b100e",
              color: "#f5f3ec",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
