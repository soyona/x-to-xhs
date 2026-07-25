import assert from "node:assert/strict";
import test from "node:test";
import { buildRepairPrompt } from "../server.mjs";
import {
  MAX_REPAIR_ATTEMPTS,
  getRepairStrategy,
} from "../src/repairStrategy.js";

function validationWithFailures(count, { bodyCount = 4500, structure } = {}) {
  const checks = Array.from({ length: 11 }, (_, index) => ({
    id: index === 7 ? "structure" : `check-${index}`,
    label: `检查${index + 1}`,
    requirement: "符合要求",
    actual: index === 7 && structure ? structure : "当前值",
    pass: index >= count,
  }));
  return { checks, counts: { bodyCount } };
}

test("按失败数量选择局部修复、结构化修订或完整重生", () => {
  assert.equal(getRepairStrategy(validationWithFailures(2)).mode, "repair");
  assert.equal(getRepairStrategy(validationWithFailures(5)).mode, "revise");
  assert.equal(getRepairStrategy(validationWithFailures(7)).mode, "regenerate");
  assert.equal(
    getRepairStrategy(validationWithFailures(1, { bodyCount: 2000 })).mode,
    "regenerate",
  );
  assert.equal(MAX_REPAIR_ATTEMPTS, 2);
});

test("修复提示词包含失败值、通过项、当前草稿和原始内容", async () => {
  const prompt = await buildRepairPrompt({
    input: "原始 X 内容",
    draft: "# 当前草稿",
    failedChecks: [
      {
        label: "标题",
        actual: "14字",
        requirement: "18–20字",
      },
    ],
    passedChecks: [{ label: "标签", actual: "9个" }],
    mode: "repair",
  });

  assert.match(prompt, /原始 X 内容/);
  assert.match(prompt, /标题：当前14字，要求18–20字/);
  assert.match(prompt, /标签：9个/);
  assert.match(prompt, /# 当前草稿/);
  assert.match(prompt, /只修复失败项目/);
  assert.match(prompt, /只输出修复后的完整 Markdown 草稿/);
});

test("完整重生模式明确放弃不完整结构", async () => {
  const prompt = await buildRepairPrompt({
    input: "原始内容",
    draft: "残缺草稿",
    failedChecks: [
      { label: "正文", actual: "800字", requirement: "4200–5200字" },
    ],
    mode: "regenerate",
  });

  assert.match(prompt, /放弃其不完整结构/);
  assert.match(prompt, /重新根据原始 X 内容生成/);
});
