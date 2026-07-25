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

export function getProviderStatus(env = process.env) {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    model: env[provider.modelName] || provider.defaultModel,
    configured: !isPlaceholderKey(env[provider.keyName]),
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

function responseError(label, response, body) {
  const serverMessage =
    body?.error?.message ||
    body?.message ||
    (typeof body?.error === "string" ? body.error : "");

  if (response.status === 401 || response.status === 403) {
    return new Error(`${label} API Key 无效或没有调用权限。`);
  }
  if (
    response.status === 429 ||
    /quota|rate.?limit|resource exhausted/i.test(serverMessage)
  ) {
    return new Error(`${label} 免费额度或速率限制已用尽。`);
  }
  if (response.status >= 500) {
    return new Error(`${label} 服务暂时不可用（HTTP ${response.status}）。`);
  }
  const safeMessage = serverMessage.trim().slice(0, 180);
  return new Error(
    safeMessage
      ? `${label} 请求失败：${safeMessage}`
      : `${label} 请求失败（HTTP ${response.status}）。`,
  );
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
  return { draft: textFromGemini(body), model };
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
      attempts.push({
        provider: provider.id,
        label: provider.label,
        model: status.model,
        status: "skipped",
        message: "本次修复改用其他模型",
      });
      continue;
    }
    if (!status.configured) {
      attempts.push({
        provider: provider.id,
        label: provider.label,
        model: status.model,
        status: "skipped",
        message: `未配置 ${provider.keyName}`,
      });
      continue;
    }

    try {
      const result = await callProvider(provider, {
        prompt,
        key: env[provider.keyName].trim(),
        model: status.model,
        fetchImpl,
        dispatcher,
      });
      if (!result.draft) throw new Error(`${provider.label} 没有返回可用草稿。`);
      attempts.push({
        provider: provider.id,
        label: provider.label,
        model: result.model,
        status: "success",
      });
      return {
        ...result,
        provider: provider.id,
        providerLabel: provider.label,
        attempts,
      };
    } catch (error) {
      const message =
        error?.name === "TimeoutError"
          ? `${provider.label} 请求超时。`
          : error?.message || `${provider.label} 调用失败。`;
      attempts.push({
        provider: provider.id,
        label: provider.label,
        model: status.model,
        status: "failed",
        message,
      });
    }
  }

  const configured = statuses.filter((provider) => provider.configured);
  if (!configured.length) {
    const keyNames = PROVIDERS.map((provider) => provider.keyName).join("、");
    throw new Error(
      `尚未配置任何模型。请在 .env 中至少填写以下一个变量：${keyNames}。`,
    );
  }
  throw new Error(
    `所有已配置服务均调用失败：${attempts
      .filter((attempt) => attempt.status === "failed")
      .map((attempt) => attempt.message)
      .join("；")}`,
  );
}
