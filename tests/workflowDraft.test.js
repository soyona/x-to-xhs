import assert from "node:assert/strict";
import test from "node:test";
import { replaceWorkflowSection } from "../src/workflowDraft.js";
import { splitXiaohongshuDraft } from "../src/xiaohongshuPublish.js";

const draft = `# 原长文标题

开头正文。

# 框架总览

- 要点

# 01 💡 实战落地

## ▶️ 1.1 方法

正文内容。

# 02 💡 核心复盘总结

## ▶️ 2.1 结尾

结尾内容。

## 正文小结 / 摘要

原摘要。

## 推荐标签

#旧标签1 #旧标签2

## 【审稿自查】

1. 检查事实。
2. 检查表达。
3. 检查风险。`;

test("替换长文标题时保留正文和固定尾部", () => {
  const next = replaceWorkflowSection(draft, "longform-title", "新长文标题");
  const fields = splitXiaohongshuDraft(next);

  assert.equal(fields.longformTitle, "新长文标题");
  assert.match(next, /正文内容/);
  assert.match(next, /原摘要/);
});

test("替换正文时不覆盖标题、摘要、标签和自查", () => {
  const next = replaceWorkflowSection(
    draft,
    "body",
    "新开头。\n\n# 框架总览\n\n- 新要点",
  );
  const fields = splitXiaohongshuDraft(next);

  assert.equal(fields.longformTitle, "原长文标题");
  assert.match(fields.body, /新开头/);
  assert.doesNotMatch(fields.body, /正文内容/);
  assert.equal(fields.description, "原摘要。");
  assert.equal(fields.tags, "#旧标签1 #旧标签2");
  assert.match(next, /审稿自查/);
});

test("替换描述和标签时保持固定分区顺序与空行", () => {
  const withDescription = replaceWorkflowSection(
    draft,
    "description",
    "导语第一句。导语第二句。\n\n1. 第一项\n2. 第二项\n3. 第三项\n\n收束段。",
  );
  const next = replaceWorkflowSection(
    withDescription,
    "tags",
    "#新标签1 #新标签2 #新标签3",
  );
  const fields = splitXiaohongshuDraft(next);

  assert.match(fields.description, /1\. 第一项\n2\. 第二项\n3\. 第三项/);
  assert.equal(fields.tags, "#新标签1 #新标签2 #新标签3");
  assert.ok(next.indexOf("正文小结") < next.indexOf("推荐标签"));
  assert.ok(next.indexOf("推荐标签") < next.indexOf("审稿自查"));
});

