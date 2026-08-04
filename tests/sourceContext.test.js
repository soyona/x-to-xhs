import assert from "node:assert/strict";
import test from "node:test";
import { resolveSource } from "../server.mjs";
import {
  SOURCE_MODES,
  authorHandleFromUrl,
  extractStandaloneHttpUrl,
  extractXStatusUrl,
  inferSourceMode,
  withoutStandaloneSourceUrl,
} from "../src/sourceContext.js";

test("明确的 X 链接与正文加链接会自动识别来源模式", () => {
  const sourceUrl = "https://x.com/example/status/123456";

  assert.equal(inferSourceMode(sourceUrl), SOURCE_MODES.X_URL);
  assert.equal(
    inferSourceMode(`原文第一段。\n\n${sourceUrl}`),
    SOURCE_MODES.X_CONTENT,
  );
  assert.equal(extractXStatusUrl(`原文\n${sourceUrl}。`), `${sourceUrl}`);
  assert.equal(authorHandleFromUrl(sourceUrl), "example");
});

test("无链接纯文本不误判为 URL 且可移除独立来源链接行", () => {
  const sourceUrl = "https://x.com/example/status/123456";

  assert.equal(inferSourceMode("这是一段纯文本。"), null);
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

test("服务端拒绝把独立的非 X 网页链接当作原文生成", async () => {
  const articleUrl =
    "https://openai.com/zh-Hans-CN/index/harness-engineering/";

  await assert.rejects(
    resolveSource(articleUrl),
    /暂不支持读取非 X 网页链接，请粘贴文章正文后再生成/,
  );
});

test("服务端统一规范化 X 原文与普通文本", async () => {
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
      mode: SOURCE_MODES.X_CONTENT,
      content: "复制的 X 原文。",
      sourceUrl,
      authorHandle: "example",
    },
  );
  assert.equal(plainText.mode, SOURCE_MODES.X_CONTENT);
  assert.equal(plainText.sourceUrl, null);
});
