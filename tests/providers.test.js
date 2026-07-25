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

test("服务状态保持 Gemini、Groq Qwen、OpenRouter Free 的固定顺序", () => {
  const providers = getProviderStatus({
    GEMINI_API_KEY: "gemini-key",
    GROQ_MODEL: "custom-qwen",
  });

  assert.deepEqual(
    providers.map(({ id, model, configured }) => ({ id, model, configured })),
    [
      { id: "gemini", model: "gemini-3.5-flash", configured: true },
      { id: "groq", model: "custom-qwen", configured: false },
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
      OPENROUTER_API_KEY: "openrouter-key",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "# Gemini 草稿" }] } }],
      });
    },
  });

  assert.equal(result.provider, "gemini");
  assert.equal(result.draft, "# Gemini 草稿");
  assert.equal(result.attempts.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(calls[0].options.headers["x-goog-api-key"], "gemini-key");
});

test("Gemini 限流后自动切换到 Groq Qwen", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
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
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.equal(result.draft, "# Groq 草稿");
  assert.deepEqual(
    result.attempts.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "gemini", status: "failed" },
      { provider: "groq", status: "success" },
    ],
  );
  assert.match(calls[1], /api\.groq\.com/);
});

test("第二次修复可跳过上一次成功的模型", async () => {
  const calls = [];
  const result = await generateWithFallback({
    prompt: "修复提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    skipProviders: ["gemini"],
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({
        model: "qwen/qwen3.6-27b",
        choices: [{ message: { content: "# Groq 修复稿" } }],
      });
    },
  });

  assert.equal(result.provider, "groq");
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.attempts.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "gemini", status: "skipped" },
      { provider: "groq", status: "success" },
    ],
  );
});

test("前两家失败后由 OpenRouter Free 兜底并返回实际模型", async () => {
  let callCount = 0;
  const result = await generateWithFallback({
    prompt: "完整提示词",
    env: {
      GEMINI_API_KEY: "gemini-key",
      GROQ_API_KEY: "groq-key",
      OPENROUTER_API_KEY: "openrouter-key",
    },
    fetchImpl: async () => {
      callCount += 1;
      if (callCount < 3) {
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
  assert.equal(callCount, 3);
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
    /至少填写 GEMINI_API_KEY、GROQ_API_KEY 或 OPENROUTER_API_KEY/,
  );
  assert.equal(called, false);
});
