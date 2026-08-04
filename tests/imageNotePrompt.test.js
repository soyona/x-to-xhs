import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTypedPromptStore, parseTypedPrompt } from "../promptStore.mjs";

const rootDir = resolve(new URL("..", import.meta.url).pathname);

test("长文与图文 Prompt Store 独立选择并使用固定类型", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "xhs-prompts-"));
  try {
    const longform = createTypedPromptStore({ rootDir, dataDir, type: "longform" });
    const image = createTypedPromptStore({ rootDir, dataDir, type: "image-note" });
    const imageState = await image.getState();
    const custom = await image.saveProfile({ name: "商务简约", modules: imageState.defaultProfile.modules });
    assert.notEqual(custom.selectedId, "default");
    assert.equal((await longform.getState()).selectedId, "default");
    assert.notEqual(longform.filePath, image.filePath);
    const exported = await image.exportMarkdown(imageState.defaultProfile.modules, "商务简约");
    assert.equal(exported.name, "xhs-image-note-prompt--商务简约.md");
    assert.equal(parseTypedPrompt(exported.markdown, "image-note").images, imageState.defaultProfile.modules.images);
    const longformMarkdown = await readFile(join(rootDir, "prompts/longform/default.md"), "utf8");
    await assert.rejects(() => image.importMarkdown({ name: "错误类型", markdown: longformMarkdown }), /类型必须为 image-note/u);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});

test("长文与图文共用规则一致，图文只用图片模块替代正文", async () => {
  const [longformMarkdown, imageMarkdown] = await Promise.all([
    readFile(join(rootDir, "prompts/longform/default.md"), "utf8"),
    readFile(join(rootDir, "prompts/image-note/default.md"), "utf8"),
  ]);
  const longform = parseTypedPrompt(longformMarkdown, "longform");
  const image = parseTypedPrompt(imageMarkdown, "image-note");
  for (const id of ["global", "title", "summary", "tags"]) assert.equal(image[id], longform[id]);
  assert.doesNotMatch(longform.global, /source_mode|x-url|x-content|original|自主编写|素材来源模式/u);
  assert.deepEqual(Object.keys(image), ["global", "title", "images", "summary", "tags", "output", "source"]);
  assert.match(image.images, /与长文“正文”一致/u);
  assert.match(image.images, /流程图/u);
  assert.match(image.images, /架构图/u);
  assert.match(image.images, /样例：商务简约主题如何呈现正文/u);
});

test("图文模板拒绝乱序、保护模块修改和超大文件", async () => {
  const markdown = await readFile(join(rootDir, "prompts/image-note/default.md"), "utf8");
  assert.throws(() => parseTypedPrompt(markdown.replace("PROMPT:TITLE:START", "PROMPT:IMAGES:START"), "image-note"), /固定顺序/u);
  assert.throws(() => parseTypedPrompt(`${markdown}${"x".repeat(205 * 1024)}`, "image-note"), /200 KiB/u);
});
