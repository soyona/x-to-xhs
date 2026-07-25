import assert from "node:assert/strict";
import test from "node:test";
import { buildSettingsUpdates, mergeEnvContent } from "../server.mjs";

test("更新 API 配置时保留无关环境变量且不覆盖留空的 Key", () => {
  const current = `CUSTOM_VALUE=keep
GEMINI_API_KEY=old-secret
GEMINI_MODEL=old-model
`;
  const updates = buildSettingsUpdates(
    {
      providers: {
        gemini: {
          apiKey: "",
          clearKey: false,
          model: "gemini-new-model",
        },
      },
    },
    {
      GEMINI_API_KEY: "old-secret",
      GEMINI_MODEL: "old-model",
    },
  );
  const next = mergeEnvContent(current, updates);

  assert.match(next, /CUSTOM_VALUE=keep/);
  assert.match(next, /GEMINI_API_KEY=old-secret/);
  assert.match(next, /GEMINI_MODEL=gemini-new-model/);
});

test("可以替换或清除 Key，且拒绝占位符", () => {
  const replaced = buildSettingsUpdates({
    providers: {
      openrouter: {
        apiKey: "sk-or-new-key",
        clearKey: false,
        model: "openrouter/free",
      },
    },
  });
  assert.equal(replaced.OPENROUTER_API_KEY, "sk-or-new-key");

  const cleared = buildSettingsUpdates({
    providers: {
      groq: {
        apiKey: "",
        clearKey: true,
        model: "qwen/qwen3.6-27b",
      },
    },
  });
  assert.equal(cleared.GROQ_API_KEY, null);

  assert.throws(
    () =>
      buildSettingsUpdates({
        providers: {
          groq: {
            apiKey: "your_groq_api_key_here",
            clearKey: false,
            model: "qwen/qwen3.6-27b",
          },
        },
      }),
    /仍是占位符/,
  );
});
