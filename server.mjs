import { createServer } from "node:http";
import { chmod, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent } from "undici";
import { createHistoryStore } from "./historyStore.mjs";
import {
  generateWithFallback,
  getProviderStatus,
  isPlaceholderKey,
  PROVIDERS,
} from "./providers.mjs";
import {
  buildContentPreferencePrompt,
  normalizeContentPreferences,
} from "./src/contentPreferences.js";
import {
  buildSectionGenerationPrompt,
  parseSectionCandidates,
  validateSectionCandidates,
} from "./src/sectionGeneration.js";
import { validateDraft } from "./src/validation.js";
import { splitXiaohongshuDraft } from "./src/xiaohongshuPublish.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

async function loadLocalEnv() {
  try {
    const envFile = await readFile(join(rootDir, ".env"), "utf8");
    for (const rawLine of envFile.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();

const port = Number(process.env.PORT || 8787);
const serverHost = process.env.X_TO_XHS_HOST || "127.0.0.1";
const bodyLimit = 64 * 1024;
const proxyUrl =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
const externalDispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const envPath = join(rootDir, ".env");
const historyDataDir = resolve(
  rootDir,
  process.env.X_TO_XHS_DATA_DIR || ".local-data",
);
const historyStore = createHistoryStore({ dataDir: historyDataDir });

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function settingsResponse() {
  const providers = getProviderStatus();
  return {
    ok: true,
    configured: providers.some((provider) => provider.configured),
    providers,
  };
}

function serializeEnvValue(value) {
  return /^[A-Za-z0-9._:/+@-]+$/u.test(value)
    ? value
    : JSON.stringify(value);
}

export function mergeEnvContent(current = "", updates = {}) {
  const managedKeys = new Set(Object.keys(updates));
  const seen = new Set();
  const lines = current.split(/\r?\n/).filter((line) => {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match || !managedKeys.has(match[1])) return true;
    const key = match[1];
    if (seen.has(key)) return false;
    seen.add(key);
    return updates[key] !== null;
  });

  const output = lines.map((line) => {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match || !managedKeys.has(match[1])) return line;
    return `${match[1]}=${serializeEnvValue(updates[match[1]])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key) && value !== null) {
      output.push(`${key}=${serializeEnvValue(value)}`);
    }
  }

  return `${output.join("\n").replace(/\n+$/u, "")}\n`;
}

function cleanSetting(value, label, { required = false, max = 1000 } = {}) {
  if (typeof value !== "string") {
    if (!required && value == null) return "";
    throw new Error(`${label} 格式无效。`);
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`请填写 ${label}。`);
  if (/[\r\n]/u.test(cleaned)) throw new Error(`${label} 不能包含换行。`);
  if (cleaned.length > max) throw new Error(`${label} 内容过长。`);
  return cleaned;
}

export function buildSettingsUpdates(payload = {}, env = process.env) {
  if (!payload.providers || typeof payload.providers !== "object") {
    throw new Error("API 配置格式无效。");
  }

  const updates = {};
  for (const provider of PROVIDERS) {
    const setting = payload.providers[provider.id];
    if (!setting || typeof setting !== "object") continue;

    const apiKey = cleanSetting(
      setting.apiKey,
      `${provider.label} API Key`,
    );
    const model = cleanSetting(
      setting.model,
      `${provider.label} 模型`,
      { required: true, max: 200 },
    );

    if (apiKey && isPlaceholderKey(apiKey)) {
      throw new Error(`${provider.label} API Key 仍是占位符，请填写真实 Key。`);
    }

    if (setting.clearKey === true) {
      updates[provider.keyName] = null;
    } else if (apiKey) {
      updates[provider.keyName] = apiKey;
    }
    const hasStoredKey = !isPlaceholderKey(env[provider.keyName]);
    if (
      (setting.clearKey !== true && (apiKey || hasStoredKey)) ||
      model !== (env[provider.modelName] || provider.defaultModel)
    ) {
      updates[provider.modelName] = model;
    }
  }
  return updates;
}

async function saveSettings(payload) {
  const updates = buildSettingsUpdates(payload);
  const current = await readFile(envPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  const next = mergeEnvContent(current, updates);
  const temporaryPath = join(
    rootDir,
    `.env.tmp-${process.pid}-${Date.now()}`,
  );

  await writeFile(temporaryPath, next, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, envPath);
  await chmod(envPath, 0o600);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  return settingsResponse();
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > bodyLimit) {
      throw new Error("输入内容过长。");
    }
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("请求格式无效。");
  }
}

function isXUrl(value) {
  try {
    const url = new URL(value.trim());
    return (
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname.toLowerCase(),
      ) && /^\/[^/]+\/status\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&mdash;", "—")
    .replaceAll("&ndash;", "–")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function resolveSource(input) {
  const trimmed = input?.trim();
  if (!trimmed) throw new Error("请先粘贴 X 帖子内容或 URL。");
  if (!isXUrl(trimmed)) {
    return { content: trimmed, sourceUrl: null, resolved: false };
  }

  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", trimmed);
  endpoint.searchParams.set("omit_script", "true");
  endpoint.searchParams.set("dnt", "true");

  const result = await fetch(endpoint, {
    headers: { "User-Agent": "x-to-xhs-local/1.0" },
    dispatcher: externalDispatcher,
    signal: AbortSignal.timeout(15_000),
  });
  if (!result.ok) {
    throw new Error(
      `无法读取这个 X URL（HTTP ${result.status}）。请改为粘贴完整帖子内容。`,
    );
  }

  const data = await result.json();
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(data.html || "")?.[1];
  const content = htmlToText(paragraph || data.html || "");
  if (!content) {
    throw new Error("X URL 没有返回可转换的正文，请改为粘贴完整帖子内容。");
  }
  if (/^(?:https:\/\/t\.co\/\w+\s*)+$/i.test(content)) {
    throw new Error(
      "这个 X 链接只返回了短链，无法可靠读取长文正文。请改为粘贴完整内容。",
    );
  }
  return { content, sourceUrl: trimmed, resolved: true };
}

export async function buildPrompt(source, preferences = {}) {
  const spec = await readFile(join(rootDir, "Long-form-post-prompt.md"), "utf8");
  const replacement = source.sourceUrl
    ? `${source.content}\n\n原始链接：${source.sourceUrl}`
    : source.content;
  const placeholder = "[在此直接粘贴X推文链接 或 完整推文内容]";
  const inputHeading = "**本次要转化的X推文内容如下：**";

  if (!spec.includes(placeholder)) {
    throw new Error("Markdown 规范中缺少输入占位符，无法安全组装提示词。");
  }
  if (!spec.includes(inputHeading)) {
    throw new Error("Markdown 规范中缺少输入分区，无法安全注入创作偏好。");
  }
  const preferencePrompt = buildContentPreferencePrompt(
    normalizeContentPreferences(preferences),
  );
  return spec
    .replace(inputHeading, `${preferencePrompt}\n\n${inputHeading}`)
    .replace(placeholder, replacement);
}

function formatChecks(checks = []) {
  return checks
    .map(
      (check, index) =>
        `${index + 1}. ${check.label}：当前${check.actual}，要求${check.requirement}`,
    )
    .join("\n");
}

export async function buildRepairPrompt({
  input,
  draft,
  failedChecks = [],
  passedChecks = [],
  mode,
  preferences = {},
}) {
  const source = await resolveSource(input);
  const basePrompt = await buildPrompt(source, preferences);
  const failedList = formatChecks(failedChecks);
  const passedList = passedChecks.length
    ? passedChecks.map((check) => `- ${check.label}：${check.actual}`).join("\n")
    : "- 无";
  const modeInstruction = {
    repair:
      "只修复失败项目。必须保留已经通过的内容、事实、案例和主要表达，不得无关改写。",
    revise:
      "对全文进行结构化修订，优先保留可用内容，同时统一修正失败的结构与篇幅项目。",
    regenerate:
      "当前草稿整体不合格。放弃其不完整结构，重新根据原始 X 内容生成一份完整合格的长文。",
  }[mode];

  if (!modeInstruction) throw new Error("修复模式无效。");

  return `${basePrompt}

---

## 本次规范修复任务

${modeInstruction}

未通过项目：
${failedList || "- 未提供"}

已经通过、不得破坏的项目：
${passedList}

${
  mode === "regenerate"
    ? "不要复用下面草稿的不完整结构，仅把它作为失败参考。"
    : "请以当前草稿为基础进行修复。"
}

当前草稿：
\`\`\`markdown
${draft}
\`\`\`

只输出修复后的完整 Markdown 草稿，不要解释修改过程，不要输出前后对比。`;
}

async function generateDraft(
  input,
  { skipProviders = [], preferences = {} } = {},
) {
  const source = await resolveSource(input);
  const normalizedPreferences = normalizeContentPreferences(preferences);
  const prompt = await buildPrompt(source, preferences);
  const result = await generateWithFallback({
    prompt,
    dispatcher: externalDispatcher,
    skipProviders,
  });
  try {
    const record = await historyStore.create({
      source,
      draft: result.draft,
      preferences: normalizedPreferences,
      generation: result,
      validation: validateDraft(result.draft),
    });
    return {
      ...result,
      source,
      historyId: record.id,
      historyVersion: record.currentVersion,
    };
  } catch (error) {
    return {
      ...result,
      source,
      historyWarning: error.message,
    };
  }
}

async function repairDraft(payload) {
  const {
    input,
    draft,
    failedChecks,
    passedChecks,
    mode,
    skipProvider,
    preferences,
    historyId,
    historyVersion,
  } = payload;
  if (!input?.trim()) throw new Error("缺少原始 X 内容，无法修复草稿。");
  if (!draft?.trim()) throw new Error("缺少当前草稿，无法执行修复。");
  if (!Array.isArray(failedChecks) || !failedChecks.length) {
    throw new Error("没有需要修复的规范项目。");
  }
  const prompt = await buildRepairPrompt({
    input,
    draft,
    failedChecks,
    passedChecks: Array.isArray(passedChecks) ? passedChecks : [],
    mode,
    preferences,
  });
  const result = await generateWithFallback({
    prompt,
    dispatcher: externalDispatcher,
    skipProviders: skipProvider ? [skipProvider] : [],
  });
  try {
    const validation = validateDraft(result.draft);
    const record = historyId
      ? await historyStore.appendVersion(historyId, {
          expectedVersion: historyVersion,
          draft: result.draft,
          generation: result,
          validation,
        })
      : await historyStore.create({
          source: await resolveSource(input),
          draft: result.draft,
          preferences: normalizeContentPreferences(preferences),
          generation: result,
          validation,
        });
    return {
      ...result,
      repairMode: mode,
      historyId: record.id,
      historyVersion: record.currentVersion,
    };
  } catch (error) {
    return {
      ...result,
      repairMode: mode,
      historyId,
      historyVersion,
      historyWarning: error.message,
    };
  }
}

async function generateSection(payload = {}) {
  const {
    section,
    input,
    draft,
    currentValue,
    previousCandidates,
    rejectionReasons,
    preferences,
  } = payload;
  if (!input?.trim()) throw new Error("缺少原始 X 内容，无法局部生成。");
  if (!draft?.trim()) throw new Error("缺少当前草稿，无法局部生成。");

  const source = await resolveSource(input);
  const fields = splitXiaohongshuDraft(draft);
  const prompt = buildSectionGenerationPrompt({
    section,
    sourceContent: source.content,
    draft,
    body: fields.body,
    currentValue,
    previousCandidates,
    rejectionReasons,
    preferences,
  });
  const result = await generateWithFallback({
    prompt,
    dispatcher: externalDispatcher,
  });
  const candidates = validateSectionCandidates(
    section,
    parseSectionCandidates(result.draft, section),
    { draft },
  );

  return {
    ...result,
    draft: undefined,
    section,
    candidates,
    sourceMode: "content-only",
    sourceUpdatedAt: null,
  };
}

async function handleApi(request, response) {
  const apiUrl = new URL(request.url, "http://local");
  const historyDetailMatch =
    /^\/api\/history\/([^/]+)$/u.exec(apiUrl.pathname);

  if (request.method === "GET" && apiUrl.pathname === "/api/health") {
    return sendJson(response, 200, settingsResponse());
  }

  if (request.method === "POST" && apiUrl.pathname === "/api/settings") {
    return sendJson(response, 200, await saveSettings(await readJson(request)));
  }

  if (request.method === "GET" && apiUrl.pathname === "/api/history") {
    return sendJson(
      response,
      200,
      await historyStore.list({ limit: apiUrl.searchParams.get("limit") }),
    );
  }

  if (request.method === "GET" && historyDetailMatch) {
    return sendJson(
      response,
      200,
      await historyStore.get(decodeURIComponent(historyDetailMatch[1])),
    );
  }

  if (request.method === "DELETE" && historyDetailMatch) {
    return sendJson(
      response,
      200,
      await historyStore.remove(decodeURIComponent(historyDetailMatch[1])),
    );
  }

  if (request.method === "POST" && apiUrl.pathname === "/api/resolve") {
    const { input } = await readJson(request);
    return sendJson(response, 200, await resolveSource(input));
  }

  if (request.method === "POST" && apiUrl.pathname === "/api/generate") {
    const { input, preferences } = await readJson(request);
    return sendJson(
      response,
      200,
      await generateDraft(input, { preferences }),
    );
  }

  if (request.method === "POST" && apiUrl.pathname === "/api/repair") {
    return sendJson(response, 200, await repairDraft(await readJson(request)));
  }

  if (
    request.method === "POST" &&
    apiUrl.pathname === "/api/generate-section"
  ) {
    return sendJson(
      response,
      200,
      await generateSection(await readJson(request)),
    );
  }

  sendJson(response, 404, { error: "接口不存在。" });
}

async function serveStatic(request, response) {
  const distDir = join(rootDir, "dist");
  const urlPath = decodeURIComponent(new URL(request.url, "http://local").pathname);
  const relativePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(distDir, relativePath === "/" ? "index.html" : relativePath);

  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(distDir, "index.html");
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("请先运行 npm run build，或使用 npm run dev。");
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/")) {
      await handleApi(request, response);
    } else {
      await serveStatic(request, response);
    }
  } catch (error) {
    const message =
      error?.name === "TimeoutError"
        ? "请求超时，请稍后重试。"
        : error?.message || "发生未知错误。";
    sendJson(response, 400, { error: message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, serverHost, () => {
    console.log(`X → 小红书 server: http://${serverHost}:${port}`);
  });
}
