const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "duo9co2r1";

const WIDTH_BUCKETS = [128, 256, 480, 640, 960, 1280, 1600, 1920];

function bucketWidth(w) {
  if (!w) return 640;
  for (const b of WIDTH_BUCKETS) {
    if (w <= b) return b;
  }
  return WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1];
}

const TRANSFORM_RE = /[?&](?:w|q|f|c|g|dpr|fetch_format|quality|width|height|gravity|crop)(?:=[^&]*|_[^&]*)/gi;

function stripCloudinaryTransforms(url) {
  let base = url;
  let prev;
  do {
    prev = base;
    base = base.replace(/(image\/(?:upload|fetch)\/)[^/]*,[^/]*\//, "$1");
  } while (base !== prev);
  return base.replace(TRANSFORM_RE, "");
}

export default function imageLoader({ src, width, quality }) {
  const w = bucketWidth(width);
  const q = quality || 80;

  if (!src || src.startsWith("/")) return src;

  const isCloudinary = /res\.cloudinary\.com/.test(src);
  if (isCloudinary) {
    const base = stripCloudinaryTransforms(src);
    return base.replace(
      /(image\/(?:upload|fetch)\/)/,
      `$1w_${w},q_${q},f_auto,c_limit/`,
    );
  }

  if (CLOUD_NAME && src.startsWith("https://")) {
    const encoded = encodeURIComponent(src);
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/w_${w},q_${q},f_auto,c_limit/${encoded}`;
  }

  return src;
}
