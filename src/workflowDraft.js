const sectionPatterns = {
  summary: /正文小结\s*[\/／]\s*摘要|正文小结|正文描述|发布文案/u,
  layout: /排版风格建议|排版建议/u,
  tags: /推荐标签|标签推荐|话题标签/u,
  review: /审稿自查/u,
};

function normalizedSectionLine(line = "") {
  return line
    .trim()
    .replace(/^#{1,6}\s*/u, "")
    .replace(/\*\*/gu, "")
    .replace(
      /^[\s>《》【】[\]()（）\d一二三四五六七八九十.、:：\-—\p{Extended_Pictographic}\uFE0F]+/u,
      "",
    );
}

function sectionName(line = "") {
  const normalized = normalizedSectionLine(line);
  return Object.entries(sectionPatterns).find(
    ([, matcher]) => matcher.exec(normalized)?.index <= 4,
  )?.[0] || "";
}

function titleLineIndex(lines) {
  const headingIndex = lines.findIndex((line) => /^#{1,2}\s+\S/u.test(line));
  if (headingIndex >= 0) return headingIndex;
  return lines.findIndex(
    (line) => line.trim() && !/^[-*>`]|\[建议配图/u.test(line.trim()),
  );
}

function firstSectionLine(lines, names, from = 0) {
  const allowed = new Set(names);
  const index = lines.findIndex(
    (line, lineIndex) => lineIndex >= from && allowed.has(sectionName(line)),
  );
  return index >= 0 ? index : lines.length;
}

function joinDraftParts(parts) {
  return `${parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()}\n`;
}

function replaceFixedSection(draft, name, value, followingNames) {
  const lines = draft.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => sectionName(line) === name);
  const insertBefore = firstSectionLine(lines, followingNames);
  const heading = name === "summary"
    ? "## 正文小结 / 摘要"
    : "## 推荐标签";

  if (start < 0) {
    return joinDraftParts([
      lines.slice(0, insertBefore).join("\n"),
      `${heading}\n\n${value}`,
      lines.slice(insertBefore).join("\n"),
    ]);
  }

  const end = firstSectionLine(lines, followingNames, start + 1);
  return joinDraftParts([
    lines.slice(0, start).join("\n"),
    `${heading}\n\n${value}`,
    lines.slice(end).join("\n"),
  ]);
}

export function replaceWorkflowSection(draft = "", section, value = "") {
  const cleaned = value.trim();
  if (!draft.trim() || (!cleaned && section !== "body")) return draft;
  const lines = draft.replace(/\r\n?/gu, "\n").split("\n");
  const titleIndex = titleLineIndex(lines);

  if (section === "longform-title") {
    if (titleIndex < 0) return draft;
    lines[titleIndex] = `# ${cleaned.replace(/^#{1,2}\s+/u, "")}`;
    return `${lines.join("\n").trim()}\n`;
  }

  if (section === "body") {
    const bodyStart = titleIndex >= 0 ? titleIndex + 1 : 0;
    const bodyEnd = firstSectionLine(
      lines,
      ["summary", "layout", "tags", "review"],
      bodyStart,
    );
    return joinDraftParts([
      lines.slice(0, bodyStart).join("\n"),
      cleaned,
      lines.slice(bodyEnd).join("\n"),
    ]);
  }

  if (section === "description") {
    return replaceFixedSection(
      draft,
      "summary",
      cleaned,
      ["layout", "tags", "review"],
    );
  }

  if (section === "tags") {
    return replaceFixedSection(draft, "tags", cleaned, ["review"]);
  }

  return draft;
}
