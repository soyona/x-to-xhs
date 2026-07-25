import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  toXiaohongshuPlainText,
  toXiaohongshuRichHtml,
  toXiaohongshuText,
} from "../src/xiaohongshuText.js";
import {
  countPlatformCharacters,
  splitXiaohongshuDraft,
} from "../src/xiaohongshuPublish.js";

test("移除 Markdown 装饰符并保留适合小红书的文本结构", () => {
  const source = `# **专业标题**

## 一、**核心观点**

- 第一条
- [x] 已完成

> 一句引用

| 指标 | 结果 |
| --- | --- |
| 效率 | **提升 80%** |

\`\`\`text
保留代码内容
\`\`\`

[参考资料](https://example.com)

#AI工具 #开发者效率`;

  assert.equal(
    toXiaohongshuText(source),
    `# 专业标题

## 一、核心观点

- 第一条
- [x] 已完成

一句引用

指标｜结果

效率｜提升 80%

保留代码内容

参考资料

#AI工具 #开发者效率`,
  );
});

test("保留H1、H2、无序列表和有序列表标记", () => {
  const source = `# 01 💡 一级标题

## ▶️ 1.1 二级标题

- 无序列表
1. 有序列表`;

  assert.equal(toXiaohongshuText(source), source);
});

test("为正文复制同时生成富文本结构和无井号纯文本兜底", () => {
  const source = `# 01 💡 一级标题

## ▶️ 1.1 二级标题

- 无序列表
1. 有序列表`;

  assert.equal(
    toXiaohongshuPlainText(source),
    `01 💡 一级标题

▶️ 1.1 二级标题

• 无序列表
1. 有序列表`,
  );
  assert.equal(
    toXiaohongshuRichHtml(source),
    "<div><h1>01 💡 一级标题</h1><p><br></p><h2>▶️ 1.1 二级标题</h2><p><br></p><ul><li>无序列表</li></ul><ol><li>有序列表</li></ol></div>",
  );
});

test("纯文本正文的符号与空行原样进入02预览和剪贴板字段", () => {
  const source = `# 可直接发布的小红书长文标题

框架总览

• 先确认目标


一、核心方法

☑ 保留最终符号

⚠️ 注意失败边界

## 正文小结 / 摘要

摘要内容。

## 推荐标签

#AI工具 #开发效率

## 【审稿自查】

1. 检查事实。`;

  const result = splitXiaohongshuDraft(source);

  assert.equal(
    result.body,
    `框架总览

• 先确认目标


一、核心方法

☑ 保留最终符号

⚠️ 注意失败边界`,
  );
});

test("清除无效分页线和文字版页脚，避免出现在卡片中间", () => {
  const source = `01 💡 第一章

（未完待续，下滑查看下一章 ➡️）

---

02 💡 第二章`;

  assert.equal(
    toXiaohongshuText(source),
    `01 💡 第一章

02 💡 第二章`,
  );
});

test("demo1 转换后保留标题层级并移除加粗、代码围栏和表格分隔语法", async () => {
  const demo = await readFile(
    new URL("../examples/demo1.md", import.meta.url),
    "utf8",
  );
  const result = toXiaohongshuText(demo);

  assert.match(result, /^# 用OpenSpec Plus给AI套上纪律/);
  assert.match(result, /【建议配图：/);
  assert.match(result, /#AI编程 #Cursor/);
  assert.match(result, /^#{1,2}\s/m);
  assert.doesNotMatch(result, /\*\*/);
  assert.doesNotMatch(result, /^\s*```/m);
  assert.doesNotMatch(result, /^\s*\|?\s*:?-{3,}/m);
});

test("按小红书写长文流程拆分标题、正文、描述和标签", () => {
  const source = `# 十八字以内的小红书发布标题

---

开头正文。

## 一、核心方法

**这里是正文重点。**

- 第一条
1. 第二步

## 正文小结 / 摘要

这是发布页使用的正文描述。

## 排版风格建议

使用小红书一键排版。

## 推荐标签

#AI工具 #开发效率 #AI工具

## 【审稿自查】

1. 发布前检查事实。`;

  const result = splitXiaohongshuDraft(source);

  assert.equal(result.longformTitle, "十八字以内的小红书发布标题");
  assert.equal(result.publishTitle, result.longformTitle);
  assert.equal(
    result.body,
    "开头正文。\n\n## 一、核心方法\n\n这里是正文重点。\n\n- 第一条\n1. 第二步",
  );
  assert.equal(result.description, "这是发布页使用的正文描述。");
  assert.equal(result.tags, "#AI工具 #开发效率");
  assert.equal(result.counts.tags, 2);
  assert.equal(
    result.counts.publishTitle,
    countPlatformCharacters(result.publishTitle),
  );
  assert.doesNotMatch(result.body, /正文小结|排版风格建议|推荐标签|审稿自查/);
});

test("识别同一行、加粗、编号和冒号形式的摘要与标签", () => {
  const source = `# 可直接发布的小红书长文标题

正文第一段。

3. **正文小结 / 摘要（约250字）：** 这是与标题写在同一行的正文描述。

4. **排版风格建议：** 使用一键排版。

5. **推荐标签：** #AI工具 #开发效率 #内容创作

6. **【审稿自查】**

1. 检查事实。`;

  const result = splitXiaohongshuDraft(source);

  assert.equal(result.body, "正文第一段。");
  assert.equal(result.description, "这是与标题写在同一行的正文描述。");
  assert.equal(result.tags, "#AI工具 #开发效率 #内容创作");
  assert.equal(result.sources.description, "summary");
  assert.equal(result.sources.tags, "generated");
});

test("缺少独立摘要和标签时为05与06提供非空兜底内容", () => {
  const source = `# 可直接发布的小红书长文标题

第一段介绍核心问题。

最后一段总结解决方案和读者可以获得的价值。`;

  const result = splitXiaohongshuDraft(source);

  assert.match(result.description, /最后一段总结/);
  assert.equal(result.counts.tags, 9);
  assert.equal(result.sources.description, "body-fallback");
  assert.equal(result.sources.tags, "default-fallback");
});

test("没有井号的推荐标签也会转换为可粘贴标签", () => {
  const source = `# 可直接发布的小红书长文标题

正文。

## 正文小结 / 摘要
摘要内容。

## 标签推荐：AI工具、开发效率、内容创作`;

  const result = splitXiaohongshuDraft(source);

  assert.equal(result.tags, "#AI工具 #开发效率 #内容创作");
});
