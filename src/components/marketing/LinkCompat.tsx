"use client";

/**
 * Drop-in replacement for react-router's `Link` used by the original
 * landing-page components.
 *
 * It keeps the `to` prop API the existing markup was written against, so the
 * components could be moved to the Next.js App Router verbatim — preserving the
 * landing page's markup, styling and behaviour instead of rewriting it.
 */

import NextLink from "next/link";
import type { ComponentProps, ReactNode } from "react";

type LinkCompatProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  /** react-router compatible destination. */
  to?: string;
  href?: string;
  children?: ReactNode;
};

export default function Link({ to, href, ...rest }: LinkCompatProps) {
  return <NextLink href={to ?? href ?? "/"} {...rest} />;
}
