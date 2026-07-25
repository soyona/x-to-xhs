const sectionMatchers = {
  overview: /(?:^|\n)#{0,3}\s*(?:\*\*)?框架总览/,
  practice:
    /(?:^|\n)#{0,3}\s*(?:\*\*)?(?:(?:0[1-9]|1[0-5])\s+💡\s+|▶️?\s+\d{1,2}\.\d+\s+)?[^\n]*实战落地/,
  conclusion:
    /(?:^|\n)#{0,3}\s*(?:\*\*)?(?:(?:0[1-9]|1[0-5])\s+💡\s+|▶️?\s+\d{1,2}\.\d+\s+)?[^\n]*(?:核心复盘总结|结尾|结语|写在最后)/,
  summary: /(?:^|\n)#{0,3}\s*(?:\*\*)?(?:正文小结\s*[\/／]\s*摘要|正文小结|摘要)/,
  tags: /(?:^|\n)#{0,3}\s*(?:\*\*)?推荐标签/,
  review: /(?:^|\n)#{0,3}\s*(?:\*\*)?【?审稿自查】?/,
};

const legacyLayoutMatcher =
  /(?:^|\n)#{0,3}\s*(?:\*\*)?排版风格建议/;

export const validationGroups = [
  {
    id: "title",
    number: "1",
    label: "标题",
    items: [{ id: "title", label: "字数" }],
  },
  {
    id: "body",
    number: "2",
    label: "正文内容",
    items: [
      { id: "body", label: "总字数" },
      { id: "opening", label: "开头" },
      { id: "structure", label: "主体结构" },
      { id: "practice", label: "实战落地" },
    ],
  },
  {
    id: "summary",
    number: "3",
    label: "正文小结 / 摘要",
    items: [
      { id: "summary", label: "摘要字数" },
      { id: "description-limit", label: "发布描述" },
    ],
  },
  {
    id: "tags",
    number: "4",
    label: "推荐标签",
    items: [
      { id: "tags", label: "标签数量" },
      { id: "tag-format", label: "标签格式" },
    ],
  },
  {
    id: "format",
    number: "5",
    label: "输出结构",
    items: [{ id: "fixed-format", label: "分区与顺序" }],
  },
  {
    id: "review",
    number: "6",
    label: "审稿自查",
    items: [{ id: "review", label: "风险点数量" }],
  },
  {
    id: "manual",
    number: "人工",
    label: "人工内容复核",
    manual: true,
    items: [
      {
        id: "manual-rewrite",
        label: "二度创作",
        manual: true,
        requirement: "重构原文逻辑，不大量复刻或直接改写",
      },
      {
        id: "manual-cases",
        label: "案例与洞见",
        manual: true,
        requirement: "有可靠依据时使用案例、失败复盘和跨领域洞见；不得为凑篇幅虚构",
      },
      {
        id: "manual-tone",
        label: "语气与表达",
        manual: true,
        requirement: "专业温暖、经验分享、轻对话；无销售腔、模板腔和术语堆砌",
      },
      {
        id: "manual-practice",
        label: "实战完整性",
        manual: true,
        requirement: "步骤、工具、Checklist、量化收益、阶段路径、避坑建议、真实案例",
      },
      {
        id: "manual-ending",
        label: "结尾互动",
        manual: true,
        requirement: "核心价值总结＋趋势思辨＋2–3个开放问题",
      },
      {
        id: "manual-layout",
        label: "排版可读性",
        manual: true,
        requirement:
          "自然段不超过100字；列表行20–30字；用章节标题和空行组织节奏，无伪分页信号",
      },
      {
        id: "manual-summary-tags",
        label: "摘要与标签质量",
        manual: true,
        requirement: "摘要前2句有吸引力并突出收益；标签精准、高搜索、冷热结合",
      },
      {
        id: "manual-review",
        label: "审稿建议质量",
        manual: true,
        requirement: "3–5个风险点均给出具体修改建议",
      },
    ],
  },
];

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-|[\](){}【】《》“”‘’，。！？：；、…—\s]/gu, "");
}

function countPlatformCharacters(value = "") {
  return Array.from(value.trim()).length;
}

function countEmoji(value = "") {
  const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).filter(({ segment }) =>
    /\p{Extended_Pictographic}/u.test(segment),
  ).length;
}

export function countCharacters(value = "") {
  return Array.from(stripMarkdown(value)).filter((char) =>
    /[\p{L}\p{N}]/u.test(char),
  ).length;
}

function headingIndex(text, matcher) {
  const match = matcher.exec(text);
  return match ? match.index : -1;
}

function headingMatch(text, matcher) {
  return matcher.exec(text);
}

function containsMarkdownHeading(text, start, end = text.length) {
  return /(?:^|\n)#{1,3}\s+\S/u.test(text.slice(start, end));
}

function nextKnownSection(text, from, names) {
  return names
    .map((name) => headingIndex(text.slice(from), sectionMatchers[name]))
    .filter((index) => index >= 0)
    .map((index) => index + from)
    .sort((a, b) => a - b)[0] ?? text.length;
}

export function extractTitle(markdown = "") {
  const lines = markdown.split("\n").map((line) => line.trim());
  const heading = lines.find((line) => /^#{1,2}\s+\S/.test(line));
  const fallback = lines.find(
    (line) => line && !/^[-*>`]|\[建议配图/.test(line),
  );
  return (heading || fallback || "")
    .replace(/^#{1,2}\s+/, "")
    .replace(/^\*\*标题[：:]\*\*\s*/, "")
    .replace(/^标题[：:]\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .trim();
}

export function getSection(markdown, name, followingNames) {
  const start = headingIndex(markdown, sectionMatchers[name]);
  if (start < 0) return "";
  const end = nextKnownSection(markdown, start + 1, followingNames);
  return markdown.slice(start, end);
}

function countListItems(value) {
  return (value.match(/(?:^|\n)\s*(?:[-*+]|\d+[.、）)])\s+/g) || []).length;
}

function bodyText(markdown) {
  const title = extractTitle(markdown);
  const start = title ? markdown.indexOf(title) + title.length : 0;
  const end = nextKnownSection(markdown, start, [
    "summary",
    "tags",
    "review",
  ]);
  return markdown.slice(start, end);
}

function inspectChapterStructure(body) {
  const chapterPattern =
    /(?:^|\n)#\s+(0[1-9]|1[0-5])\s+💡\s+[^\n]+/gu;
  const chapterMatches = Array.from(body.matchAll(chapterPattern)).map(
    (match) => {
      const leadingBreak = match[0].startsWith("\n") ? 1 : 0;
      return {
        number: Number(match[1]),
        start: match.index + leadingBreak,
        contentStart: match.index + match[0].length,
      };
    },
  );
  const expectedNumbers = chapterMatches.map((_, index) => index + 1);
  const numbersAreSequential = chapterMatches.every(
    (chapter, index) => chapter.number === expectedNumbers[index],
  );
  const chapterCountValid =
    chapterMatches.length >= 2 && chapterMatches.length <= 15;

  const chapters = chapterMatches.map((chapter, index) => {
    const end = chapterMatches[index + 1]?.start ?? body.length;
    const content = body.slice(chapter.contentStart, end);
    const nodePattern =
      /(?:^|\n)##\s+▶️?\s+(\d{1,2})\.(\d+)\s+[^\n]+/gu;
    const nodeMatches = Array.from(content.matchAll(nodePattern)).map(
      (match) => ({
        chapterNumber: Number(match[1]),
        nodeNumber: Number(match[2]),
      }),
    );
    const nodesAreSequential = nodeMatches.every(
      (node, nodeIndex) =>
        node.chapterNumber === chapter.number &&
        node.nodeNumber === nodeIndex + 1,
    );

    return {
      nodeCountValid: nodeMatches.length >= 1 && nodeMatches.length <= 3,
      nodesAreSequential,
    };
  });

  const hasFalsePaginationSignal =
    /(?:^|\n)\s*---\s*(?:\n|$)|未完待续|下滑查看下一章/u.test(body);

  return {
    chapterCount: chapterMatches.length,
    valid:
      chapterCountValid &&
      numbersAreSequential &&
      !hasFalsePaginationSignal &&
      chapters.every(
        (chapter) =>
          chapter.nodeCountValid &&
          chapter.nodesAreSequential,
      ),
  };
}

export function validateDraft(markdown = "") {
  const title = extractTitle(markdown);
  const body = bodyText(markdown);
  const overviewStart = headingIndex(body, sectionMatchers.overview);
  const opening = overviewStart >= 0 ? body.slice(0, overviewStart) : "";
  const practice = getSection(markdown, "practice", [
    "summary",
    "tags",
    "review",
  ]);
  const summary = getSection(markdown, "summary", ["tags", "review"]);
  const tags = getSection(markdown, "tags", ["review"]);
  const review = getSection(markdown, "review", []);

  const titleCount = countPlatformCharacters(title);
  const titleEmojiCount = countEmoji(title);
  const titleHasDepthHook = /超全干货|万字深度/u.test(title);
  const bodyCount = countCharacters(body);
  const titleLengthClaimValid =
    !/万字深度/u.test(title) || bodyCount >= 8000;
  const openingCount = countCharacters(opening);
  const practiceCount = countCharacters(
    practice.replace(sectionMatchers.practice, ""),
  );
  const summaryCount = countCharacters(
    summary.replace(sectionMatchers.summary, ""),
  );
  const descriptionCount = countPlatformCharacters(
    summary
      .replace(sectionMatchers.summary, "")
      .replace(/^#+\s*/u, "")
      .replace(/\*\*/gu, "")
      .trim(),
  );
  const tagCount = new Set(tags.match(/#[\p{L}\p{N}_-]+/gu) || []).size;
  const tagContent = tags.replace(sectionMatchers.tags, "").trim();
  const tagLines = tagContent.split("\n").filter((line) => line.trim());
  const tagFormatValid =
    tagLines.length === 1 &&
    tagCount > 0 &&
    tagLines[0].replace(/#[\p{L}\p{N}_-]+/gu, "").trim() === "";
  const reviewCount = countListItems(review);
  const chapterStructure = inspectChapterStructure(body);
  const summaryMatch = headingMatch(markdown, sectionMatchers.summary);
  const tagsMatch = headingMatch(markdown, sectionMatchers.tags);
  const reviewMatch = headingMatch(markdown, sectionMatchers.review);
  const summaryIndex = summaryMatch?.index ?? -1;
  const tagsIndex = tagsMatch?.index ?? -1;
  const reviewIndex = reviewMatch?.index ?? -1;
  const hasUnexpectedFixedSection =
    (summaryMatch &&
      tagsIndex > summaryIndex &&
      containsMarkdownHeading(
        markdown,
        summaryIndex + summaryMatch[0].length,
        tagsIndex,
      )) ||
    (tagsMatch &&
      reviewIndex > tagsIndex &&
      containsMarkdownHeading(
        markdown,
        tagsIndex + tagsMatch[0].length,
        reviewIndex,
      )) ||
    (reviewMatch &&
      containsMarkdownHeading(
        markdown,
        reviewIndex + reviewMatch[0].length,
      ));
  const fixedFormatValid =
    /^\uFEFF?#\s+\S/u.test(markdown) &&
    summaryIndex >= 0 &&
    tagsIndex > summaryIndex &&
    reviewIndex > tagsIndex &&
    !hasUnexpectedFixedSection &&
    !legacyLayoutMatcher.test(markdown);
  const structureValid =
    sectionMatchers.overview.test(markdown) &&
    sectionMatchers.practice.test(markdown) &&
    sectionMatchers.conclusion.test(markdown) &&
    chapterStructure.valid;

  const checks = [
    {
      id: "title",
      label: "标题",
      requirement:
        "标题18–20字，恰好2个Emoji；默认含“超全干货”，正文8000字以上才可用“万字深度”",
      actual: `${titleCount}字，${titleEmojiCount}个Emoji，${
        titleHasDepthHook ? "含深度钩子" : "缺少深度钩子"
      }，${titleLengthClaimValid ? "篇幅表述真实" : "错误宣称万字"}`,
      pass:
        titleCount >= 18 &&
        titleCount <= 20 &&
        titleEmojiCount === 2 &&
        titleHasDepthHook &&
        titleLengthClaimValid,
    },
    {
      id: "body",
      label: "正文",
      requirement: "正文按原文自然展开，不超过10000字",
      actual: `${bodyCount}字`,
      pass: bodyCount > 0 && bodyCount <= 10000,
    },
    {
      id: "opening",
      label: "开头",
      requirement: "开头简洁完整，建议150–450字",
      actual: opening ? `${openingCount}字` : "无法识别",
      pass: openingCount > 0 && openingCount <= 450,
    },
    {
      id: "practice",
      label: "实战落地",
      requirement: "实战落地按主题需要展开，不设最低字数",
      actual: practice ? `${practiceCount}字` : "缺失",
      pass: practiceCount > 0,
    },
    {
      id: "summary",
      label: "摘要",
      requirement: "摘要220–280字",
      actual: summary ? `${summaryCount}字` : "缺失",
      pass: summaryCount >= 220 && summaryCount <= 280,
    },
    {
      id: "description-limit",
      label: "正文描述",
      requirement: "摘要作为发布描述且不超过1000字",
      actual: summary ? `${descriptionCount}字` : "缺失",
      pass: descriptionCount > 0 && descriptionCount <= 1000,
    },
    {
      id: "tags",
      label: "推荐标签",
      requirement: "恰好8个唯一标签",
      actual: `${tagCount}个`,
      pass: tagCount === 8,
    },
    {
      id: "structure",
      label: "正文结构",
      requirement:
        "含#框架总览、2–15个#一级章节、每章1–3个##二级节点、实战落地和核心复盘；无伪分页信号",
      actual: structureValid
        ? `${chapterStructure.chapterCount}章，结构完整`
        : `${chapterStructure.chapterCount}章，结构不完整`,
      pass: structureValid,
    },
    {
      id: "fixed-format",
      label: "固定格式",
      requirement: "首行#标题；摘要→标签→自查；无额外分区",
      actual: fixedFormatValid ? "正确" : "不正确",
      pass: fixedFormatValid,
    },
    {
      id: "tag-format",
      label: "标签格式",
      requirement: "全部标签同一行，每个以#开头",
      actual: tagFormatValid ? "正确" : "不正确",
      pass: tagFormatValid,
    },
    {
      id: "review",
      label: "审稿自查",
      requirement: "3–5条风险或优化建议",
      actual: review ? `${reviewCount}点` : "缺失",
      pass: reviewCount >= 3 && reviewCount <= 5,
    },
  ];

  return {
    checks,
    valid: checks.every((check) => check.pass),
    counts: {
      titleCount,
      titleEmojiCount,
      titleHasDepthHook,
      titleLengthClaimValid,
      bodyCount,
      openingCount,
      practiceCount,
      summaryCount,
      descriptionCount,
      tagCount,
    },
  };
}
