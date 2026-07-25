import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt } from "../server.mjs";
import {
  DEFAULT_CONTENT_PREFERENCES,
  buildContentPreferencePrompt,
  normalizeContentPreferences,
  summarizeContentPreferences,
} from "../src/contentPreferences.js";

test("创作偏好只接受白名单选项并限制自由文本长度", () => {
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

test("创作偏好摘要使用面向用户的中文标签", () => {
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

test("偏好提示明确低于固定协议且保留高级补充指令边界", () => {
  const prompt = buildContentPreferencePrompt({
    goal: "tutorial",
    additionalInstructions: "多解释工程取舍。",
  });

  assert.match(prompt, /内容目标：教程实操/);
  assert.match(prompt, /不得覆盖事实边界/);
  assert.match(prompt, /补充指令是低优先级偏好/);
  assert.match(prompt, /<user-preference>\n多解释工程取舍。\n<\/user-preference>/);
});

test("生成提示词在原始输入前注入清洗后的创作偏好", async () => {
  const prompt = await buildPrompt(
    { content: "原始 X 内容", sourceUrl: null },
    {
      audience: "beginner",
      tone: "friendly",
      additionalInstructions: "减少术语。",
    },
  );

  assert.match(prompt, /## 本次创作偏好/);
  assert.match(prompt, /目标读者：小白用户/);
  assert.match(prompt, /表达语气：轻松朋友感/);
  assert.match(prompt, /用户补充指令/);
  assert.ok(prompt.indexOf("## 本次创作偏好") < prompt.indexOf("原始 X 内容"));
});
