import { buildContentPreferencePrompt, normalizeContentPreferences } from "./contentPreferences.js";

export const SECTION_TYPES = new Set([
  "longform-title",
  "body",
  "description",
  "tags",
]);

const sectionModuleIds = {
  "longform-title": "title",
  body: "body",
  description: "summary",
  tags: "tags",
};

const taskInstructions = {
  "longform-title":
    "生成恰好3个长文标题候选，并按照痛点场景型、逆向认知型、解决方案型的顺序放入 candidates。",
  body:
    "只生成1个长文正文新版本，不输出长文标题、正文摘要、推荐标签或其他说明。",
  description:
    "只生成1个当前正文的摘要描述，不输出“正文小结 / 摘要”标题。",
  tags:
    "只生成1组标签，不输出“推荐标签”标题。",
};

function boundedText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanPreviousCandidates(values) {
  return Array.isArray(values)
    ? values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(-9)
    : [];
}

export function buildSectionGenerationPrompt({
  section,
  sourceContent,
  sourceMode,
  sourceUrl,
  authorHandle,
  draft,
  body,
  currentValue,
  previousCandidates,
  rejectionReasons,
  preferences = {},
  promptModules,
}) {
  if (!SECTION_TYPES.has(section)) throw new Error("不支持这个局部生成步骤。");
  const source = boundedText(sourceContent, 20_000);
  const currentDraft = boundedText(draft, 30_000);
  const selectedBody = boundedText(body, 20_000);
  if (!source) throw new Error("缺少输入内容，无法局部生成。");
  if (!currentDraft) throw new Error("缺少当前草稿，无法局部生成。");

  const previous = cleanPreviousCandidates(previousCandidates);
  const reasons = Array.isArray(rejectionReasons)
    ? rejectionReasons
        .filter((reason) => typeof reason === "string")
        .map((reason) => reason.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const preferencePrompt = buildContentPreferencePrompt(
    normalizeContentPreferences(preferences),
  );
  const moduleId = sectionModuleIds[section];
  const globalInstructions = promptModules?.global?.trim();
  const moduleInstructions = promptModules?.[moduleId]?.trim();
  if (!globalInstructions || !moduleInstructions) {
    throw new Error("当前提示词方案缺少局部生成所需模块。");
  }
  const sourceMetadata = [
    `source_mode: ${sourceMode || "x-content"}`,
    `source_url: ${sourceUrl || "未提供"}`,
    `author_handle: ${authorHandle ? `@${authorHandle}` : "未提供"}`,
  ].join("\n");

  return `你正在对一份小红书长文执行局部生成。只处理指定步骤，不得改写其他步骤。

## 全局原则
${globalInstructions}

## 本次步骤
${section}

## 当前模块规则
${moduleInstructions}

## 本次任务
${taskInstructions[section]}

## 输出协议
只输出严格JSON，不要Markdown代码围栏，不要解释：
{"candidates":["候选1","候选2","候选3"]}
${section === "longform-title" ? "candidates必须恰好包含3项。" : "candidates必须恰好包含1项。"}

${preferencePrompt}

## 结构化来源信息
<source_metadata>
${sourceMetadata}
</source_metadata>

## 输入素材
${source}

## 当前选定正文
${selectedBody || "尚未识别正文"}

## 当前值
${boundedText(currentValue, 12_000) || "无"}

## 需要避开的上一组候选
${previous.length ? previous.map((item) => `- ${item}`).join("\n") : "- 无"}

## 用户不满意原因
${reasons.length ? reasons.map((item) => `- ${item}`).join("\n") : "- 未提供"}

## 当前完整草稿
${currentDraft}`;
}

function parseJsonObject(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型未返回可解析的候选JSON。");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("模型返回的候选JSON格式无效。");
  }
}

function normalizeCandidate(section, value) {
  if (typeof value !== "string") return "";
  let candidate = value.trim();
  if (section === "longform-title") {
    candidate = candidate
      .replace(/^#{1,2}\s+/u, "")
      .replace(/^标题[：:]\s*/u, "")
      .replace(/^["“]|["”]$/gu, "")
      .trim();
  }
  if (section === "description") {
    candidate = candidate
      .replace(/^#{1,3}\s*(?:正文小结\s*[\/／]\s*摘要|正文小结|摘要)\s*/u, "")
      .trim();
  }
  if (section === "tags") {
    candidate = Array.from(
      new Set(candidate.match(/#[\p{L}\p{N}_-]+/gu) || []),
    ).join(" ");
  }
  return candidate;
}

export function parseSectionCandidates(raw, section) {
  if (!SECTION_TYPES.has(section)) throw new Error("不支持这个局部生成步骤。");
  const parsed = parseJsonObject(raw);
  if (!Array.isArray(parsed.candidates)) {
    throw new Error("模型没有返回候选列表。");
  }
  return Array.from(
    new Set(
      parsed.candidates
        .map((value) => normalizeCandidate(section, value))
        .filter(Boolean),
    ),
  );
}

export function validateSectionCandidates(section, candidates) {
  const requiredCount = section === "longform-title" ? 3 : 1;
  if (!Array.isArray(candidates) || candidates.length !== requiredCount) {
    throw new Error(`模型需要返回${requiredCount}个合格候选。`);
  }
  return candidates;
}
