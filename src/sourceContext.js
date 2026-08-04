export const SOURCE_MODES = {
  URL: "url",
  CONTENT: "content",
};

const SOURCE_MODE_VALUES = new Set(Object.values(SOURCE_MODES));
const LEGACY_SOURCE_MODES = new Map([
  ["x-url", SOURCE_MODES.URL],
  ["x-content", SOURCE_MODES.CONTENT],
]);
const X_STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/\d+(?:[^\s]*)?/giu;
const HTTP_URL_PATTERN = /https?:\/\/[^\s<]+/giu;
const TRAILING_URL_PUNCTUATION = /[)\]}>）》】〕，。！？；;:'"]+$/u;

export function normalizeSourceMode(value) {
  if (SOURCE_MODE_VALUES.has(value)) return value;
  return LEGACY_SOURCE_MODES.get(value) || null;
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

export function extractHttpUrl(value = "") {
  const match = String(value).match(HTTP_URL_PATTERN)?.[0];
  if (!match) return null;
  return extractStandaloneHttpUrl(match);
}

export function inferSourceMode(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return extractStandaloneHttpUrl(trimmed)
    ? SOURCE_MODES.URL
    : SOURCE_MODES.CONTENT;
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
