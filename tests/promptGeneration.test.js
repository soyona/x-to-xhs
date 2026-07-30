import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt } from "../server.mjs";

test("整稿生成只使用当前提示词方案和结构化来源信息", async () => {
  const prompt = await buildPrompt(
    {
      mode: "x-content",
      content: "原始 X 内容",
      sourceUrl: null,
      authorHandle: null,
      authorName: null,
    },
    {
      modules: {
        global: "全局事实边界",
        title: "标题规则",
        body: "正文规则",
        summary: "摘要规则",
        tags: "标签规则",
        output: "固定输出协议",
      },
    },
  );

  assert.match(prompt, /全局事实边界/);
  assert.match(prompt, /source_mode: x-content/);
  assert.match(
    prompt,
    /<source_content>\s*原始 X 内容\s*<\/source_content>/,
  );
  assert.doesNotMatch(prompt, /本次快速设置|表达偏好|目标读者/);
});
