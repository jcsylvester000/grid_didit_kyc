// next/image loader: Unsplash images are resized and converted (AVIF/WebP) by Unsplash's own CDN,
// so Netlify's image function is not used. Local files (logos) are served as-is.
type LoaderArgs = { src: string; width: number; quality?: number };

export default function imageLoader({ src, width, quality }: LoaderArgs) {
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 70));
    return url.toString();
  }
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
