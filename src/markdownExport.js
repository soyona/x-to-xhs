const illegalFilenameCharacters = /[\\/:*?"<>|]/gu;

export function buildMarkdownFilename(title = "") {
  const safeTitle = Array.from(
    title
      .replace(illegalFilenameCharacters, "")
      .replace(/\s+/gu, " ")
      .trim(),
  )
    .slice(0, 60)
    .join("");

  return `小红书长文-${safeTitle || "未命名"}.md`;
}

export function buildMarkdownBody(body = "") {
  if (!body) return "";

  const normalized = body
    .replace(/\r\n?/gu, "\n")
    .replace(/(?<![=])==([^=\n]+)==(?![=])/gu, "$1");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}
