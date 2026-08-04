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

function extractHeadingSection(content, heading) {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const nextHeadingOffset = content.slice(start + heading.length).search(/\n## /u);
  const end =
    nextHeadingOffset < 0
      ? content.length
      : start + heading.length + nextHeadingOffset;
  return content.slice(start, end).trim();
}

function migrateLegacySourceModeSection(modules, defaultModules) {
  const legacyHeading = "## 素材来源模式（source_mode）";
  const replacement = extractHeadingSection(
    defaultModules.global,
    "## 素材处理与归属边界",
  );
  const global = modules?.global;
  const start = typeof global === "string" ? global.indexOf(legacyHeading) : -1;
  if (start < 0 || !replacement) return modules;
  const nextHeadingOffset = global
    .slice(start + legacyHeading.length)
    .search(/\n## /u);
  const end =
    nextHeadingOffset < 0
      ? global.length
      : start + legacyHeading.length + nextHeadingOffset;
  return {
    ...modules,
    global: `${global.slice(0, start)}${replacement}${global.slice(end)}`.trim(),
  };
}

function profileSummary(profile, defaultModules) {
  const modules = migrateLegacySourceModeSection(
    profile.modules,
    defaultModules,
  );
  return {
    id: profile.id,
    name: profile.name,
    source: "custom",
    modules: structuredClone({
      ...defaultModules,
      ...modules,
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
    const selectedModules = migrateLegacySourceModeSection(
      selected?.modules,
      defaultProfile.modules,
    );
    return {
      id: selected?.id || DEFAULT_PROFILE_ID,
      name: selected?.name || defaultProfile.name,
      updatedAt: selected?.updatedAt || defaultProfile.updatedAt,
      modules: {
        ...defaultProfile.modules,
        ...(selectedModules || {}),
        output: defaultProfile.protectedModules.output,
      },
    };
  }

  async function saveProfile({ id, name, modules }) {
    await enqueueWrite(async () => {
      const [document, defaultProfile] = await Promise.all([
        readDocument(),
        readDefaultProfile(),
      ]);
      const timestamp = now().toISOString();
      const cleanedModules = cleanEditableModules(
        migrateLegacySourceModeSection(modules, defaultProfile.modules),
      );
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
