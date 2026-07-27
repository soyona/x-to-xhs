import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createPromptStore,
  parsePromptModules,
} from "../promptStore.mjs";

const modules = {
  global: "全局原则",
  title: "默认标题规则",
  body: "默认正文规则",
  summary: "默认摘要规则",
  tags: "默认标签规则",
  output: "固定输出协议",
};

function promptMarkdown(values = modules) {
  return Object.entries(values)
    .map(
      ([id, value]) =>
        `<!-- PROMPT:${id.toUpperCase()}:START -->\n${value}\n<!-- PROMPT:${id.toUpperCase()}:END -->`,
    )
    .join("\n\n");
}

test("默认提示词必须包含完整模块", () => {
  assert.deepEqual(parsePromptModules(promptMarkdown()), modules);
  assert.throws(
    () => parsePromptModules(promptMarkdown({ ...modules, tags: "" })),
    /缺少模块：tags/,
  );
});

test("自定义方案可覆盖全局与四个内容模块并继承固定输出协议", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  await writeFile(
    join(rootDir, "Long-form-post-prompt.md"),
    promptMarkdown(),
    "utf8",
  );
  const store = createPromptStore({ rootDir, dataDir });
  const customModules = {
    global: "自定义全局原则",
    title: "自定义标题",
    body: "自定义正文",
    summary: "自定义摘要",
    tags: "自定义标签",
  };

  const state = await store.saveProfile({
    name: "我的方案",
    modules: customModules,
  });
  assert.notEqual(state.selectedId, "default");
  const effective = await store.getEffectiveProfile();
  assert.equal(effective.modules.title, "自定义标题");
  assert.equal(effective.modules.global, "自定义全局原则");
  assert.equal(effective.modules.output, "固定输出协议");

  const saved = JSON.parse(
    await readFile(join(dataDir, "prompts.json"), "utf8"),
  );
  assert.deepEqual(saved.profiles[0].modules, customModules);
});

test("旧版四模块方案自动继承默认全局规则", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  await writeFile(
    join(rootDir, "Long-form-post-prompt.md"),
    promptMarkdown(),
    "utf8",
  );
  await writeFile(
    join(dataDir, "prompts.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      selectedId: "legacy-profile",
      profiles: [{
        id: "legacy-profile",
        name: "旧版方案",
        modules: {
          title: "旧版标题",
          body: "旧版正文",
          summary: "旧版摘要",
          tags: "旧版标签",
        },
        createdAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
      }],
    }, null, 2)}\n`,
    "utf8",
  );
  const store = createPromptStore({ rootDir, dataDir });

  const state = await store.getState();
  assert.equal(state.profiles[0].modules.global, "全局原则");
  const effective = await store.getEffectiveProfile();
  assert.equal(effective.modules.global, "全局原则");
  assert.equal(effective.modules.title, "旧版标题");
});

test("直接修改默认 Markdown 后系统默认立即更新", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-default-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-default-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  const filePath = join(rootDir, "Long-form-post-prompt.md");
  await writeFile(filePath, promptMarkdown(), "utf8");
  const store = createPromptStore({ rootDir, dataDir });
  assert.equal((await store.getEffectiveProfile()).modules.title, "默认标题规则");

  await writeFile(
    filePath,
    promptMarkdown({ ...modules, title: "文件中的新标题规则" }),
    "utf8",
  );
  assert.equal(
    (await store.getEffectiveProfile()).modules.title,
    "文件中的新标题规则",
  );
});
