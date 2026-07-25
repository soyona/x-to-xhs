import { toXiaohongshuText } from "./xiaohongshuText.js";

const sectionLabels = {
  summary: /正文小结\s*[\/／]\s*摘要|正文小结|正文描述|发布文案/u,
  layout: /排版风格建议|排版建议/u,
  tags: /推荐标签|标签推荐|话题标签/u,
  review: /审稿自查/u,
};

const fallbackTags = [
  "#AI工具",
  "#AI工作流",
  "#开发效率",
  "#效率提升",
  "#人工智能",
  "#内容创作",
  "#开发者",
  "#生产力",
  "#实战经验",
];

function matchSectionLine(line, name) {
  const normalized = line
    .trim()
    .replace(/^#{1,6}\s*/u, "")
    .replace(/\*\*/gu, "")
    .replace(
      /^[\s>《》【】[\]()（）\d一二三四五六七八九十.、:：\-—\p{Extended_Pictographic}\uFE0F]+/u,
      "",
    );
  const match = sectionLabels[name].exec(normalized);
  if (!match || match.index > 4) return null;
  const content = normalized
    .slice(match.index + match[0].length)
    .replace(/^\s*[（(][^）)]*[）)]/u, "")
    .replace(/^\s*[:：\-—]\s*/u, "")
    .trim();
  return { content };
}

function findSection(lines, name, from = 0) {
  for (let index = from; index < lines.length; index += 1) {
    const match = matchSectionLine(lines[index], name);
    if (match) return { index, ...match };
  }
  return null;
}

function firstSectionIndex(lines, names, from = 0) {
  const indexes = names
    .map((name) => findSection(lines, name, from)?.index)
    .filter((index) => Number.isInteger(index));
  return indexes.length ? Math.min(...indexes) : lines.length;
}

function extractTitleAndLine(lines) {
  const headingIndex = lines.findIndex((line) => /^#{1,2}\s+\S/u.test(line));
  const titleIndex =
    headingIndex >= 0
      ? headingIndex
      : lines.findIndex(
          (line) => line.trim() && !/^[-*>`]|\[建议配图/u.test(line.trim()),
        );
  const rawTitle = titleIndex >= 0 ? lines[titleIndex] : "";
  const title = rawTitle
    .trim()
    .replace(/^#{1,2}\s+/u, "")
    .replace(/^\*\*标题[：:]\*\*\s*/u, "")
    .replace(/^标题[：:]\s*/u, "")
    .replace(/^\*\*|\*\*$/gu, "")
    .trim();
  return { title, titleIndex };
}

function sectionContent(lines, name, followingNames) {
  const section = findSection(lines, name);
  if (!section) return "";
  const end = firstSectionIndex(lines, followingNames, section.index + 1);
  return toXiaohongshuText(
    [section.content, ...lines.slice(section.index + 1, end)]
      .filter(Boolean)
      .join("\n"),
  );
}

function descriptionFromBody(body) {
  const paragraphs = body
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const selected = [];
  let length = 0;

  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const paragraph = paragraphs[index];
    const nextLength = length + countPlatformCharacters(paragraph);
    if (selected.length && (selected.length >= 3 || nextLength > 1000)) break;
    selected.unshift(paragraph);
    length = nextLength;
  }

  return Array.from(selected.join("\n\n")).slice(0, 1000).join("");
}

function extractTags(value) {
  const hashtags = value.match(/#[\p{L}\p{N}_-]+/gu) || [];
  if (hashtags.length) return Array.from(new Set(hashtags)).join(" ");

  const plainTags = value
    .split(/[\s,，、｜|]+/u)
    .map((tag) => tag.replace(/^[\d.、）)\-*]+/u, "").trim())
    .filter((tag) => /^[\p{L}\p{N}_-]{2,20}$/u.test(tag))
    .map((tag) => `#${tag}`);
  return Array.from(new Set(plainTags)).join(" ");
}

function extractHashtags(value) {
  return Array.from(
    new Set(value.match(/#[\p{L}\p{N}_-]+/gu) || []),
  ).join(" ");
}

export function countPlatformCharacters(value = "") {
  return Array.from(value).length;
}

export function splitXiaohongshuDraft(markdown = "") {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const { title, titleIndex } = extractTitleAndLine(lines);
  const bodyStart = titleIndex >= 0 ? titleIndex + 1 : 0;
  const bodyEnd = firstSectionIndex(
    lines,
    ["summary", "layout", "tags", "review"],
    bodyStart,
  );
  const body = toXiaohongshuText(lines.slice(bodyStart, bodyEnd).join("\n"));
  const summary = sectionContent(lines, "summary", [
    "layout",
    "tags",
    "review",
  ]);
  const tagSection = sectionContent(lines, "tags", ["review"]);
  const description = summary || descriptionFromBody(body);
  const extractedTags =
    extractTags(tagSection) ||
    extractHashtags(markdown.replace(/\r\n?/g, "\n"));
  const tags = extractedTags || fallbackTags.join(" ");

  return {
    longformTitle: title,
    body,
    publishTitle: title,
    description,
    tags,
    sources: {
      description: summary ? "summary" : "body-fallback",
      tags: extractedTags ? "generated" : "default-fallback",
    },
    counts: {
      longformTitle: countPlatformCharacters(title),
      body: countPlatformCharacters(body),
      publishTitle: countPlatformCharacters(title),
      description: countPlatformCharacters(description),
      tags: (tags.match(/#[\p{L}\p{N}_-]+/gu) || []).length,
    },
  };
}
