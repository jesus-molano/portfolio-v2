import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, negotiateLocale } from "@/i18n/config";

/**
 * Redirects requests without a locale prefix to the negotiated locale.
 * `/` -> `/en` or `/es`, based on `Accept-Language`. `/EN` -> `/en`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, firstSegment = "", ...rest] = pathname.split("/");
  const lowered = firstSegment.toLowerCase();
  const url = request.nextUrl.clone();

  if (hasLocale(firstSegment)) return;

  if (hasLocale(lowered)) {
    url.pathname = `/${lowered}${rest.length ? `/${rest.join("/")}` : ""}`;
    return NextResponse.redirect(url);
  }

  const locale = negotiateLocale(request.headers.get("accept-language"));
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and files with an extension (assets).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
