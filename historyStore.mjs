import { randomUUID } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

const SCHEMA_VERSION = 1;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function emptyDocument() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    records: [],
  };
}

function clone(value) {
  return structuredClone(value);
}

function validateDocument(value) {
  if (
    !value ||
    value.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(value.records)
  ) {
    throw new Error("历史文件格式无效。");
  }
  return value;
}

function cleanText(value, label, max) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}不能为空。`);
  }
  const cleaned = value.trim();
  if (cleaned.length > max) throw new Error(`${label}内容过长。`);
  return cleaned;
}

function cleanOptionalText(value, max) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function titleFromDraft(draft) {
  const title = draft
    .split(/\r?\n/u)
    .find((line) => line.trim())
    ?.replace(/^#\s*/u, "")
    .trim();
  return title?.slice(0, 120) || "未命名长文";
}

function sourceExcerpt(content) {
  return content.replace(/\s+/gu, " ").trim().slice(0, 100);
}

function validationSummary(validation = {}) {
  const checks = Array.isArray(validation.checks) ? validation.checks : [];
  return {
    passed: checks.filter((check) => check.pass).length,
    total: checks.length,
    valid: validation.valid === true,
  };
}

function generationSummary(generation = {}) {
  return {
    provider: cleanOptionalText(generation.provider, 100),
    providerLabel: cleanOptionalText(generation.providerLabel, 100),
    model: cleanOptionalText(generation.model, 200),
  };
}

function listItem(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    title: record.title,
    sourceExcerpt: record.source?.excerpt || "",
    currentVersion: record.currentVersion,
    generation: record.generation,
    validation: record.validation,
  };
}

function sortRecords(records) {
  return [...records].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

export function createHistoryStore({
  dataDir,
  maxRecords = 50,
  maxVersions = 3,
  now = () => new Date(),
} = {}) {
  if (!dataDir) throw new Error("缺少历史数据目录。");

  const filePath = join(dataDir, "history.json");
  const backupPath = join(dataDir, "history.json.bak");
  let writeQueue = Promise.resolve();

  async function readDocument() {
    try {
      return validateDocument(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") {
        try {
          return validateDocument(
            JSON.parse(await readFile(backupPath, "utf8")),
          );
        } catch (backupError) {
          if (backupError?.code === "ENOENT") return emptyDocument();
          throw new Error(
            "历史文件无法读取，备份文件也不可用；原文件已保留。",
          );
        }
      }

      try {
        return validateDocument(
          JSON.parse(await readFile(backupPath, "utf8")),
        );
      } catch {
        throw new Error(
          "历史文件无法读取，备份文件也不可用；原文件已保留。",
        );
      }
    }
  }

  async function writeDocument(document) {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await chmod(dataDir, 0o700);
    const temporaryPath = join(
      dataDir,
      `history.json.tmp-${process.pid}-${Date.now()}`,
    );
    const serialized = `${JSON.stringify(document, null, 2)}\n`;

    try {
      await writeFile(temporaryPath, serialized, {
        encoding: "utf8",
        mode: 0o600,
      });
      validateDocument(JSON.parse(await readFile(temporaryPath, "utf8")));

      try {
        validateDocument(JSON.parse(await readFile(filePath, "utf8")));
        await copyFile(filePath, backupPath);
        await chmod(backupPath, 0o600);
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.name !== "SyntaxError") {
          if (error?.message !== "历史文件格式无效。") throw error;
        }
      }

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

  async function list({ limit = 50 } = {}) {
    await writeQueue;
    const document = await readDocument();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 50));
    const sorted = sortRecords(document.records);
    return {
      records: sorted.slice(0, safeLimit).map(listItem),
      total: sorted.length,
    };
  }

  async function get(id) {
    if (!UUID_PATTERN.test(id || "")) throw new Error("历史记录 ID 无效。");
    await writeQueue;
    const document = await readDocument();
    const record = document.records.find((item) => item.id === id);
    if (!record) throw new Error("历史记录不存在或已被删除。");
    return clone(record);
  }

  async function create({
    source,
    draft,
    preferences,
    generation,
    validation,
  }) {
    return enqueueWrite(async () => {
      const document = await readDocument();
      if (document.records.length >= maxRecords) {
        throw new Error(
          `历史记录已达到${maxRecords}条，请删除不需要的记录后继续保存。`,
        );
      }

      const timestamp = now().toISOString();
      const cleanDraft = cleanText(draft, "长文草稿", 100_000);
      const sourceContent = cleanText(
        source?.content,
        "原始 X 内容",
        64 * 1024,
      );
      const id = randomUUID();
      const summary = generationSummary(generation);
      const summaryValidation = validationSummary(validation);
      const record = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        title: titleFromDraft(cleanDraft),
        source: {
          type: source?.sourceUrl ? "url" : "text",
          content: sourceContent,
          url: cleanOptionalText(source?.sourceUrl, 2_000),
          excerpt: sourceExcerpt(sourceContent),
        },
        currentVersion: 1,
        preferences: clone(preferences || {}),
        generation: summary,
        validation: summaryValidation,
        versions: [
          {
            version: 1,
            type: "generate",
            createdAt: timestamp,
            draft: cleanDraft,
            validation: summaryValidation,
            ...summary,
          },
        ],
      };

      document.records.push(record);
      document.updatedAt = timestamp;
      await writeDocument(document);
      return clone(record);
    });
  }

  async function appendVersion(
    id,
    {
      expectedVersion,
      draft,
      generation,
      validation,
      type = "repair",
    },
  ) {
    if (!UUID_PATTERN.test(id || "")) throw new Error("历史记录 ID 无效。");
    return enqueueWrite(async () => {
      const document = await readDocument();
      const record = document.records.find((item) => item.id === id);
      if (!record) throw new Error("历史记录不存在或已被删除。");
      if (
        expectedVersion != null &&
        Number(expectedVersion) !== record.currentVersion
      ) {
        throw new Error("这条历史笔记已有更新，请重新载入后再修复。");
      }

      const timestamp = now().toISOString();
      const cleanDraft = cleanText(draft, "长文草稿", 100_000);
      const summary = generationSummary(generation);
      const summaryValidation = validationSummary(validation);
      const versionNumber = record.currentVersion + 1;
      record.versions.push({
        version: versionNumber,
        type,
        createdAt: timestamp,
        draft: cleanDraft,
        validation: summaryValidation,
        ...summary,
      });
      record.versions = record.versions.slice(-maxVersions);
      record.currentVersion = versionNumber;
      record.updatedAt = timestamp;
      record.title = titleFromDraft(cleanDraft);
      record.generation = summary;
      record.validation = summaryValidation;
      document.updatedAt = timestamp;

      await writeDocument(document);
      return clone(record);
    });
  }

  async function remove(id) {
    if (!UUID_PATTERN.test(id || "")) throw new Error("历史记录 ID 无效。");
    return enqueueWrite(async () => {
      const document = await readDocument();
      const index = document.records.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("历史记录不存在或已被删除。");
      document.records.splice(index, 1);
      document.updatedAt = now().toISOString();
      await writeDocument(document);
      return { ok: true, id };
    });
  }

  return {
    appendVersion,
    create,
    filePath,
    get,
    list,
    remove,
  };
}
