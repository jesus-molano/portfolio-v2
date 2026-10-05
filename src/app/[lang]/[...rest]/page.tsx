import type { Metadata } from "next";
import { notFound } from "next/navigation";

/*
 * Any unknown path under a locale renders the localized not-found page.
 * Its metadata says so too: without this, the head the client hydrates
 * came from this page's metadata (the layout's title), and the 404's own
 * title gave way to the home page's a moment after it loaded.
 */
export function generateMetadata(): Metadata {
  notFound();
}

export default function CatchAllPage() {
  notFound();
}
