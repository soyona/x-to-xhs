import assert from "node:assert/strict";
import test from "node:test";
import { resolveSource } from "../server.mjs";
import {
  SOURCE_MODES,
  authorHandleFromUrl,
  extractHttpUrl,
  extractStandaloneHttpUrl,
  extractXStatusUrl,
  inferSourceMode,
  normalizeSourceMode,
  withoutStandaloneSourceUrl,
} from "../src/sourceContext.js";

test("链接与正文加链接会自动识别通用来源模式", () => {
  const sourceUrl = "https://x.com/example/status/123456";

  assert.equal(inferSourceMode(sourceUrl), SOURCE_MODES.URL);
  assert.equal(
    inferSourceMode(`原文第一段。\n\n${sourceUrl}`),
    SOURCE_MODES.CONTENT,
  );
  assert.equal(extractXStatusUrl(`原文\n${sourceUrl}。`), `${sourceUrl}`);
  assert.equal(extractHttpUrl(`原文\n${sourceUrl}。`), `${sourceUrl}`);
  assert.equal(authorHandleFromUrl(sourceUrl), "example");
  assert.equal(normalizeSourceMode("x-url"), SOURCE_MODES.URL);
  assert.equal(normalizeSourceMode("x-content"), SOURCE_MODES.CONTENT);
});

test("无链接纯文本不误判为 URL 且可移除独立来源链接行", () => {
  const sourceUrl = "https://x.com/example/status/123456";

  assert.equal(inferSourceMode("这是一段纯文本。"), SOURCE_MODES.CONTENT);
  assert.equal(
    withoutStandaloneSourceUrl(`第一段。\n\n${sourceUrl}`, sourceUrl),
    "第一段。",
  );
});

test("识别独立网页 URL，但不把正文中的链接误判为独立 URL", () => {
  const articleUrl =
    "https://openai.com/zh-Hans-CN/index/harness-engineering/";

  assert.equal(extractStandaloneHttpUrl(articleUrl), articleUrl);
  assert.equal(extractStandaloneHttpUrl(`${articleUrl}。`), articleUrl);
  assert.equal(
    extractStandaloneHttpUrl(`这是正文。\n\n来源：${articleUrl}`),
    null,
  );
});

test("服务端读取独立的公开网页链接并提取正文", async (t) => {
  const articleUrl =
    "https://openai.com/zh-Hans-CN/index/harness-engineering/";
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(
    '<html><head><title>Harness Engineering</title><meta name="author" content="OpenAI"></head><body><nav>导航</nav><main><h1>核心内容</h1><p>这是文章正文。</p></main></body></html>',
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

  const source = await resolveSource(articleUrl);
  assert.equal(source.mode, SOURCE_MODES.URL);
  assert.equal(source.sourceUrl, articleUrl);
  assert.equal(source.authorName, "OpenAI");
  assert.match(source.content, /Harness Engineering/);
  assert.match(source.content, /核心内容\n这是文章正文/);
  assert.doesNotMatch(source.content, /导航/);
});

test("服务端统一规范化带来源链接的内容与普通文本", async () => {
  const sourceUrl = "https://x.com/example/status/123456";
  const copied = await resolveSource(`复制的 X 原文。\n\n${sourceUrl}`);
  const plainText = await resolveSource("一段没有附带链接的 X 原文。");

  assert.deepEqual(
    {
      mode: copied.mode,
      content: copied.content,
      sourceUrl: copied.sourceUrl,
      authorHandle: copied.authorHandle,
    },
    {
      mode: SOURCE_MODES.CONTENT,
      content: "复制的 X 原文。",
      sourceUrl,
      authorHandle: "example",
    },
  );
  assert.equal(plainText.mode, SOURCE_MODES.CONTENT);
  assert.equal(plainText.sourceUrl, null);
});
