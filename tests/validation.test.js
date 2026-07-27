import test from "node:test";
import assert from "node:assert/strict";
import {
  countCharacters,
  extractTitle,
  validateDraft,
  validationGroups,
} from "../src/validation.js";

test("counts readable characters and ignores Markdown punctuation", () => {
  assert.equal(countCharacters("**你好，world 2026！**"), 11);
});

test("extracts a Markdown title", () => {
  assert.equal(extractTitle("# 一条清晰的小红书标题"), "一条清晰的小红书标题");
});

test("发布标题严格执行20字上限", () => {
  const result = validateDraft("# 这是一个刚好超过二十字限制的小红书发布标题呀\n\n正文");
  const titleCheck = result.checks.find((check) => check.id === "title");
  assert.equal(titleCheck.pass, false);
  assert.match(titleCheck.requirement, /18–20字.*2个Emoji.*8000字以上.*万字深度/);
});

test("标题同时满足字数、Emoji和深度钩子", () => {
  const result = validateDraft(
    "# 焦虑救星🔥超全干货AI实战进阶指南🚀\n\n正文",
  );
  const titleCheck = result.checks.find((check) => check.id === "title");

  assert.equal(result.counts.titleCount, 18);
  assert.equal(result.counts.titleEmojiCount, 2);
  assert.equal(result.counts.titleHasDepthHook, true);
  assert.equal(result.counts.titleLengthClaimValid, true);
  assert.equal(titleCheck.pass, true);
});

test("短正文不能在标题中冒用万字深度", () => {
  const result = validateDraft(
    "# 别再踩坑🔥万字深度AI实战终极指南🚀\n\n精炼正文。",
  );
  const titleCheck = result.checks.find((check) => check.id === "title");

  assert.equal(result.counts.titleLengthClaimValid, false);
  assert.equal(titleCheck.pass, false);
  assert.match(titleCheck.actual, /错误宣称万字/);
});

test("reports missing required sections", () => {
  const result = validateDraft("# 这是一个明显不完整的短标题\n\n只有一小段正文。");
  assert.equal(result.valid, false);
  assert.equal(result.checks.find((check) => check.id === "summary").actual, "缺失");
  assert.equal(result.checks.find((check) => check.id === "review").actual, "缺失");
});

test("正文只检查10000字上限，不强制达到5000字", () => {
  const result = validateDraft("# 别再踩坑🔥万字深度AI实战终极指南🚀\n\n精炼正文。");
  const bodyCheck = result.checks.find((check) => check.id === "body");

  assert.equal(bodyCheck.pass, true);
  assert.equal(bodyCheck.requirement, "正文按原文自然展开，不超过10000字");
});

test("摘要必须同时满足字数与三块编号排版", () => {
  const opening = "开场价值".repeat(13);
  const first = "第一方法".repeat(10);
  const second = "第二方法".repeat(10);
  const third = "第三方法".repeat(10);
  const closing = "落地行动".repeat(13);
  const formattedSummary = `${opening}

1. ${first}
2. ${second}
3. ${third}

${closing}`;
  const formatted = validateDraft(`## 正文小结 / 摘要

${formattedSummary}

## 推荐标签`);
  const formattedCheck = formatted.checks.find(
    (check) => check.id === "summary",
  );

  assert.equal(formatted.counts.summaryCount, 227);
  assert.equal(formatted.counts.summaryBlockCount, 3);
  assert.equal(formatted.counts.summaryNumberedItemCount, 3);
  assert.equal(formattedCheck.pass, true);

  const unformatted = validateDraft(`## 正文小结 / 摘要

${formattedSummary.replace(/\n+/gu, " ")}

## 推荐标签`);
  const unformattedCheck = unformatted.checks.find(
    (check) => check.id === "summary",
  );

  assert.equal(unformatted.counts.summaryCount, 227);
  assert.equal(unformattedCheck.pass, false);
  assert.match(unformattedCheck.actual, /1块，0个编号要点/);

  const stackedMarker = validateDraft(`## 正文小结 / 摘要

${formattedSummary.replace("1. ", "1. 🔹 ")}

## 推荐标签`);
  assert.equal(
    stackedMarker.checks.find((check) => check.id === "summary").pass,
    false,
  );
});

test("检查固定结构、结尾、标签数量与标签格式", () => {
  const chapters = `# 01 实战落地

## 1.1 第一个节点

实战内容

# 02 核心复盘总结与结尾

## 2.1 第二个节点

复盘内容`;
  const draft = `# 这是一个用于测试规范检查器的合格标题呀

# 框架总览

- 实战落地
- 核心复盘总结与结尾

${chapters}

## 正文小结 / 摘要

摘要

## 推荐标签

#AI工具 #开发效率 #Agent实践 #效率提升 #内容创作 #开发者 #工作流 #人工智能

## 【审稿自查】

1. 风险一
2. 风险二
3. 风险三`;
  const result = validateDraft(draft);
  assert.equal(result.counts.tagCount, 8);
  assert.equal(result.counts.openingCount, 0);
  assert.ok(result.counts.practiceCount > 0);
  assert.equal(
    result.checks.find((check) => check.id === "structure").pass,
    true,
  );
  assert.equal(
    result.checks.find((check) => check.id === "fixed-format").pass,
    true,
  );
  assert.equal(
    result.checks.find((check) => check.id === "tag-format").pass,
    true,
  );
  assert.equal(
    result.checks.find((check) => check.id === "description-limit").pass,
    true,
  );
});

test("检查项与Markdown规范一致且不再要求配图和排版建议", () => {
  const result = validateDraft("");
  const checks = new Map(
    result.checks.map((check) => [check.id, check.requirement]),
  );

  assert.equal(checks.get("tags"), "恰好8个唯一标签");
  assert.equal(
    checks.get("summary"),
    "摘要220–280字；3块排版，中间为1.–3.连续编号要点",
  );
  assert.equal(
    checks.get("structure"),
    "目录只用-，章节只用# 01，节点只用## 1.1；2–15章且每章1–3节点；无标记叠加和伪分页信号",
  );
  assert.equal(
    checks.get("fixed-format"),
    "首行#标题；摘要→标签→自查；无额外分区",
  );
  assert.equal(checks.get("tag-format"), "全部标签同一行，每个以#开头");
  assert.equal(checks.has("images"), false);
  assert.equal(checks.has("layout"), false);
});

test("拒绝目录、章节和节点叠加编号或Emoji", () => {
  const draft = `# 焦虑救星🔥超全干货AI实战进阶指南🚀

# 框架总览

- 01 💡 实战落地
- 02 💡 核心复盘总结

# 01 💡 实战落地

## ▶️ 1.1 方法

正文

# 02 💡 核心复盘总结

## ▶️ 2.1 结尾

正文`;
  const structure = validateDraft(draft).checks.find(
    (check) => check.id === "structure",
  );

  assert.equal(structure.pass, false);
});

test("检查项严格按Markdown章节建立父子分组", () => {
  assert.deepEqual(
    validationGroups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => item.id),
    })),
    [
      { label: "标题", items: ["title"] },
      {
        label: "正文内容",
        items: ["body", "opening", "structure", "practice"],
      },
      {
        label: "正文小结 / 摘要",
        items: ["summary", "description-limit"],
      },
      { label: "推荐标签", items: ["tags", "tag-format"] },
      { label: "输出结构", items: ["fixed-format"] },
      { label: "审稿自查", items: ["review"] },
      {
        label: "人工内容复核",
        items: [
          "manual-rewrite",
          "manual-cases",
          "manual-tone",
          "manual-practice",
          "manual-ending",
          "manual-layout",
          "manual-summary-tags",
          "manual-review",
        ],
      },
    ],
  );

  const groupedIds = validationGroups.flatMap((group) =>
    group.items.filter((item) => !item.manual).map((item) => item.id),
  );
  const checkIds = validateDraft("").checks.map((check) => check.id);
  assert.deepEqual(new Set(groupedIds), new Set(checkIds));

  const manualGroup = validationGroups.find((group) => group.id === "manual");
  assert.equal(manualGroup.manual, true);
  assert.match(
    manualGroup.items.find((item) => item.id === "manual-cases").requirement,
    /可靠依据.*案例.*失败复盘.*跨领域洞见.*不得.*虚构/,
  );
});

test("旧排版建议分区或多行标签不能通过固定格式", () => {
  const draft = `# 这是一个用于测试规范检查器的合格标题呀

## 正文小结 / 摘要
摘要

## 排版风格建议
建议

## 推荐标签
#AI工具
#开发效率

## 【审稿自查】
1. 风险一
2. 风险二
3. 风险三`;
  const result = validateDraft(draft);

  assert.equal(
    result.checks.find((check) => check.id === "fixed-format").pass,
    false,
  );
  assert.equal(
    result.checks.find((check) => check.id === "tag-format").pass,
    false,
  );
});

test("固定输出区出现任意额外分区时不能通过", () => {
  const draft = `# 这是一个用于测试规范检查器的合格标题呀

## 正文小结 / 摘要
摘要

## 推荐标签
#AI工具 #开发效率 #Agent实践 #效率提升 #内容创作 #开发者 #工作流 #人工智能

## 【审稿自查】
1. 风险一
2. 风险二
3. 风险三

## 额外说明
不应出现`;
  const result = validateDraft(draft);

  assert.equal(
    result.checks.find((check) => check.id === "fixed-format").pass,
    false,
  );
});
