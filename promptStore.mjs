import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  PROMPT_FILE_LIMIT,
  PROMPT_SCHEMA_VERSION,
  getPromptDefinition,
} from "./promptDefinitions.mjs";

export const PROMPT_MODULE_IDS = [
  "global",
  "title",
  "body",
  "summary",
  "tags",
  "output",
];
export const EDITABLE_PROMPT_MODULE_IDS = [
  "global",
  "title",
  "body",
  "summary",
  "tags",
];

const SCHEMA_VERSION = 1;
const DEFAULT_PROFILE_ID = "default";
const PROFILE_ID_PATTERN = /^[a-z0-9-]{1,80}$/u;
const MARKER_PATTERN =
  /<!--\s*PROMPT:([A-Z]+):START\s*-->([\s\S]*?)<!--\s*PROMPT:\1:END\s*-->/gu;
const SOURCE_MARKER_PATTERN =
  /<!--\s*PROMPT:SOURCE:START\s*-->[\s\S]*?<!--\s*PROMPT:SOURCE:END\s*-->/gu;

function emptyDocument() {
  return {
    schemaVersion: SCHEMA_VERSION,
    selectedId: DEFAULT_PROFILE_ID,
    profiles: [],
  };
}

function cleanText(value, label, max = 20_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}不能为空。`);
  }
  const cleaned = value.trim();
  if (cleaned.length > max) throw new Error(`${label}内容过长。`);
  return cleaned;
}

function cleanName(value) {
  const cleaned = cleanText(value, "方案名称", 40);
  if (/[\r\n]/u.test(cleaned)) throw new Error("方案名称不能包含换行。");
  return cleaned;
}

function cleanEditableModules(modules = {}) {
  if (!modules || typeof modules !== "object") {
    throw new Error("提示词模块格式无效。");
  }
  return Object.fromEntries(
    EDITABLE_PROMPT_MODULE_IDS.map((id) => [
      id,
      cleanText(modules[id], `${id} 模块`),
    ]),
  );
}

function validateDocument(value) {
  if (
    !value ||
    value.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(value.profiles) ||
    typeof value.selectedId !== "string"
  ) {
    throw new Error("提示词方案文件格式无效。");
  }
  return value;
}

export function parsePromptModules(markdown = "") {
  const modules = {};
  const counts = new Map();
  for (const match of markdown.matchAll(MARKER_PATTERN)) {
    const id = match[1].toLowerCase();
    if (!PROMPT_MODULE_IDS.includes(id)) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
    modules[id] = match[2].trim();
  }
  const duplicated = PROMPT_MODULE_IDS.filter((id) => counts.get(id) > 1);
  if (duplicated.length) {
    throw new Error(`默认提示词模块重复：${duplicated.join("、")}。`);
  }
  const missing = PROMPT_MODULE_IDS.filter((id) => !modules[id]);
  if (missing.length) {
    throw new Error(`默认提示词缺少模块：${missing.join("、")}。`);
  }
  return modules;
}

function replacePromptModules(markdown, modules) {
  return EDITABLE_PROMPT_MODULE_IDS.reduce((document, id) => {
    const marker = new RegExp(
      `(<!--\\s*PROMPT:${id.toUpperCase()}:START\\s*-->)[\\s\\S]*?(<!--\\s*PROMPT:${id.toUpperCase()}:END\\s*-->)`,
      "u",
    );
    return document.replace(
      marker,
      (_match, start, end) => `${start}\n\n${modules[id].trim()}\n\n${end}`,
    );
  }, markdown);
}

function profileSummary(profile, defaultModules) {
  return {
    id: profile.id,
    name: profile.name,
    source: "custom",
    modules: structuredClone({
      ...defaultModules,
      ...profile.modules,
    }),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function createPromptStore({ rootDir, dataDir, now = () => new Date() }) {
  if (!rootDir || !dataDir) throw new Error("缺少提示词存储目录。");
  const defaultPath = join(rootDir, "Long-form-post-prompt.md");
  const filePath = join(dataDir, "prompts.json");
  let writeQueue = Promise.resolve();

  async function readDefaultProfile() {
    const [markdown, fileStat] = await Promise.all([
      readFile(defaultPath, "utf8"),
      stat(defaultPath),
    ]);
    const modules = parsePromptModules(markdown);
    return {
      id: DEFAULT_PROFILE_ID,
      name: "系统默认",
      source: "default",
      modules: Object.fromEntries(
        EDITABLE_PROMPT_MODULE_IDS.map((id) => [id, modules[id]]),
      ),
      protectedModules: { output: modules.output },
      updatedAt: fileStat.mtime.toISOString(),
    };
  }

  async function readDocument() {
    try {
      return validateDocument(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") return emptyDocument();
      if (error?.name === "SyntaxError") {
        throw new Error("提示词方案文件无法解析，原文件已保留。");
      }
      throw error;
    }
  }

  async function writeDocument(document) {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await chmod(dataDir, 0o700);
    const temporaryPath = join(
      dataDir,
      `prompts.json.tmp-${process.pid}-${Date.now()}`,
    );
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(document, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      validateDocument(JSON.parse(await readFile(temporaryPath, "utf8")));
      await rename(temporaryPath, filePath);
      await chmod(filePath, 0o600);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  function enqueueWrite(task) {
    const result = writeQueue.then(task, task);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  async function getState() {
    await writeQueue;
    const [defaultProfile, document] = await Promise.all([
      readDefaultProfile(),
      readDocument(),
    ]);
    const selectedExists =
      document.selectedId === DEFAULT_PROFILE_ID ||
      document.profiles.some((profile) => profile.id === document.selectedId);
    return {
      selectedId: selectedExists ? document.selectedId : DEFAULT_PROFILE_ID,
      defaultProfile: {
        id: defaultProfile.id,
        name: defaultProfile.name,
        source: defaultProfile.source,
        modules: defaultProfile.modules,
        updatedAt: defaultProfile.updatedAt,
      },
      profiles: document.profiles.map((profile) =>
        profileSummary(profile, defaultProfile.modules),
      ),
    };
  }

  async function getEffectiveProfile() {
    await writeQueue;
    const [defaultProfile, document] = await Promise.all([
      readDefaultProfile(),
      readDocument(),
    ]);
    const selected = document.profiles.find(
      (profile) => profile.id === document.selectedId,
    );
    return {
      id: selected?.id || DEFAULT_PROFILE_ID,
      name: selected?.name || defaultProfile.name,
      updatedAt: selected?.updatedAt || defaultProfile.updatedAt,
      modules: {
        ...defaultProfile.modules,
        ...(selected?.modules || {}),
        output: defaultProfile.protectedModules.output,
      },
    };
  }

  async function saveProfile({ id, name, modules }) {
    await enqueueWrite(async () => {
      const document = await readDocument();
      const timestamp = now().toISOString();
      const cleanedModules = cleanEditableModules(modules);
      const cleanedName = cleanName(name);
      let profile = id
        ? document.profiles.find((item) => item.id === id)
        : null;
      if (id && (!PROFILE_ID_PATTERN.test(id) || !profile)) {
        throw new Error("提示词方案不存在或 ID 无效。");
      }
      if (profile) {
        profile.name = cleanedName;
        profile.modules = cleanedModules;
        profile.updatedAt = timestamp;
      } else {
        profile = {
          id: randomUUID(),
          name: cleanedName,
          modules: cleanedModules,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        document.profiles.push(profile);
      }
      document.selectedId = profile.id;
      await writeDocument(document);
    });
    return getState();
  }

  async function exportMarkdown(modules = null) {
    await writeQueue;
    const markdown = await readFile(defaultPath, "utf8");
    if (!modules) {
      return {
        name: "Long-form-post-prompt.md",
        markdown,
      };
    }
    const cleanedModules = cleanEditableModules(modules);
    return {
      name: "Long-form-post-prompt.md",
      markdown: replacePromptModules(markdown, cleanedModules),
    };
  }

  async function importMarkdown({ name, markdown }) {
    if (typeof markdown !== "string" || !markdown.trim()) {
      throw new Error("请选择有效的 Markdown 提示词文件。");
    }
    if ([...markdown.matchAll(SOURCE_MARKER_PATTERN)].length !== 1) {
      throw new Error("提示词模板必须保留一组完整的 SOURCE 素材占位标记。");
    }
    const importedModules = parsePromptModules(markdown);
    const defaultProfile = await readDefaultProfile();
    if (importedModules.output !== defaultProfile.protectedModules.output) {
      throw new Error("固定输出协议已被修改，请使用未改变结构的模板重新导入。");
    }
    return saveProfile({
      name,
      modules: Object.fromEntries(
        EDITABLE_PROMPT_MODULE_IDS.map((id) => [id, importedModules[id]]),
      ),
    });
  }

  async function selectProfile(id) {
    await enqueueWrite(async () => {
      const document = await readDocument();
      const valid =
        id === DEFAULT_PROFILE_ID ||
        (PROFILE_ID_PATTERN.test(id || "") &&
          document.profiles.some((profile) => profile.id === id));
      if (!valid) throw new Error("提示词方案不存在。");
      document.selectedId = id;
      await writeDocument(document);
    });
    return getState();
  }

  async function deleteProfile(id) {
    await enqueueWrite(async () => {
      if (!PROFILE_ID_PATTERN.test(id || "") || id === DEFAULT_PROFILE_ID) {
        throw new Error("不能删除系统默认方案。");
      }
      const document = await readDocument();
      const nextProfiles = document.profiles.filter(
        (profile) => profile.id !== id,
      );
      if (nextProfiles.length === document.profiles.length) {
        throw new Error("提示词方案不存在。");
      }
      document.profiles = nextProfiles;
      if (document.selectedId === id) document.selectedId = DEFAULT_PROFILE_ID;
      await writeDocument(document);
    });
    return getState();
  }

  return {
    getState,
    getEffectiveProfile,
    saveProfile,
    exportMarkdown,
    importMarkdown,
    selectProfile,
    deleteProfile,
  };
}

const TYPE_PATTERN = /<!--\s*PROMPT_TYPE:([a-z-]+)\s*-->/gu;
const VERSION_PATTERN = /<!--\s*PROMPT_SCHEMA_VERSION:(\d+)\s*-->/gu;

export function parseTypedPrompt(markdown, type) {
  const definition = getPromptDefinition(type);
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("提示词模板不能为空。");
  if (Buffer.byteLength(markdown, "utf8") > PROMPT_FILE_LIMIT) throw new Error("提示词模板不能超过200 KiB。");
  const types = [...markdown.matchAll(TYPE_PATTERN)].map((match) => match[1]);
  const versions = [...markdown.matchAll(VERSION_PATTERN)].map((match) => Number(match[1]));
  if (types.length !== 1 || types[0] !== type) throw new Error(`提示词类型必须为 ${type}。`);
  if (versions.length !== 1 || versions[0] !== PROMPT_SCHEMA_VERSION) throw new Error("提示词 Schema 版本不受支持。");
  const matches = [...markdown.matchAll(MARKER_PATTERN)];
  const order = matches.map((match) => match[1].toLowerCase());
  if (order.length !== definition.modules.length || order.some((id, index) => id !== definition.modules[index])) {
    throw new Error("提示词模块必须完整且保持固定顺序。");
  }
  const modules = Object.fromEntries(matches.map((match) => [match[1].toLowerCase(), match[2].trim()]));
  if (Object.values(modules).some((value) => !value)) throw new Error("提示词模块不能为空。");
  return modules;
}

export function createTypedPromptStore({ rootDir, dataDir, type, now = () => new Date() }) {
  const definition = getPromptDefinition(type);
  const defaultPath = join(rootDir, definition.defaultPath);
  const filePath = join(dataDir, definition.localPath);
  const legacyPath = type === "longform" ? join(dataDir, "prompts.json") : null;
  let writeQueue = Promise.resolve();
  const blank = () => ({ schemaVersion: 1, selectedId: DEFAULT_PROFILE_ID, profiles: [] });

  async function readDefault() {
    const [markdown, fileStat] = await Promise.all([readFile(defaultPath, "utf8"), stat(defaultPath)]);
    return { markdown, modules: parseTypedPrompt(markdown, type), updatedAt: fileStat.mtime.toISOString() };
  }

  async function readDocument() {
    try {
      return validateDocument(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        if (error?.name === "SyntaxError") throw new Error("提示词方案文件无法解析，原文件已保留。");
        throw error;
      }
      if (!legacyPath) return blank();
      try {
        const legacyDocument = validateDocument(JSON.parse(await readFile(legacyPath, "utf8")));
        await writeDocument(legacyDocument);
        return legacyDocument;
      }
      catch (legacyError) {
        if (legacyError?.code === "ENOENT") return blank();
        throw new Error("旧长文提示词方案迁移失败，原文件已保留。");
      }
    }
  }

  async function writeDocument(document) {
    const directory = join(dataDir, "prompts");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      validateDocument(JSON.parse(await readFile(temporaryPath, "utf8")));
      await rename(temporaryPath, filePath);
      await chmod(filePath, 0o600);
    } finally { await rm(temporaryPath, { force: true }); }
  }

  function enqueue(task) {
    const result = writeQueue.then(task, task);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  function cleanModules(modules) {
    if (!modules || typeof modules !== "object") throw new Error("提示词模块格式无效。");
    return Object.fromEntries(definition.editable.map((id) => [id, cleanText(modules[id], `${id} 模块`)]));
  }

  async function getState() {
    await writeQueue;
    const [system, document] = await Promise.all([readDefault(), readDocument()]);
    const selectedExists = document.selectedId === DEFAULT_PROFILE_ID || document.profiles.some((item) => item.id === document.selectedId);
    const summary = (profile) => ({ ...profile, source: "custom", modules: { ...Object.fromEntries(definition.editable.map((id) => [id, system.modules[id]])), ...profile.modules } });
    return {
      type, selectedId: selectedExists ? document.selectedId : DEFAULT_PROFILE_ID,
      defaultProfile: { id: DEFAULT_PROFILE_ID, name: "系统默认", source: "default", modules: Object.fromEntries(definition.editable.map((id) => [id, system.modules[id]])), updatedAt: system.updatedAt },
      profiles: document.profiles.map(summary),
    };
  }

  async function getEffectiveProfile() {
    await writeQueue;
    const [system, document] = await Promise.all([readDefault(), readDocument()]);
    const selected = document.profiles.find((item) => item.id === document.selectedId);
    return {
      type, id: selected?.id || DEFAULT_PROFILE_ID, name: selected?.name || "系统默认", updatedAt: selected?.updatedAt || system.updatedAt,
      modules: { ...system.modules, ...(selected?.modules || {}) },
    };
  }

  async function saveProfile({ id, name, modules }) {
    await enqueue(async () => {
      const document = await readDocument();
      const timestamp = now().toISOString();
      let profile = id ? document.profiles.find((item) => item.id === id) : null;
      if (id && !profile) throw new Error("提示词方案不存在或 ID 无效。");
      if (profile) Object.assign(profile, { name: cleanName(name), modules: cleanModules(modules), updatedAt: timestamp });
      else {
        profile = { id: randomUUID(), name: cleanName(name), modules: cleanModules(modules), createdAt: timestamp, updatedAt: timestamp };
        document.profiles.push(profile);
      }
      document.selectedId = profile.id;
      await writeDocument(document);
    });
    return getState();
  }

  async function selectProfile(id) {
    await enqueue(async () => {
      const document = await readDocument();
      if (id !== DEFAULT_PROFILE_ID && !document.profiles.some((item) => item.id === id)) throw new Error("提示词方案不存在。");
      document.selectedId = id;
      await writeDocument(document);
    });
    return getState();
  }

  async function deleteProfile(id) {
    await enqueue(async () => {
      if (id === DEFAULT_PROFILE_ID) throw new Error("不能删除系统默认方案。");
      const document = await readDocument();
      const count = document.profiles.length;
      document.profiles = document.profiles.filter((item) => item.id !== id);
      if (count === document.profiles.length) throw new Error("提示词方案不存在。");
      if (document.selectedId === id) document.selectedId = DEFAULT_PROFILE_ID;
      await writeDocument(document);
    });
    return getState();
  }

  async function exportMarkdown(modules = null, name = "系统默认") {
    const system = await readDefault();
    const markdown = modules ? definition.editable.reduce((document, id) => document.replace(
      new RegExp(`(<!--\\s*PROMPT:${id.toUpperCase()}:START\\s*-->)[\\s\\S]*?(<!--\\s*PROMPT:${id.toUpperCase()}:END\\s*-->)`, "u"),
      `$1\n\n${cleanText(modules[id], `${id} 模块`)}\n\n$2`,
    ), system.markdown) : system.markdown;
    return { name: `${definition.exportPrefix}--${cleanName(name)}.md`, markdown };
  }

  async function importMarkdown({ name, markdown }) {
    const imported = parseTypedPrompt(markdown, type);
    const system = await readDefault();
    for (const id of definition.protected) if (imported[id] !== system.modules[id]) throw new Error("系统保护模块已被修改。");
    return saveProfile({ name, modules: Object.fromEntries(definition.editable.map((id) => [id, imported[id]])) });
  }

  return { type, filePath, getState, getEffectiveProfile, saveProfile, selectProfile, deleteProfile, exportMarkdown, importMarkdown };
}
