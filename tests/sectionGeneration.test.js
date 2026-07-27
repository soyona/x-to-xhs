import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSectionGenerationPrompt,
  parseSectionCandidates,
  validateSectionCandidates,
} from "../src/sectionGeneration.js";
import { replaceWorkflowSection } from "../src/workflowDraft.js";
import { PROTOTYPE_DRAFT_PASSED } from "../src/prototypeDraft.js";

test("局部生成提示词包含步骤约束、当前正文、偏好和旧候选", () => {
  const prompt = buildSectionGenerationPrompt({
    section: "publish-title",
    sourceContent: "原始 X 内容",
    draft: PROTOTYPE_DRAFT_PASSED,
    body: "当前正文",
    currentValue: "当前标题",
    previousCandidates: ["旧标题一", "旧标题二"],
    rejectionReasons: ["缺少吸引力"],
    preferences: { audience: "professional" },
  });

  assert.match(prompt, /生成恰好3个差异明显的发布标题/);
  assert.match(prompt, /当前正文/);
  assert.match(prompt, /旧标题一/);
  assert.match(prompt, /缺少吸引力/);
  assert.match(prompt, /目标读者：专业人士/);
  assert.match(prompt, /只输出严格JSON/);
});

test("正文局部生成提示词禁止叠加目录编号和标题Emoji", () => {
  const prompt = buildSectionGenerationPrompt({
    section: "body",
    sourceContent: "原始 X 内容",
    draft: PROTOTYPE_DRAFT_PASSED,
    body: "当前正文",
  });

  assert.match(prompt, /目录严格使用“-\s*标题”/);
  assert.match(prompt, /一级章节严格使用“# 01 标题”/);
  assert.match(prompt, /不得叠加章节编号、Emoji或其他行首符号/);
});

test("解析标题和标签候选时清理围栏、标题前缀与重复标签", () => {
  const titles = parseSectionCandidates(
    '```json\n{"candidates":["# 标题一","标题：标题二","“标题三”"]}\n```',
    "publish-title",
  );
  const tags = parseSectionCandidates(
    '{"candidates":["#AI工具 #内容创作 #AI工具 #效率提升 #自媒体 #写作方法 #创作者 #小红书长文 #搜索优化"]}',
    "tags",
  );

  assert.deepEqual(titles, ["标题一", "标题二", "标题三"]);
  assert.equal(
    tags[0],
    "#AI工具 #内容创作 #效率提升 #自媒体 #写作方法 #创作者 #小红书长文 #搜索优化",
  );
});

test("发布标题必须恰好三个且全部不超过20字", () => {
  assert.deepEqual(
    validateSectionCandidates(
      "publish-title",
      ["标题一", "标题二", "标题三"],
      { draft: PROTOTYPE_DRAFT_PASSED },
    ),
    ["标题一", "标题二", "标题三"],
  );
  assert.throws(
    () =>
      validateSectionCandidates(
        "publish-title",
        ["标题一", "标题二", "这是一个明显超过二十个字符限制的发布标题候选内容"],
        { draft: PROTOTYPE_DRAFT_PASSED },
      ),
    /未全部通过/,
  );
});

test("描述和标签候选通过整稿对应规则后才可返回", () => {
  const validDescription = `真正高质量的 X 转小红书长文，不是逐句翻译，也不是机械扩写，而是先判断哪些事实和观点值得保留。再围绕目标读者的真实问题重新组织内容，你会得到三个直接收益。

1. 事实边界更清楚，内容不会为了显得丰富而添加无法验证的案例
2. 信息结构更自然，读者能快速找到问题、方法与可以执行的下一步
3. 标题、摘要、标签与正文保持一致，发布前不再反复寻找遗漏

实际操作时，先提取事实、判断和经验，再标记读者痛点，随后用新的顺序完成二度创作，最后逐项检查标题、正文、摘要、标签和固定分区。始终保留可靠信息，主动删除无法验证的案例，并用短段落和列表控制阅读节奏，这比单纯追求篇幅更容易形成可信、可读、可行动的内容。`;
  const validTags =
    "#小红书长文 #内容创作 #AI写作 #创作者工具 #效率提升 #自媒体 #干货长文 #深度好文";

  assert.deepEqual(
    validateSectionCandidates("description", [validDescription], {
      draft: PROTOTYPE_DRAFT_PASSED,
    }),
    [validDescription],
  );
  assert.deepEqual(
    validateSectionCandidates("tags", [validTags], {
      draft: replaceWorkflowSection(
        PROTOTYPE_DRAFT_PASSED,
        "description",
        validDescription,
      ),
    }),
    [validTags],
  );
});
