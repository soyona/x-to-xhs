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

test("可以保存智谱和硅基流动的 Key 与模型", () => {
  const updates = buildSettingsUpdates({
    providers: {
      zhipu: {
        apiKey: "zhipu-live-key",
        clearKey: false,
        model: "glm-4.7-flash",
      },
      siliconflow: {
        apiKey: "siliconflow-live-key",
        clearKey: false,
        model: "Qwen/Qwen3.5-4B",
      },
    },
  });

  assert.equal(updates.ZHIPU_API_KEY, "zhipu-live-key");
  assert.equal(updates.ZHIPU_MODEL, "glm-4.7-flash");
  assert.equal(updates.SILICONFLOW_API_KEY, "siliconflow-live-key");
  assert.equal(updates.SILICONFLOW_MODEL, "Qwen/Qwen3.5-4B");
});

test("新增默认模型的 API Key 时显式写入对应模型", () => {
  const updates = buildSettingsUpdates(
    {
      providers: {
        zhipu: {
          apiKey: "zhipu-live-key",
          clearKey: false,
          model: "glm-4.7-flash",
        },
        gemini: {
          apiKey: "",
          clearKey: false,
          model: "gemini-3.5-flash",
        },
      },
    },
    {},
  );
  const next = mergeEnvContent("", updates);

  assert.match(next, /^ZHIPU_API_KEY=zhipu-live-key$/m);
  assert.match(next, /^ZHIPU_MODEL=glm-4\.7-flash$/m);
  assert.doesNotMatch(next, /^GEMINI_MODEL=/m);
});

test("已保存 Key 不回显时再次保存仍会补齐默认模型", () => {
  const updates = buildSettingsUpdates(
    {
      providers: {
        zhipu: {
          apiKey: "",
          clearKey: false,
          model: "glm-4.7-flash",
        },
      },
    },
    {
      ZHIPU_API_KEY: "existing-zhipu-key",
    },
  );

  assert.deepEqual(updates, {
    ZHIPU_MODEL: "glm-4.7-flash",
  });
});
