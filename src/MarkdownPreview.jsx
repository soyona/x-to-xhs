import React from "react";
import {
  AlignLeft,
  BadgeCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Heading1,
  LayoutGrid,
  ListTree,
  Send,
  Sparkles,
  Tags,
} from "./components/ui/icons";

const EMPTY_WORKFLOW_STAGES = [
  {
    title: "粘贴 X 素材",
    description: "在左侧粘贴内容或链接",
    Icon: FileText,
  },
  {
    title: "AI 二度创作",
    description: "提炼观点并重组为中文长文",
    Icon: Sparkles,
  },
  {
    title: "分步复制到小红书",
    description: "按 6 个步骤依次完成",
    Icon: ClipboardList,
  },
  {
    title: "预览并发布",
    description: "复核内容后手动发布",
    Icon: Send,
  },
];

const EMPTY_PUBLISHING_STEPS = [
  { number: "01", label: "长文标题", Icon: Heading1 },
  { number: "02", label: "长文正文", Icon: AlignLeft },
  { number: "03", label: "一键排版", Icon: LayoutGrid },
  { number: "04", label: "正文描述", Icon: ListTree },
  { number: "05", label: "标签", Icon: Tags },
  { number: "06", label: "预览并发布", Icon: BadgeCheck },
];

function EmptyWorkflowGuide() {
  return (
    <div className="empty-state empty-workflow-guide">
      <div className="empty-workflow-heading">
        <h2>从一条 X 推文，到可发布的小红书长文</h2>
        <p>先粘贴素材，生成后按 6 个步骤完成发布。</p>
      </div>

      <div className="workflow-map" aria-label="X 推文转小红书长文完整流程">
        <ol className="workflow-map-stages">
          {EMPTY_WORKFLOW_STAGES.map(({ title, description, Icon }, index) => (
            <React.Fragment key={title}>
              <li className="workflow-map-stage">
                {index === 0 && (
                  <span className="workflow-start-cue">从左侧开始</span>
                )}
                <span className="workflow-stage-icon" aria-hidden="true">
                  <Icon />
                </span>
                <strong>{title}</strong>
                <small>{description}</small>
              </li>
              {index < EMPTY_WORKFLOW_STAGES.length - 1 && (
                <li className="workflow-map-connector" aria-hidden="true">
                  <span />
                  <ChevronRight />
                </li>
              )}
            </React.Fragment>
          ))}
        </ol>

        <div className="publishing-route" aria-label="小红书长文 6 步发布流程">
          <span className="publishing-route-branch" aria-hidden="true" />
          <ol className="publishing-route-steps">
            {EMPTY_PUBLISHING_STEPS.map(({ number, label, Icon }) => (
              <li key={number}>
                <span className="publishing-step-number">{number}</span>
                <span className="publishing-step-icon" aria-hidden="true">
                  <Icon />
                </span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function inlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

export function MarkdownPreview({ markdown }) {
  if (!markdown) {
    return <EmptyWorkflowGuide />;
  }

  const blocks = markdown.split("\n");
  return (
    <article className="markdown-document">
      {blocks.map((line, index) => {
        if (!line.trim()) return <div className="paragraph-gap" key={index} />;
        if (/^###\s+/.test(line))
          return <h3 key={index}>{inlineMarkdown(line.replace(/^###\s+/, ""))}</h3>;
        if (/^##\s+/.test(line))
          return <h2 key={index}>{inlineMarkdown(line.replace(/^##\s+/, ""))}</h2>;
        if (/^#\s+/.test(line))
          return <h1 key={index}>{inlineMarkdown(line.replace(/^#\s+/, ""))}</h1>;
        if (/^\s*[-*+]\s+/.test(line))
          return (
            <div className="list-line" key={index}>
              <span aria-hidden="true">•</span>
              <p>{inlineMarkdown(line.replace(/^\s*[-*+]\s+/, ""))}</p>
            </div>
          );
        if (/^\s*\d+[.、）)]\s+/.test(line))
          return <p key={index}>{inlineMarkdown(line)}</p>;
        if (/^【建议配图[：:]/.test(line.trim()))
          return (
            <aside className="image-note" key={index}>
              {line.trim()}
            </aside>
          );
        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </article>
  );
}
