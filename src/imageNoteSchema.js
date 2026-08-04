const TOP_LEVEL_KEYS = [
  "schemaVersion", "noteType", "title", "pages", "description", "tags", "themeTokens",
];
const HEX = /^#[0-9a-f]{6}$/iu;
const LAYOUTS = new Set(["editorial", "minimal", "magazine"]);
const PAGE_KINDS = new Set(["cover", "content"]);

export const DEFAULT_THEME_TOKENS = Object.freeze({
  canvas: { width: 1080, height: 1440 },
  colors: { background: "#FFFFFF", text: "#15181D", accent: "#EF4B43" },
  layout: "editorial",
  showWordCount: true,
  showReadingTime: true,
  showPageNumber: true,
});

function text(value, label, max = 10_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim().slice(0, max);
}

export function sanitizeThemeTokens(value = {}, fallback = DEFAULT_THEME_TOKENS) {
  const unsupportedRules = [];
  const canvas = value.canvas || {};
  const width = Number(canvas.width);
  const height = Number(canvas.height);
  const ratio = width / height;
  const validCanvas = Number.isInteger(width) && Number.isInteger(height) &&
    width >= 720 && height >= 960 && ratio >= 0.75 && ratio <= 2;
  if (!validCanvas && (canvas.width != null || canvas.height != null)) unsupportedRules.push("canvas");
  const colors = {};
  for (const key of ["background", "text", "accent"]) {
    if (HEX.test(value.colors?.[key] || "")) colors[key] = value.colors[key].toUpperCase();
    else {
      colors[key] = fallback.colors[key];
      if (value.colors?.[key] != null) unsupportedRules.push(`colors.${key}`);
    }
  }
  const layout = LAYOUTS.has(value.layout) ? value.layout : fallback.layout;
  if (value.layout != null && !LAYOUTS.has(value.layout)) unsupportedRules.push("layout");
  return {
    themeTokens: {
      canvas: validCanvas ? { width, height } : { ...fallback.canvas },
      colors,
      layout,
      showWordCount: typeof value.showWordCount === "boolean" ? value.showWordCount : fallback.showWordCount,
      showReadingTime: typeof value.showReadingTime === "boolean" ? value.showReadingTime : fallback.showReadingTime,
      showPageNumber: typeof value.showPageNumber === "boolean" ? value.showPageNumber : fallback.showPageNumber,
    },
    unsupportedRules: [...new Set(unsupportedRules)],
  };
}

export function parseImageNote(raw) {
  const cleaned = String(raw || "").trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  let value;
  try { value = JSON.parse(cleaned); } catch { throw new Error("模型返回的图文 JSON 格式无效。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("图文结果必须是 JSON 对象。");
  const unknown = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.includes(key));
  if (unknown.length) throw new Error(`图文结果包含未知字段：${unknown.join("、")}。`);
  if (value.schemaVersion !== 1 || value.noteType !== "image-note") throw new Error("图文结果类型或版本不正确。");
  if (!Array.isArray(value.pages) || value.pages.length < 2 || value.pages.length > 18) throw new Error("图文必须包含封面和内容页，且最多18页。");
  const ids = new Set();
  const pages = value.pages.map((page, offset) => {
    if (!page || typeof page !== "object" || page.index !== offset + 1) throw new Error("图片页索引必须从1连续递增。");
    const id = text(page.id, "图片页 ID", 80);
    if (ids.has(id)) throw new Error("图片页 ID 必须唯一。");
    ids.add(id);
    if (!PAGE_KINDS.has(page.kind) || (offset === 0 && page.kind !== "cover")) throw new Error("第一页必须为封面，页面类型必须受支持。");
    return {
      id, index: offset + 1, kind: page.kind,
      heading: text(page.heading, "页面标题", 500),
      subheading: typeof page.subheading === "string" ? page.subheading.trim().slice(0, 1000) : "",
      body: Array.isArray(page.body) ? page.body.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20) : [],
      highlight: typeof page.highlight === "string" && page.highlight.trim() ? page.highlight.trim().slice(0, 1000) : null,
    };
  });
  const { themeTokens, unsupportedRules } = sanitizeThemeTokens(value.themeTokens);
  return {
    schemaVersion: 1, noteType: "image-note", title: text(value.title, "图文标题", 500), pages,
    description: text(value.description, "正文描述", 20_000),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean).slice(0, 50) : (() => { throw new Error("标签必须是字符串数组。"); })(),
    themeTokens, unsupportedRules,
  };
}

export function updateCoverTitle(note, title) {
  return { ...note, title, pages: note.pages.map((page, index) => index === 0 ? { ...page, heading: title } : page) };
}
