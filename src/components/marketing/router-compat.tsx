"use client";

/**
 * Compatibility shim used so the original landing-page components could be
 * moved to the Next.js App Router without redesigning or rewriting them.
 *
 * `next/link` is the real navigation primitive; `NavLink` additionally resolves
 * the active state from the current pathname so the marketing navigation keeps
 * its existing active-state styling and aria-current behaviour.
 */

import Link from "@/components/marketing/LinkCompat";
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

type NavLinkRenderProps = { isActive: boolean; isPending: boolean; isTransitioning: boolean };

export function NavLink({
  to,
  href,
  className,
  children,
  end = false,
  ...rest
}: {
  to?: string;
  href?: string;
  className?: string | ((props: NavLinkRenderProps) => string);
  children?: ReactNode;
  end?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const pathname = usePathname() ?? "/";
  const target = (to ?? href ?? "/").split("?")[0].split("#")[0];
  const normalized = target.length > 1 ? target.replace(/\/+$/, "") : target;
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isActive = end ? current === normalized : current === normalized || current.startsWith(`${normalized}/`);

  return (
    <Link
      href={to ?? href ?? "/"}
      aria-current={isActive ? "page" : undefined}
      className={typeof className === "function" ? className({ isActive, isPending: false, isTransitioning: false }) : className}
      {...rest}
    >
      {children}
    </Link>
  );
}

export { Link };
