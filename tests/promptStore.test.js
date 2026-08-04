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

function completePromptMarkdown(values = modules) {
  return `${promptMarkdown(values)}\n\n<!-- PROMPT:SOURCE:START -->\n[素材]\n<!-- PROMPT:SOURCE:END -->\n`;
}

test("默认提示词必须包含完整模块", () => {
  assert.deepEqual(parsePromptModules(promptMarkdown()), modules);
  assert.throws(
    () => parsePromptModules(promptMarkdown({ ...modules, tags: "" })),
    /缺少模块：tags/,
  );
  assert.throws(
    () =>
      parsePromptModules(
        `${promptMarkdown()}\n\n<!-- PROMPT:TITLE:START -->\n重复标题\n<!-- PROMPT:TITLE:END -->`,
      ),
    /模块重复：title/,
  );
});

test("默认提示词约束第三方素材不得补写未展开的技术内容", async () => {
  const markdown = await readFile(
    join(process.cwd(), "Long-form-post-prompt.md"),
    "utf8",
  );
  const parsed = parsePromptModules(markdown);

  assert.match(parsed.global, /每一项事实性主张都必须能在输入素材中找到直接依据/);
  assert.match(parsed.global, /只能将其表述为内容预告/);
  assert.doesNotMatch(parsed.global, /必须增加背景、核验、适用场景、案例/);
  assert.doesNotMatch(parsed.global, /已核验上下文/);
  assert.match(parsed.body, /不得使用模型自身知识补写定义、设计模式、工作流程/);
  assert.doesNotMatch(parsed.body, /必须基于通用技术常识补足/);
  assert.doesNotMatch(parsed.body, /已核验上下文/);
});

test("默认提示词为局部正文和有限素材提供明确降级规则", async () => {
  const markdown = await readFile(
    join(process.cwd(), "Long-form-post-prompt.md"),
    "utf8",
  );
  const parsed = parsePromptModules(markdown);

  assert.match(parsed.title, /不得为了凑类型虚构痛点、反差或解决方案/);
  assert.match(parsed.body, /局部正文生成不得输出文章大标题/);
  assert.match(parsed.body, /素材有限时省略/);
  assert.match(parsed.summary, /信息有限时允许自然缩短/);
  assert.match(parsed.tags, /素材信息有限时输出 4–8 个/);
});

test("默认提示词使用条件式专业角色并避免输出模板占位符", async () => {
  const markdown = await readFile(
    join(process.cwd(), "Long-form-post-prompt.md"),
    "utf8",
  );
  const parsed = parsePromptModules(markdown);

  assert.match(parsed.global, /其他领域只使用素材明确支持的知识与表达/);
  assert.match(parsed.global, /“本文分析”只允许归纳、比较、结构化解释/);
  assert.match(parsed.title, /目标长度为 16–20 个可见字符/);
  assert.match(parsed.summary, /条件式行动建议（可选）/);
  assert.match(parsed.output, /## 正文小结 \/ 摘要/);
  assert.match(parsed.output, /## 推荐标签/);
  assert.doesNotMatch(parsed.output, /\[[^\]]+\]|# \[|三段式摘要内容/);
  assert.doesNotMatch(parsed.output, /^## 0X\b/mu);
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

test("旧方案的素材类型区块自动替换为统一素材规则", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-prompts-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  await writeFile(
    join(rootDir, "Long-form-post-prompt.md"),
    promptMarkdown({
      ...modules,
      global: "全局原则\n\n## 内容处理与归属边界\n\n统一处理 X 内容。",
    }),
    "utf8",
  );
  const store = createPromptStore({ rootDir, dataDir });
  const state = await store.saveProfile({
    name: "旧方案",
    modules: {
      global:
        "自定义前置规则\n\n## 素材来源模式（source_mode）\n\n- x-url：公开链接\n- x-content：复制原文\n- original：自主编写\n\n## 自定义尾部规则\n\n继续保留。",
      title: "自定义标题",
      body: "自定义正文",
      summary: "自定义摘要",
      tags: "自定义标签",
    },
  });

  const global = state.profiles[0].modules.global;
  assert.doesNotMatch(global, /source_mode|x-url|x-content|original：|自主编写/);
  assert.match(global, /统一处理 X 内容/);
  assert.match(global, /自定义前置规则/);
  assert.match(global, /自定义尾部规则/);

  const migratedInterimState = await store.saveProfile({
    name: "过渡版本方案",
    modules: {
      global:
        "自定义前置规则\n\n## 素材处理与归属边界\n\n所有输入统一视为待整理的原始素材。\n\n## 自定义尾部规则\n\n继续保留。",
      title: "自定义标题",
      body: "自定义正文",
      summary: "自定义摘要",
      tags: "自定义标签",
    },
  });
  const migratedInterimGlobal = migratedInterimState.profiles[1].modules.global;
  assert.doesNotMatch(migratedInterimGlobal, /原始素材|素材处理与归属边界/);
  assert.match(migratedInterimGlobal, /统一处理 X 内容/);
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

test("默认模板可原样下载，当前方案导出后可重新导入", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-export-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-export-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  const defaultMarkdown = completePromptMarkdown();
  await writeFile(
    join(rootDir, "Long-form-post-prompt.md"),
    defaultMarkdown,
    "utf8",
  );
  const store = createPromptStore({ rootDir, dataDir });
  const exportedDefault = await store.exportMarkdown();
  assert.equal(exportedDefault.markdown, defaultMarkdown);

  const customModules = {
    global: "导出的全局原则",
    title: "导出的标题规则",
    body: "导出的正文规则",
    summary: "导出的摘要规则",
    tags: "导出的标签规则",
  };
  const exportedCustom = await store.exportMarkdown(customModules);
  assert.deepEqual(parsePromptModules(exportedCustom.markdown), {
    ...customModules,
    output: modules.output,
  });

  const state = await store.importMarkdown({
    name: "重新导入",
    markdown: exportedCustom.markdown,
  });
  assert.notEqual(state.selectedId, "default");
  const effective = await store.getEffectiveProfile();
  assert.equal(effective.name, "重新导入");
  assert.deepEqual(effective.modules, {
    ...customModules,
    output: modules.output,
  });
});

test("导入模板不能修改固定输出协议", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "x-to-xhs-import-root-"));
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-import-data-"));
  t.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(dataDir, { recursive: true, force: true }),
  ]));
  await writeFile(
    join(rootDir, "Long-form-post-prompt.md"),
    completePromptMarkdown(),
    "utf8",
  );
  const store = createPromptStore({ rootDir, dataDir });
  await assert.rejects(
    store.importMarkdown({
      name: "结构已修改",
      markdown: completePromptMarkdown({
        ...modules,
        output: "被修改的输出协议",
      }),
    }),
    /固定输出协议已被修改/,
  );
});
