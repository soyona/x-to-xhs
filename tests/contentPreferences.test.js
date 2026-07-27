import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt } from "../server.mjs";
import {
  DEFAULT_CONTENT_PREFERENCES,
  buildContentPreferencePrompt,
  normalizeContentPreferences,
  summarizeContentPreferences,
} from "../src/contentPreferences.js";

test("快速设置只接受白名单选项并限制兼容字段长度", () => {
  const normalized = normalizeContentPreferences({
    audience: "unknown",
    tone: "direct",
    authorPersona: `产品作者\n${"a".repeat(120)}`,
    bannedPhrases: "封神",
    additionalInstructions: "b".repeat(600),
  });

  assert.equal(normalized.audience, DEFAULT_CONTENT_PREFERENCES.audience);
  assert.equal(normalized.tone, "direct");
  assert.equal(normalized.authorPersona.includes("\n"), false);
  assert.equal(normalized.authorPersona.length, 100);
  assert.equal(normalized.bannedPhrases, "封神");
  assert.equal(normalized.additionalInstructions.length, 500);
});

test("快速设置摘要使用面向用户的中文标签", () => {
  assert.equal(
    summarizeContentPreferences({
      audience: "professional",
      tone: "rational",
      depth: "deep",
      emoji: "minimal",
    }),
    "专业人士 · 理性克制 · 深度 · 极少",
  );
});

test("快速设置覆盖同类软偏好且保留旧版补充指令边界", () => {
  const prompt = buildContentPreferencePrompt({
    goal: "tutorial",
    additionalInstructions: "多解释工程取舍。",
  });

  assert.match(prompt, /内容目标：教程实操/);
  assert.match(prompt, /同类软性表达偏好冲突时，以本次快速设置为准/);
  assert.match(prompt, /不得覆盖事实边界/);
  assert.match(prompt, /旧版补充指令仍按低优先级兼容/);
  assert.match(prompt, /<user-preference>\n多解释工程取舍。\n<\/user-preference>/);
});

test("生成提示词在原始输入前注入清洗后的快速设置", async () => {
  const prompt = await buildPrompt(
    { content: "原始 X 内容", sourceUrl: null },
    {
      audience: "beginner",
      tone: "friendly",
      additionalInstructions: "减少术语。",
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

  assert.match(prompt, /## 本次快速设置/);
  assert.match(prompt, /目标读者：小白用户/);
  assert.match(prompt, /表达语气：轻松朋友感/);
  assert.match(prompt, /用户补充指令/);
  assert.ok(
    prompt.indexOf("## 本次快速设置") <
      prompt.indexOf("**本次要转化的X推文内容如下：**"),
  );
});
