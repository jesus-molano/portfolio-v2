import { TALL_MEDIA } from "./Marquee";

/**
 * One of the cinema's pre-drawn plates (tools/art/finale/build.mjs): AVIF
 * with a WebP fallback, the tall plate on portrait screens. Decoration: the
 * page's text says everything the plate shows.
 */
export function PlatePicture({
  mood,
  locale,
  className,
}: {
  mood: "night" | "dawn";
  locale: string;
  className?: string;
}) {
  const src = (layout: "wide" | "tall", format: "avif" | "webp") => `/finale/${mood}-${layout}-${locale}.${format}`;
  return (
    <picture className={className}>
      <source media={TALL_MEDIA} type="image/avif" srcSet={src("tall", "avif")} />
      <source media={TALL_MEDIA} type="image/webp" srcSet={src("tall", "webp")} />
      <source type="image/avif" srcSet={src("wide", "avif")} />
      {/* Pre-encoded AVIF and WebP (tools/art/encode.py): the image optimizer would only re-encode them. */}
      <img src={src("wide", "webp")} alt="" width={2560} height={1440} loading="lazy" decoding="async" />
    </picture>
  );
}
