import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkdownBody,
  buildMarkdownFilename,
} from "../src/markdownExport.js";

test("Markdown 导出正文保留结构并补充文件末尾换行", () => {
  const body = "开头正文。\r\n\r\n## 一、核心方法\r\n\r\n- 第一条";

  assert.equal(
    buildMarkdownBody(body),
    "开头正文。\n\n## 一、核心方法\n\n- 第一条\n",
  );
  assert.equal(buildMarkdownBody(""), "");
});

test("Markdown 文件名使用标题并移除系统非法字符", () => {
  assert.equal(
    buildMarkdownFilename('  Claude / Code: "效率" 指南?  '),
    "小红书长文-Claude Code 效率 指南.md",
  );
  assert.equal(buildMarkdownFilename(""), "小红书长文-未命名.md");
});
