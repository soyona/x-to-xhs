export const SOURCE_MODES = {
  X_URL: "x-url",
  X_CONTENT: "x-content",
  ORIGINAL: "original",
};

const SOURCE_MODE_VALUES = new Set(Object.values(SOURCE_MODES));
const X_STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/\d+(?:[^\s]*)?/giu;
const TRAILING_URL_PUNCTUATION = /[)\]}>）》】〕，。！？；;:'"]+$/u;

export function normalizeSourceMode(value) {
  return SOURCE_MODE_VALUES.has(value) ? value : null;
}

export function extractXStatusUrl(value = "") {
  const match = String(value).match(X_STATUS_URL_PATTERN)?.[0];
  if (!match) return null;
  const candidate = match.replace(TRAILING_URL_PUNCTUATION, "");
  try {
    const url = new URL(candidate);
    if (
      !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname.toLowerCase(),
      ) ||
      !/^\/[^/]+\/status\/\d+/u.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function extractStandaloneHttpUrl(value = "") {
  const candidate = String(value)
    .trim()
    .replace(TRAILING_URL_PUNCTUATION, "");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function inferSourceMode(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const sourceUrl = extractXStatusUrl(trimmed);
  if (!sourceUrl) return null;
  return trimmed.replace(TRAILING_URL_PUNCTUATION, "") === sourceUrl
    ? SOURCE_MODES.X_URL
    : SOURCE_MODES.X_CONTENT;
}

export function authorHandleFromUrl(value = "") {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] || "");
  } catch {
    return "";
  }
}

export function withoutStandaloneSourceUrl(content = "", sourceUrl = "") {
  if (!sourceUrl) return String(content).trim();
  return String(content)
    .split(/\r?\n/u)
    .filter((line) => {
      const trimmed = line.trim().replace(TRAILING_URL_PUNCTUATION, "");
      return trimmed !== sourceUrl;
    })
    .join("\n")
    .trim();
}
