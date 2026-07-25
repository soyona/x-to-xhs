import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import { splitXiaohongshuDraft } from "./xiaohongshuPublish";

function CopyStep({
  number,
  title,
  hint,
  value,
  meta,
  copied,
  onCopy,
  large = false,
  warning = false,
}) {
  return (
    <section className={`publish-step ${large ? "is-large" : ""}`}>
      <div className="publish-step-heading">
        <span className="publish-step-number">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <span className={`publish-step-meta ${warning ? "is-warning" : ""}`}>
          {meta}
        </span>
      </div>
      <div className="publish-copy-area">
        <pre>{value || "生成结果中未识别到此部分，请先在预览中检查。"}</pre>
        <button
          className="section-copy-button"
          type="button"
          onClick={onCopy}
          disabled={!value}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </section>
  );
}

function ActionStep({ number, title, children }) {
  return (
    <section className="publish-step is-action">
      <span className="publish-step-number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      <span className="platform-action">在小红书操作</span>
    </section>
  );
}

export function PublishWorkflow({ draft }) {
  const fields = useMemo(() => splitXiaohongshuDraft(draft), [draft]);
  const [copiedStep, setCopiedStep] = useState("");

  useEffect(() => {
    setCopiedStep("");
  }, [draft]);

  async function copyField(step, value) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedStep(step);
    window.setTimeout(() => {
      setCopiedStep((current) => (current === step ? "" : current));
    }, 1800);
  }

  return (
    <div className="publish-workflow">
      <div className="workflow-intro">
        <strong>按小红书「写长文」顺序分段复制</strong>
        <p>不要整篇一次复制。每完成一步，再复制下一项。</p>
      </div>

      <CopyStep
        number="01"
        title="输入长文标题"
        hint="粘贴到「写长文」编辑器的标题区域。"
        value={fields.longformTitle}
        meta={`${fields.counts.longformTitle}字`}
        copied={copiedStep === "longform-title"}
        onCopy={() => copyField("longform-title", fields.longformTitle)}
      />

      <CopyStep
        number="02"
        title="输入长文正文"
        hint="仅复制正文，不包含标题、摘要、标签、排版建议和审稿自查。"
        value={fields.body}
        meta={`${fields.counts.body.toLocaleString()}字`}
        copied={copiedStep === "body"}
        onCopy={() => copyField("body", fields.body)}
        large
      />

      <ActionStep number="03" title="点击「一键排版」">
        由小红书自动生成封面图片和内容卡片，确认排版后继续。
      </ActionStep>

      <CopyStep
        number="04"
        title="修改发布标题"
        hint="进入发布页后再次粘贴标题；平台限制 20 字。"
        value={fields.publishTitle}
        meta={`${fields.counts.publishTitle}/20字`}
        warning={fields.counts.publishTitle > 20}
        copied={copiedStep === "publish-title"}
        onCopy={() => copyField("publish-title", fields.publishTitle)}
      />

      <CopyStep
        number="05"
        title="输入正文描述"
        hint={
          fields.sources.description === "summary"
            ? "使用生成稿中的「正文小结 / 摘要」；平台限制 1000 字。"
            : "未识别到独立摘要，已自动提取正文结尾；平台限制 1000 字。"
        }
        value={fields.description}
        meta={`${fields.counts.description}/1000字`}
        warning={fields.counts.description > 1000}
        copied={copiedStep === "description"}
        onCopy={() => copyField("description", fields.description)}
      />

      <CopyStep
        number="06"
        title="输入标签"
        hint={
          fields.sources.tags === "default-fallback"
            ? "未识别到推荐标签，已补充通用 AI 标签，可在发布前调整。"
            : "复制推荐标签，粘贴到发布页标签区域。"
        }
        value={fields.tags}
        meta={`${fields.counts.tags}个`}
        copied={copiedStep === "tags"}
        onCopy={() => copyField("tags", fields.tags)}
      />

      <ActionStep number="07" title="检查并发布">
        检查封面、内容卡片、标题、描述和标签，确认无误后点击「发布」。
      </ActionStep>
    </div>
  );
}
