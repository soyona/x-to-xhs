const REQUEST_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_TOKENS = 14_000;

export const PROVIDERS = [
  {
    id: "gemini",
    label: "Gemini",
    keyName: "GEMINI_API_KEY",
    modelName: "GEMINI_MODEL",
    defaultModel: "gemini-3.5-flash",
  },
  {
    id: "groq",
    label: "Groq Qwen",
    keyName: "GROQ_API_KEY",
    modelName: "GROQ_MODEL",
    defaultModel: "qwen/qwen3.6-27b",
    url: "https://api.groq.com/openai/v1/chat/completions",
    extraBody: { reasoning_format: "hidden" },
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    keyName: "ZHIPU_API_KEY",
    modelName: "ZHIPU_MODEL",
    defaultModel: "glm-4.7-flash",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  },
  {
    id: "siliconflow",
    label: "硅基流动 Qwen",
    keyName: "SILICONFLOW_API_KEY",
    modelName: "SILICONFLOW_MODEL",
    defaultModel: "Qwen/Qwen3.5-4B",
    url: "https://api.siliconflow.cn/v1/chat/completions",
  },
  {
    id: "openrouter",
    label: "OpenRouter Free",
    keyName: "OPENROUTER_API_KEY",
    modelName: "OPENROUTER_MODEL",
    defaultModel: "openrouter/free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    extraHeaders: { "X-Title": "X to Xiaohongshu" },
  },
];

export function isPlaceholderKey(value = "") {
  const key = value.trim();
  return (
    !key ||
    /^your[_-].*[_-](?:key|token)[_-]here$/i.test(key) ||
    /^(?:replace|change)[_-]?me$/i.test(key)
  );
}

function getProviderKeys(provider, env) {
  const value = env[provider.keyName];
  if (typeof value !== "string") return [];
  const keys =
    provider.id === "gemini"
      ? value.split(",").map((key) => key.trim())
      : [value.trim()];
  return keys.filter((key) => !isPlaceholderKey(key));
}

export function getProviderStatus(env = process.env) {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    model: env[provider.modelName] || provider.defaultModel,
    configured: getProviderKeys(provider, env).length > 0,
  }));
}

function textFromGemini(body) {
  return (body.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function textFromChatCompletion(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function cleanTokenCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : null;
}

function tokenUsage({ input, output, total }) {
  const cleanedInput = cleanTokenCount(input);
  const cleanedOutput = cleanTokenCount(output);
  const cleanedTotal =
    cleanTokenCount(total) ??
    (cleanedInput !== null && cleanedOutput !== null
      ? cleanedInput + cleanedOutput
      : null);
  if (
    cleanedInput === null &&
    cleanedOutput === null &&
    cleanedTotal === null
  ) {
    return null;
  }
  return {
    input: cleanedInput,
    output: cleanedOutput,
    total: cleanedTotal,
  };
}

function tokenUsageFromGemini(body) {
  const usage = body?.usageMetadata;
  return tokenUsage({
    input: usage?.promptTokenCount,
    output: usage?.candidatesTokenCount,
    total: usage?.totalTokenCount,
  });
}

function tokenUsageFromChatCompletion(body) {
  const usage = body?.usage;
  return tokenUsage({
    input: usage?.prompt_tokens,
    output: usage?.completion_tokens,
    total: usage?.total_tokens,
  });
}

function responseError(label, response, body) {
  const serverMessage =
    body?.error?.message ||
    body?.message ||
    (typeof body?.error === "string" ? body.error : "");

  if (response.status === 401 || response.status === 403) {
    const error = new Error(`${label} API Key 无效或没有调用权限。`);
    error.code = "PROVIDER_AUTH_FAILED";
    error.statusCode = response.status;
    return error;
  }
  if (
    response.status === 429 ||
    /quota|rate.?limit|resource exhausted/i.test(serverMessage)
  ) {
    const error = new Error(`${label} 免费额度或速率限制已用尽。`);
    error.code = "PROVIDER_QUOTA_EXHAUSTED";
    error.statusCode = response.status;
    return error;
  }
  if (response.status >= 500) {
    const error = new Error(
      `${label} 服务暂时不可用（HTTP ${response.status}）。`,
    );
    error.code = "PROVIDER_UNAVAILABLE";
    error.statusCode = response.status;
    return error;
  }
  const safeMessage = serverMessage.trim().slice(0, 180);
  const error = new Error(
    safeMessage
      ? `${label} 请求失败：${safeMessage}`
      : `${label} 请求失败（HTTP ${response.status}）。`,
  );
  error.code = "PROVIDER_REQUEST_FAILED";
  error.statusCode = response.status;
  return error;
}

function failureSummary(error, label) {
  if (error?.name === "TimeoutError") {
    return {
      reason: "timeout",
      message: `${label} 请求超时。`,
      statusCode: null,
    };
  }

  const summaries = {
    PROVIDER_AUTH_FAILED: {
      reason: "auth",
      message: `${label} Key 无效或没有调用权限。`,
    },
    PROVIDER_QUOTA_EXHAUSTED: {
      reason: "quota",
      message: `${label} 额度或速率限制已用尽。`,
    },
    PROVIDER_UNAVAILABLE: {
      reason: "unavailable",
      message: `${label} 服务暂时不可用。`,
    },
    PROVIDER_EMPTY_RESPONSE: {
      reason: "empty",
      message: `${label} 没有返回可用内容。`,
    },
    PROVIDER_REQUEST_FAILED: {
      reason: "request",
      message: `${label} 请求失败。`,
    },
  };
  const summary = summaries[error?.code] || {
    reason: "unknown",
    message: `${label} 调用失败。`,
  };
  return {
    ...summary,
    statusCode: Number.isInteger(error?.statusCode)
      ? error.statusCode
      : null,
  };
}

function attemptRecord({
  provider,
  model,
  status,
  startedAt,
  keyIndex = null,
  keyCount = null,
  error,
  message,
}) {
  const failure =
    status === "failed" ? failureSummary(error, provider.label) : null;
  return {
    provider: provider.id,
    label: provider.label,
    model,
    status,
    reason: failure?.reason || null,
    message: failure?.message || message || null,
    statusCode: failure?.statusCode || null,
    keyIndex,
    keyCount,
    durationMs:
      Number.isFinite(startedAt) && status !== "skipped"
        ? Math.max(0, Date.now() - startedAt)
        : null,
  };
}

async function requestJson(url, options, label, fetchImpl, dispatcher) {
  const response = await fetchImpl(url, {
    ...options,
    dispatcher,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw responseError(label, response, body);
  return body;
}

async function callGemini({
  prompt,
  key,
  model,
  fetchImpl,
  dispatcher,
}) {
  const body = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        },
      }),
    },
    "Gemini",
    fetchImpl,
    dispatcher,
  );
  return {
    draft: textFromGemini(body),
    model,
    usage: tokenUsageFromGemini(body),
  };
}

async function callChatCompletion({
  url,
  label,
  prompt,
  key,
  model,
  fetchImpl,
  dispatcher,
  extraBody,
  extraHeaders,
}) {
  const body = await requestJson(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        ...extraBody,
      }),
    },
    label,
    fetchImpl,
    dispatcher,
  );
  return {
    draft: textFromChatCompletion(body),
    model: typeof body.model === "string" ? body.model : model,
    usage: tokenUsageFromChatCompletion(body),
  };
}

async function callProvider(provider, options) {
  if (provider.id === "gemini") return callGemini(options);
  if (!provider.url) throw new Error(`${provider.label} 缺少请求地址。`);
  return callChatCompletion({
    ...options,
    url: provider.url,
    label: provider.label,
    extraBody: provider.extraBody,
    extraHeaders: provider.extraHeaders,
  });
}

export async function generateWithFallback({
  prompt,
  env = process.env,
  fetchImpl = fetch,
  dispatcher,
  skipProviders = [],
}) {
  const statuses = getProviderStatus(env);
  const attempts = [];
  const skippedProviders = new Set(skipProviders);

  for (const [index, provider] of PROVIDERS.entries()) {
    const status = statuses[index];
    if (skippedProviders.has(provider.id)) {
      attempts.push(attemptRecord({
        provider,
        model: status.model,
        status: "skipped",
        message: "本次修复改用其他模型",
      }));
      continue;
    }
    if (!status.configured) {
      attempts.push(attemptRecord({
        provider,
        model: status.model,
        status: "skipped",
        message: `未配置 ${provider.keyName}`,
      }));
      continue;
    }

    try {
      const keys = getProviderKeys(provider, env);
      let result;
      for (const [keyIndex, key] of keys.entries()) {
        const startedAt = Date.now();
        try {
          result = await callProvider(provider, {
            prompt,
            key,
            model: status.model,
            fetchImpl,
            dispatcher,
          });
          if (!result.draft) {
            const error = new Error(`${provider.label} 没有返回可用草稿。`);
            error.code = "PROVIDER_EMPTY_RESPONSE";
            throw error;
          }
          attempts.push(attemptRecord({
            provider,
            model: result.model,
            status: "success",
            startedAt,
            keyIndex: provider.id === "gemini" ? keyIndex + 1 : null,
            keyCount: provider.id === "gemini" ? keys.length : null,
            message: "生成成功",
          }));
          break;
        } catch (error) {
          attempts.push(attemptRecord({
            provider,
            model: status.model,
            status: "failed",
            startedAt,
            keyIndex: provider.id === "gemini" ? keyIndex + 1 : null,
            keyCount: provider.id === "gemini" ? keys.length : null,
            error,
          }));
          const hasNextGeminiKey =
            provider.id === "gemini" &&
            [
              "PROVIDER_AUTH_FAILED",
              "PROVIDER_QUOTA_EXHAUSTED",
            ].includes(error?.code) &&
            keyIndex < keys.length - 1;
          if (!hasNextGeminiKey) throw error;
        }
      }
      return {
        ...result,
        provider: provider.id,
        providerLabel: provider.label,
        attempts,
      };
    } catch (error) {
      const lastAttempt = attempts.at(-1);
      if (
        lastAttempt?.provider !== provider.id ||
        lastAttempt.status !== "failed"
      ) {
        attempts.push(attemptRecord({
          provider,
          model: status.model,
          status: "failed",
          startedAt: Date.now(),
          error,
        }));
      }
    }
  }

  const configured = statuses.filter((provider) => provider.configured);
  if (!configured.length) {
    const keyNames = PROVIDERS.map((provider) => provider.keyName).join("、");
    throw new Error(
      `尚未配置任何模型。请在 .env 中至少填写以下一个变量：${keyNames}。`,
    );
  }
  const error = new Error(
    `所有已配置服务均调用失败：${attempts
      .filter((attempt) => attempt.status === "failed")
      .map((attempt) => attempt.message)
      .join("；")}`,
  );
  error.attempts = attempts;
  throw error;
}
