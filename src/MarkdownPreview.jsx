import React from "react";
import {
  AlignLeft,
  FileText,
  Heading1,
  ListTree,
  Tags,
} from "./components/ui/icons";

const EMPTY_COPY_SECTIONS = [
  { label: "长文标题", description: "候选标题与重新生成", Icon: Heading1 },
  { label: "长文正文", description: "预览、编辑、复制与导出", Icon: AlignLeft },
  { label: "正文描述", description: "发布页正文描述", Icon: ListTree },
  { label: "标签", description: "可直接粘贴的推荐标签", Icon: Tags },
];

function EmptyWorkflowGuide() {
  return (
    <div className="empty-state empty-workflow-guide">
      <div className="empty-workflow-heading">
        <span className="empty-workflow-kicker">PUBLISHING KIT</span>
        <h2>一份素材，四个可复制区块</h2>
        <p>从左侧加入内容或链接，生成后分别复制到小红书。</p>
      </div>

      <div className="empty-copy-layout">
        <div className="empty-source-card">
          <span className="empty-card-figure">INPUT</span>
          <span className="empty-source-icon" aria-hidden="true"><FileText /></span>
          <div>
            <strong>原始素材</strong>
            <small>文本 · 网页链接 · X 内容</small>
          </div>
        </div>

        <span className="empty-copy-connector" aria-hidden="true" />

        <ul className="empty-copy-grid" aria-label="生成后可复制到小红书的内容">
          {EMPTY_COPY_SECTIONS.map(({ label, description, Icon }, index) => (
            <li key={label}>
              <span className="empty-card-figure">OUTPUT 0.{index + 1}</span>
              <span className="empty-copy-icon" aria-hidden="true"><Icon /></span>
              <div>
                <strong>{label}</strong>
                <small>{description}</small>
              </div>
            </li>
          ))}
        </ul>
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
