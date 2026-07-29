import assert from "node:assert/strict";
import test from "node:test";
import {
  generateWithFallback,
  getProviderStatus,
  isPlaceholderKey,
} from "../providers.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("服务状态保持五家模型的固定降级顺序", () => {
  const providers = getProviderStatus({
    GEMINI_API_KEY: "gemini-key",
    GROQ_MODEL: "custom-qwen",
  });

  assert.deepEqual(
    providers.map(({ id, model, configured }) => ({ id, model, configured })),
    [
      { id: "gemini", model: "gemini-3.5-flash", configured: true },
      { id: "groq", model: "custom-qwen", configured: false },
      { id: "zhipu", model: "glm-4.7-flash", configured: false },
      {
        id: "siliconflow",
        model: "Qwen/Qwen3.5-4B",
        configured: false,
      },
      { id: "openrouter", model: "openrouter/free", configured: false },
    ],
  );
});

test("占位符 API Key 不会被误判为已配置", () => {
  assert.equal(isPlaceholderKey("your_groq_api_key_here"), true);
  assert.equal(isPlaceholderKey("replace_me"), true);
  assert.equal(isPlaceholderKey("gsk_live_real_key"), false);
  assert.equal(
    getProviderStatus({ GROQ_API_KEY: "your_groq_api_key_here" })[1]
      .configured,
    false,
  );
});

test("Gemini 成功时不调用后备服务", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      ZHIPU_API_KEY: "zhipu-key",
      SILICONFLOW_API_KEY: "siliconflow-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "# Gemini 草稿" }] } }],
        usageMetadata: {
          promptTokenCount: 1_200,
          candidatesTokenCount: 800,
          totalTokenCount: 2_000,
        },
      });
    },
  });

  assert.equal(result.provider, "gemini");
  assert.equal(result.draft, "# Gemini 草稿");
  assert.equal(result.attempts.length, 1);
  assert.deepEqual(result.usage, {
    input: 1_200,
    output: 800,
    total: 2_000,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(calls[0].options.headers["x-goog-api-key"], "gemini-key");
});

test("Gemini 当前 Key 额度用尽后按配置顺序尝试下一个 Key", async () => {
  const keys = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key-a, gemini-key-b",
      GROQ_API_KEY: "groq-key",
    },
    fetchImpl: async (_url, options) => {
      keys.push(options.headers["x-goog-api-key"]);
      if (keys.length === 1) {
        return jsonResponse(
          { error: { message: "RESOURCE_EXHAUSTED" } },
          429,
        );
      }
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "# Gemini B 草稿" }] } }],
      });
    },
  });

  assert.equal(result.provider, "gemini");
  assert.equal(result.draft, "# Gemini B 草稿");
  assert.deepEqual(keys, ["gemini-key-a", "gemini-key-b"]);
  assert.deepEqual(
    result.attempts.map(
      ({ provider, status, reason, keyIndex, keyCount }) => ({
        provider,
        status,
        reason,
        keyIndex,
        keyCount,
      }),
    ),
    [
      {
        provider: "gemini",
        status: "failed",
        reason: "quota",
        keyIndex: 1,
        keyCount: 2,
      },
      {
        provider: "gemini",
        status: "success",
        reason: null,
        keyIndex: 2,
        keyCount: 2,
      },
    ],
  );
});

test("Gemini 当前 Key 无效时继续尝试下一个 Key", async () => {
  const keys = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key-a,gemini-key-b",
      GROQ_API_KEY: "groq-key",
    },
    fetchImpl: async (_url, options) => {
      keys.push(options.headers["x-goog-api-key"]);
      if (keys.length === 1) {
        return jsonResponse({ error: { message: "invalid key" } }, 401);
      }
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "# Gemini B 草稿" }] } }],
      });
    },
  });

  assert.equal(result.provider, "gemini");
  assert.deepEqual(keys, ["gemini-key-a", "gemini-key-b"]);
  assert.equal(result.attempts[0].reason, "auth");
  assert.equal(result.attempts[1].status, "success");
});

test("Gemini 所有 Key 额度用尽后才切换到 Groq Qwen", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key-a,gemini-key-b",
      GROQ_API_KEY: "groq-key",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, key: options.headers["x-goog-api-key"] });
      if (calls.length <= 2) {
        return jsonResponse({ error: { message: "quota exceeded" } }, 429);
      }
      return jsonResponse({
        model: "qwen/qwen3.6-27b",
        choices: [{ message: { content: "# Groq 草稿" } }],
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.deepEqual(
    calls.slice(0, 2).map(({ key }) => key),
    ["gemini-key-a", "gemini-key-b"],
  );
  assert.match(calls[2].url, /api\.groq\.com/);
  assert.deepEqual(
    result.attempts.map(({ provider, status, keyIndex }) => ({
      provider,
      status,
      keyIndex,
    })),
    [
      { provider: "gemini", status: "failed", keyIndex: 1 },
      { provider: "gemini", status: "failed", keyIndex: 2 },
      { provider: "groq", status: "success", keyIndex: null },
    ],
  );
});

test("Gemini 非额度错误不尝试下一个 Key，直接沿用模型降级", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key-a,gemini-key-b",
      GROQ_API_KEY: "groq-key",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, key: options.headers["x-goog-api-key"] });
      if (calls.length === 1) {
        return jsonResponse({ error: { message: "temporary error" } }, 503);
      }
      return jsonResponse({
        model: "qwen/qwen3.6-27b",
        choices: [{ message: { content: "# Groq 草稿" } }],
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.deepEqual(calls.map(({ key }) => key), ["gemini-key-a", undefined]);
  assert.match(calls[1].url, /api\.groq\.com/);
});

test("Gemini 限流后自动切换到 Groq Qwen", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      ZHIPU_API_KEY: "zhipu-key",
      SILICONFLOW_API_KEY: "siliconflow-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return jsonResponse({ error: { message: "quota exceeded" } }, 429);
      }
      return jsonResponse({
        model: "qwen/qwen3.6-27b",
        choices: [{ message: { content: "# Groq 草稿" } }],
        usage: {
          prompt_tokens: 900,
          completion_tokens: 600,
          total_tokens: 1_500,
        },
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.equal(result.draft, "# Groq 草稿");
  assert.deepEqual(result.usage, {
    input: 900,
    output: 600,
    total: 1_500,
  });
  assert.deepEqual(
    result.attempts.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "gemini", status: "failed" },
      { provider: "groq", status: "success" },
    ],
  );
  assert.match(calls[1], /api\.groq\.com/);
});

test("调用方可以指定跳过某个模型", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "重新生成提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      ZHIPU_API_KEY: "zhipu-key",
      SILICONFLOW_API_KEY: "siliconflow-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    skipProviders: ["gemini"],
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({
        model: "qwen/qwen3.6-27b",
        choices: [{ message: { content: "# Groq 生成稿" } }],
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.equal(result.usage, null);
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.attempts.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "gemini", status: "skipped" },
      { provider: "groq", status: "success" },
    ],
  );
});

test("Gemini 和 Groq 失败后由智谱 GLM 接续", async () => {
  let callCount = 0;
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      ZHIPU_API_KEY: "zhipu-key",
    },
    fetchImpl: async (url) => {
      callCount += 1;
      if (callCount < 3) {
        return jsonResponse({ error: { message: "temporary error" } }, 503);
      }
      assert.match(url, /open\.bigmodel\.cn/);
      return jsonResponse({
        model: "glm-4.7-flash",
        choices: [{ message: { content: "# 智谱草稿" } }],
      });
    },
  });

  assert.equal(result.provider, "zhipu");
  assert.equal(result.model, "glm-4.7-flash");
  assert.equal(result.draft, "# 智谱草稿");
  assert.equal(callCount, 3);
});

test("智谱失败后由硅基流动 Qwen 接续", async () => {
  let callCount = 0;
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      ZHIPU_API_KEY: "zhipu-key",
      SILICONFLOW_API_KEY: "siliconflow-key",
    },
    fetchImpl: async (url) => {
      callCount += 1;
      if (callCount === 1) {
        return jsonResponse({ error: { message: "temporary error" } }, 503);
      }
      assert.match(url, /api\.siliconflow\.cn/);
      return jsonResponse({
        model: "Qwen/Qwen3.5-4B",
        choices: [{ message: { content: "# 硅基流动草稿" } }],
      });
    },
  });

  assert.equal(result.provider, "siliconflow");
  assert.equal(result.model, "Qwen/Qwen3.5-4B");
  assert.equal(result.draft, "# 硅基流动草稿");
  assert.equal(callCount, 2);
});

test("前四家失败后由 OpenRouter Free 兜底并返回实际模型", async () => {
  let callCount = 0;
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      ZHIPU_API_KEY: "zhipu-key",
      SILICONFLOW_API_KEY: "siliconflow-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    fetchImpl: async () => {
      callCount += 1;
      if (callCount < 5) {
        return jsonResponse({ error: { message: "temporary error" } }, 503);
      }
      return jsonResponse({
        model: "vendor/free-model",
        choices: [{ message: { content: "# OpenRouter 草稿" } }],
      });
    },
  });

  assert.equal(result.provider, "openrouter");
  assert.equal(result.model, "vendor/free-model");
  assert.equal(result.attempts.at(-1).status, "success");
  assert.equal(
    result.attempts.filter((attempt) => attempt.status === "failed").length,
    4,
  );
  assert.equal(callCount, 5);
});

test("所有服务失败时返回脱敏的逐次尝试详情", async () => {
  let caught;
  try {
    await generateWithFallback({
      prompt: "完整提示词",
      env: {
        GEMINI_API_KEY: "gemini-key-a,gemini-key-b",
        GROQ_API_KEY: "groq-key",
      },
      fetchImpl: async () =>
        jsonResponse({ error: { message: "quota exceeded" } }, 429),
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  assert.equal(caught.attempts.length, 6);
  assert.deepEqual(
    caught.attempts
      .filter((attempt) => attempt.provider === "gemini")
      .map(({ status, reason, keyIndex, keyCount }) => ({
        status,
        reason,
        keyIndex,
        keyCount,
      })),
    [
      {
        status: "failed",
        reason: "quota",
        keyIndex: 1,
        keyCount: 2,
      },
      {
        status: "failed",
        reason: "quota",
        keyIndex: 2,
        keyCount: 2,
      },
    ],
  );
  assert.doesNotMatch(JSON.stringify(caught.attempts), /gemini-key|groq-key/);
});

test("未配置任何 API Key 时给出明确提示且不发请求", async () => {
  let called = false;

  await assert.rejects(
    generateWithFallback({
      prompt: "完整提示词",
      env: {},
      fetchImpl: async () => {
        called = true;
        return jsonResponse({});
      },
    }),
    /至少填写以下一个变量：.*ZHIPU_API_KEY.*SILICONFLOW_API_KEY/,
  );
  assert.equal(called, false);
});
