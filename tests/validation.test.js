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
  assert.match(titleCheck.requirement, /18–20字/);
});

test("reports missing required sections", () => {
  const result = validateDraft("# 这是一个明显不完整的短标题\n\n只有一小段正文。");
  assert.equal(result.valid, false);
  assert.equal(result.checks.find((check) => check.id === "summary").actual, "缺失");
  assert.equal(result.checks.find((check) => check.id === "review").actual, "缺失");
});

test("检查固定结构、结尾、标签数量与标签格式", () => {
  const draft = `# 这是一个用于测试规范检查器的合格标题呀

## 框架总览

一、第一部分
二、第二部分

## 实战落地

实战内容

## 结尾

结尾内容

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

  assert.equal(checks.get("tags"), "8–10个唯一标签");
  assert.equal(
    checks.get("structure"),
    "含框架总览、至少2个一/二主体标题、实战落地、结尾",
  );
  assert.equal(
    checks.get("fixed-format"),
    "首行#标题；摘要→标签→自查；无额外分区",
  );
  assert.equal(checks.get("tag-format"), "全部标签同一行，每个以#开头");
  assert.equal(checks.has("images"), false);
  assert.equal(checks.has("layout"), false);
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
    /2–3个真实感案例.*1个失败复盘.*跨领域洞见/,
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
