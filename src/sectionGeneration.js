import { buildContentPreferencePrompt, normalizeContentPreferences } from "./contentPreferences.js";
import { countPlatformCharacters } from "./xiaohongshuPublish.js";
import { validateDraft } from "./validation.js";
import { replaceWorkflowSection } from "./workflowDraft.js";

export const SECTION_TYPES = new Set([
  "longform-title",
  "body",
  "publish-title",
  "description",
  "tags",
]);

const sectionInstructions = {
  "longform-title": `生成恰好3个差异明显的长文标题。
- 每个标题18–20个Unicode字符。
- 每个标题恰好2个Emoji。
- 默认包含“超全干货”；正文不足8000字时禁止使用“万字深度”。
- 三个标题分别侧重痛点、收益、反差，不能只替换近义词。`,
  body: `只重新生成长文正文，不输出长文标题、正文摘要、推荐标签或审稿自查。
- 保留适合小红书长文的结构化Markdown正文。
- 正文不超过10000字，不为凑字数虚构案例或数据。
- 包含框架总览、2–15个一级章节、每章1–3个二级节点、实战落地和核心复盘。
- 同一行只保留一种主标记：目录严格使用“- 标题”，一级章节严格使用“# 01 标题”，二级标题严格使用“## 1.1 标题”；不得叠加章节编号、Emoji或其他行首符号。
- 不输出伪分页线、未完待续或额外固定尾部分区。`,
  "publish-title": `生成恰好3个差异明显的发布标题。
- 每个标题不超过20个Unicode字符。
- 与当前正文直接相关，不得使用正文无法兑现的夸张承诺。
- 三个标题分别侧重痛点、收益、反差，不能只替换近义词。`,
  description: `只生成1个当前正文的摘要描述。
- 220–280字。
- 固定为3块：2句短导语；空行；连续的1.至3.编号要点；空行；1段收束语。
- 只能总结当前正文，不得根据原始内容另行发挥。
- 不输出“正文小结 / 摘要”标题。`,
  tags: `只生成1组标签。
- 恰好8个唯一标签，每个以#开头并放在同一行。
- 结合当前正文，覆盖核心主题、使用场景、人群和搜索长尾词。
- 当前没有可信的实时趋势数据，不得声称标签是实时热门或当前趋势。
- 不输出“推荐标签”标题。`,
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
  draft,
  body,
  currentValue,
  previousCandidates,
  rejectionReasons,
  preferences = {},
}) {
  if (!SECTION_TYPES.has(section)) throw new Error("不支持这个局部生成步骤。");
  const source = boundedText(sourceContent, 20_000);
  const currentDraft = boundedText(draft, 30_000);
  const selectedBody = boundedText(body, 20_000);
  if (!source) throw new Error("缺少原始 X 内容，无法局部生成。");
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

  return `你正在对一份小红书长文执行局部生成。只处理指定步骤，不得改写其他步骤。

## 本次步骤
${section}

## 硬性要求
${sectionInstructions[section]}

## 输出协议
只输出严格JSON，不要Markdown代码围栏，不要解释：
{"candidates":["候选1","候选2","候选3"]}
${
  section === "longform-title" || section === "publish-title"
    ? "candidates必须恰好包含3项。"
    : "candidates必须恰好包含1项。"
}

${preferencePrompt}

## 原始 X 内容
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
  if (section === "longform-title" || section === "publish-title") {
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

function checksPass(draft, ids) {
  const checks = new Map(
    validateDraft(draft).checks.map((check) => [check.id, check.pass]),
  );
  return ids.every((id) => checks.get(id) === true);
}

export function validateSectionCandidates(section, candidates, { draft }) {
  const requiredCount =
    section === "longform-title" || section === "publish-title" ? 3 : 1;
  if (!Array.isArray(candidates) || candidates.length !== requiredCount) {
    throw new Error(`模型需要返回${requiredCount}个合格候选。`);
  }

  const valid = candidates.every((candidate) => {
    if (section === "publish-title") {
      return countPlatformCharacters(candidate) > 0 &&
        countPlatformCharacters(candidate) <= 20;
    }
    const nextDraft = replaceWorkflowSection(draft, section, candidate);
    if (section === "longform-title") {
      return checksPass(nextDraft, ["title"]);
    }
    if (section === "body") {
      return checksPass(nextDraft, ["body", "opening", "structure", "practice"]);
    }
    if (section === "description") {
      return checksPass(nextDraft, ["summary", "description-limit"]);
    }
    if (section === "tags") {
      return checksPass(nextDraft, ["tags", "tag-format"]);
    }
    return false;
  });

  if (!valid) throw new Error("模型返回的候选未全部通过当前步骤规则，请重新生成。");
  return candidates;
}
