import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHistoryStore } from "../historyStore.mjs";

function generation(provider = "gemini") {
  const providerLabel = provider === "gemini" ? "Gemini" : "Groq Qwen";
  return {
    provider,
    providerLabel,
    model: provider === "gemini" ? "gemini-test" : "qwen-test",
    usage: {
      input: 1_200,
      output: 800,
      total: 2_000,
    },
    attempts:
      provider === "gemini"
        ? [
            {
              provider: "gemini",
              label: "Gemini",
              model: "gemini-test",
              status: "success",
              message: "生成成功",
              keyIndex: 1,
              keyCount: 2,
              durationMs: 820,
            },
          ]
        : [
            {
              provider: "gemini",
              label: "Gemini",
              model: "gemini-test",
              status: "failed",
              reason: "quota",
              message: "Gemini 额度或速率限制已用尽。",
              statusCode: 429,
              keyIndex: 1,
              keyCount: 1,
              durationMs: 320,
            },
            {
              provider,
              label: providerLabel,
              model: "qwen-test",
              status: "success",
              message: "生成成功",
              durationMs: 900,
            },
          ],
  };
}

function recordInput(title, source = "原始 X 内容") {
  return {
    source: {
      mode: "x-content",
      content: source,
      sourceUrl: "https://x.com/example/status/123",
      authorHandle: "example",
      authorName: "Example Author",
    },
    draft: `# ${title}\n\n正文`,
    generation: generation(),
  };
}

test("历史记录按最近更新时间倒序，内容更新追加版本并只保留最近三版", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-history-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const timestamps = [
    "2026-07-25T10:00:00.000Z",
    "2026-07-25T11:00:00.000Z",
    "2026-07-25T12:00:00.000Z",
    "2026-07-25T13:00:00.000Z",
    "2026-07-25T14:00:00.000Z",
  ];
  const store = createHistoryStore({
    dataDir,
    now: () => new Date(timestamps.shift()),
  });

  const first = await store.create(recordInput("第一篇"));
  const second = await store.create(recordInput("第二篇"));
  await store.appendVersion(first.id, {
    expectedVersion: 1,
    draft: "# 第一篇更新一\n\n正文",
    generation: generation("groq"),
  });
  await store.appendVersion(first.id, {
    expectedVersion: 2,
    draft: "# 第一篇更新二\n\n正文",
    generation: generation(),
  });
  const latest = await store.appendVersion(first.id, {
    expectedVersion: 3,
    draft: "# 第一篇最终版\n\n正文",
    generation: generation(),
  });

  const list = await store.list();
  assert.deepEqual(
    list.records.map((record) => record.id),
    [first.id, second.id],
  );
  assert.equal(latest.currentVersion, 4);
  assert.deepEqual(
    latest.versions.map((version) => version.version),
    [2, 3, 4],
  );
  assert.equal(latest.title, "第一篇最终版");
  assert.deepEqual(latest.versions.at(-1).usage, {
    input: 1_200,
    output: 800,
    total: 2_000,
  });
  assert.deepEqual(
    latest.versions[0].attempts.map(
      ({ provider, status, reason, statusCode }) => ({
        provider,
        status,
        reason,
        statusCode,
      }),
    ),
    [
      {
        provider: "gemini",
        status: "failed",
        reason: "quota",
        statusCode: 429,
      },
      {
        provider: "groq",
        status: "success",
        reason: null,
        statusCode: null,
      },
    ],
  );
  assert.deepEqual(
    {
      mode: first.source.mode,
      url: first.source.url,
      authorHandle: first.source.authorHandle,
      authorName: first.source.authorName,
    },
    {
      mode: "x-content",
      url: "https://x.com/example/status/123",
      authorHandle: "example",
      authorName: "Example Author",
    },
  );

  const mode = (await stat(store.filePath)).mode & 0o777;
  const directoryMode = (await stat(dataDir)).mode & 0o777;
  assert.equal(mode, 0o600);
  assert.equal(directoryMode, 0o700);
  assert.doesNotMatch(await readFile(store.filePath, "utf8"), /api.?key/iu);
});

test("历史记录执行版本冲突检查、容量限制和删除", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-history-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  let minute = 0;
  const store = createHistoryStore({
    dataDir,
    maxRecords: 1,
    now: () => new Date(`2026-07-25T10:${String(minute++).padStart(2, "0")}:00Z`),
  });

  const record = await store.create(recordInput("容量测试"));
  await assert.rejects(
    store.create(recordInput("第二条")),
    /历史记录已达到1条/,
  );
  await assert.rejects(
    store.appendVersion(record.id, {
      expectedVersion: 9,
      draft: "# 冲突版本\n\n正文",
      generation: generation(),
    }),
    /已有更新/,
  );

  assert.deepEqual(await store.remove(record.id), {
    ok: true,
    id: record.id,
  });
  assert.equal((await store.list()).total, 0);
  await assert.rejects(store.get(record.id), /不存在或已被删除/);
});

test("主历史文件损坏时从最近的有效备份读取且不覆盖原文件", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "x-to-xhs-history-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  let hour = 10;
  const store = createHistoryStore({
    dataDir,
    now: () => new Date(`2026-07-25T${hour++}:00:00Z`),
  });

  const record = await store.create(recordInput("备份测试"));
  await store.appendVersion(record.id, {
    expectedVersion: 1,
    draft: "# 备份测试第二版\n\n正文",
    generation: generation(),
  });
  await writeFile(store.filePath, "{not-json", "utf8");

  const recovered = await store.get(record.id);
  assert.equal(recovered.currentVersion, 1);
  assert.equal(await readFile(store.filePath, "utf8"), "{not-json");
});
