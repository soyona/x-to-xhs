import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkdownBody,
  buildMarkdownFilename,
} from "../src/markdownExport.js";
import { appendSourceAttribution } from "../src/xiaohongshuPublish.js";

test("Markdown 导出正文保留结构并补充文件末尾换行", () => {
  const body = "开头正文。\r\n\r\n## 一、核心方法\r\n\r\n- 第一条";

  assert.equal(
    buildMarkdownBody(body),
    "开头正文。\n\n## 一、核心方法\n\n- 第一条\n",
  );
  assert.equal(buildMarkdownBody(""), "");
});

test("Markdown 导出移除不受支持的成对高亮标记", () => {
  assert.equal(
    buildMarkdownBody("理解 ==ReAct 循环== 的工作方式"),
    "理解 ReAct 循环 的工作方式\n",
  );
  assert.equal(buildMarkdownBody("判断 a == b"), "判断 a == b\n");
  assert.equal(buildMarkdownBody("保留未闭合的 ==标记"), "保留未闭合的 ==标记\n");
});

test("Markdown 文件名使用标题并移除系统非法字符", () => {
  assert.equal(
    buildMarkdownFilename('  Claude / Code: "效率" 指南?  '),
    "小红书长文-Claude Code 效率 指南.md",
  );
  assert.equal(buildMarkdownFilename(""), "小红书长文-未命名.md");
});

test("Markdown 导出保留系统附加的 X 来源", () => {
  const body = appendSourceAttribution("正文。", {
    mode: "x-url",
    sourceUrl: "https://x.com/example/status/123",
    authorHandle: "example",
  });

  assert.match(buildMarkdownBody(body), /资料及观点来源：X @example/);
  assert.match(
    buildMarkdownBody(body),
    /原文链接：https:\/\/x\.com\/example\/status\/123/,
  );
});

test("Markdown 导出为通用网页生成来源说明", () => {
  const body = appendSourceAttribution("正文。", {
    mode: "url",
    sourceUrl: "https://example.com/article",
  });

  assert.match(buildMarkdownBody(body), /资料及观点来源：example\.com/);
  assert.match(buildMarkdownBody(body), /原文链接：https:\/\/example\.com\/article/);
  assert.doesNotMatch(buildMarkdownBody(body), /原帖|X 内容/);
});
