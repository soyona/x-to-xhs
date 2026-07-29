import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  RefreshIcon,
} from "./icons";
import {
  buildMarkdownBody,
  buildMarkdownFilename,
} from "./markdownExport";
import {
  countPlatformCharacters,
  splitXiaohongshuDraft,
} from "./xiaohongshuPublish";
import {
  toXiaohongshuPlainText,
  toXiaohongshuRichHtml,
} from "./xiaohongshuText";

const emptySectionGeneration = {
  status: "idle",
  candidates: [],
  error: "",
  sourceMode: "content-only",
  sourceUpdatedAt: null,
};

function initialSectionGenerations() {
  return {
    "longform-title": { ...emptySectionGeneration },
    body: { ...emptySectionGeneration },
    "publish-title": { ...emptySectionGeneration },
    description: { ...emptySectionGeneration },
    tags: { ...emptySectionGeneration },
  };
}

function GenerationPanel({
  section,
  candidates,
  currentValue,
  status,
  error,
  sourceMode,
  sourceUpdatedAt,
  disabled,
  onSelect,
}) {
  const hasMultipleCandidates =
    section === "longform-title" || section === "publish-title";
  const candidateLabel = {
    "longform-title": "长文标题候选",
    body: "正文新版本",
    "publish-title": "发布标题候选",
    description: "正文描述新版本",
    tags: "标签新版本",
  }[section];
  const isGenerating = status === "generating";

  if (!candidates.length && !error) return null;

  return (
    <div className={`section-generation is-${section}`}>
      <div className="section-generation-toolbar">
        <div>
          <strong>{candidateLabel}</strong>
          {section === "body" && (
            <small>采用新正文后，步骤 04–06 会标记为需要复核。</small>
          )}
          {section === "tags" && (
            <small>
              {sourceMode === "trend"
                ? `结合趋势数据${sourceUpdatedAt ? ` · ${sourceUpdatedAt}` : ""}`
                : "基于正文生成 · 未使用实时趋势数据"}
            </small>
          )}
        </div>
      </div>

      {error && (
        <p className="section-generation-error" role="alert">
          {error}
        </p>
      )}

      {candidates.length > 0 && (
        <div
          className={`section-candidate-list ${
            hasMultipleCandidates ? "is-multiple" : "is-single"
          }`}
          aria-label={candidateLabel}
        >
          {candidates.map((candidate, index) => {
            const selected = candidate === currentValue;
            return (
              <button
                className={`section-candidate ${selected ? "is-selected" : ""}`}
                type="button"
                key={`${section}-${candidate}`}
                aria-pressed={selected}
                disabled={disabled || isGenerating}
                onClick={() => onSelect(candidate)}
              >
                <span className="candidate-index">
                  {selected ? <CheckIcon /> : index + 1}
                </span>
                <span className="candidate-content">{candidate}</span>
                {!hasMultipleCandidates && (
                  <span className="candidate-apply">
                    {selected ? "已采用" : "采用此版本"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyStep({
  number,
  title,
  hint,
  value,
  meta,
  copied,
  onCopy,
  copyLabel = "复制",
  copyAriaLabel = copyLabel,
  exportStatus = "",
  onExport,
  generationControls,
  children,
  previewSize = "compact",
  expandable = false,
  warning = false,
  stale = false,
  disabled = false,
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [value]);

  return (
    <section
      className="publish-step"
      id={`publish-step-${number}`}
    >
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
      {stale && (
        <div className="section-stale-notice" role="status">
          <AlertIcon />
          <span>基于上一版正文生成，建议重新生成或人工确认后继续。</span>
        </div>
      )}
      {generationControls?.panel}
      <div
        className={`publish-copy-area is-${previewSize} ${expanded ? "is-expanded" : ""}`}
      >
        <div className="publish-copy-toolbar">
          <div className="publish-copy-toolbar-meta">
            <span>内容预览</span>
            {expandable && (
              <button
                className="publish-preview-toggle"
                type="button"
                aria-expanded={expanded}
                aria-controls={`publish-step-${number}-preview`}
                onClick={() => setExpanded((current) => !current)}
                disabled={!value}
              >
                {expanded ? "收起正文" : "展开正文"}
              </button>
            )}
          </div>
          <div className="publish-copy-actions">
            {generationControls?.action}
            <button
              className="section-copy-button"
              type="button"
              title={copied ? `${copyAriaLabel}，已复制` : copyAriaLabel}
              aria-label={copied ? `${copyAriaLabel}，已复制` : copyAriaLabel}
              onClick={onCopy}
              disabled={!value || disabled}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            {onExport && (
              <button
                className="section-copy-button section-export-button"
                type="button"
                title={
                  exportStatus === "success"
                    ? "Markdown 正文已导出"
                    : exportStatus === "error"
                      ? "重试导出 Markdown 正文"
                      : "下载 Markdown（部分格式可能不受小红书导入支持）"
                }
                aria-label={
                  exportStatus === "success"
                    ? "Markdown 正文已导出"
                    : exportStatus === "error"
                      ? "重试导出 Markdown 正文"
                      : "下载 Markdown（部分格式可能不受小红书导入支持）"
                }
                onClick={onExport}
                disabled={!value || disabled}
              >
                {exportStatus === "success" ? (
                  <CheckIcon />
                ) : (
                  <DownloadIcon />
                )}
              </button>
            )}
          </div>
        </div>
        <pre
          id={`publish-step-${number}-preview`}
          aria-label={`${title}内容预览`}
          tabIndex="0"
        >
          {value || "生成结果中未识别到此部分，请先检查当前草稿。"}
        </pre>
        {exportStatus && (
          <span
            className={`markdown-export-feedback ${exportStatus}`}
            role={exportStatus === "error" ? "alert" : "status"}
          >
            {exportStatus === "success"
              ? "Markdown 正文已导出"
              : "导出失败，请重试或复制正文"}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ActionStep({ number, title, description, children }) {
  return (
    <section className="publish-step is-action" id={`publish-step-${number}`}>
      <div className="publish-step-heading">
        <span className="publish-step-number">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="platform-action">在小红书操作</span>
      </div>
      {children}
    </section>
  );
}

function WorkflowSummary({ historyCount, onRestore }) {
  return (
    <div className="workflow-summary pass" aria-live="polite">
      <div className="workflow-summary-copy">
        <span className="workflow-summary-icon">
          <CheckIcon />
        </span>
        <div>
          <strong>内容已生成，可按需要选择或重新生成</strong>
          <p>
            内容质量由当前提示词方案控制，系统不再执行内容规则判定。
          </p>
        </div>
      </div>
      <div className="workflow-summary-actions">
        {historyCount > 0 && (
          <button
            className="summary-restore-button"
            type="button"
            onClick={onRestore}
          >
            恢复上一版本
          </button>
        )}
      </div>
    </div>
  );
}

export function PublishWorkflow({
  draft,
  historyCount,
  onRestore,
  workflowId,
  autoGenerateTitles,
  onGenerateSection,
  onApplySection,
}) {
  const fields = useMemo(() => splitXiaohongshuDraft(draft), [draft]);
  const [copiedStep, setCopiedStep] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [publishTitle, setPublishTitle] = useState(fields.publishTitle);
  const [bodyVersion, setBodyVersion] = useState(1);
  const [sectionBodyVersions, setSectionBodyVersions] = useState({
    "publish-title": 1,
    description: 1,
    tags: 1,
  });
  const [sectionGenerations, setSectionGenerations] = useState(
    initialSectionGenerations,
  );
  const initializedWorkflowRef = useRef(null);
  const automaticRequestTokenRef = useRef(0);

  useEffect(() => {
    setCopiedStep("");
    setExportStatus("");
  }, [draft]);

  useEffect(() => {
    if (initializedWorkflowRef.current === workflowId) return;
    initializedWorkflowRef.current = workflowId;
    automaticRequestTokenRef.current += 1;
    const requestToken = automaticRequestTokenRef.current;
    setPublishTitle(fields.publishTitle);
    setBodyVersion(1);
    setSectionBodyVersions({
      "publish-title": 1,
      description: 1,
      tags: 1,
    });
    setSectionGenerations(initialSectionGenerations());
    if (!autoGenerateTitles) return;

    async function loadInitialCandidates(section, currentValue) {
      setSectionGenerations((current) => ({
        ...current,
        [section]: {
          ...current[section],
          status: "generating",
          error: "",
        },
      }));
      try {
        const result = await onGenerateSection({
          section,
          currentValue,
          previousCandidates: [],
        });
        if (automaticRequestTokenRef.current !== requestToken) return;
        setSectionGenerations((current) => ({
          ...current,
          [section]: {
            status: "ready",
            candidates: result.candidates,
            error: "",
            sourceMode: result.sourceMode || "content-only",
            sourceUpdatedAt: result.sourceUpdatedAt || null,
          },
        }));
        const preferred = result.candidates[0];
        if (section === "longform-title") {
          onApplySection(section, preferred);
        } else {
          setPublishTitle(preferred);
          setSectionBodyVersions((current) => ({
            ...current,
            "publish-title": 1,
          }));
        }
      } catch (generationError) {
        if (automaticRequestTokenRef.current !== requestToken) return;
        setSectionGenerations((current) => ({
          ...current,
          [section]: {
            ...current[section],
            status: "error",
            error: generationError.message,
          },
        }));
      }
    }

    void loadInitialCandidates("longform-title", fields.longformTitle);
    void loadInitialCandidates("publish-title", fields.publishTitle);
  }, [workflowId]);

  async function regenerateSection(section) {
    const previous = sectionGenerations[section].candidates;
    const currentValue = {
      "longform-title": fields.longformTitle,
      body: fields.body,
      "publish-title": publishTitle,
      description: fields.description,
      tags: fields.tags,
    }[section];
    setSectionGenerations((current) => ({
      ...current,
      [section]: {
        ...current[section],
        status: "generating",
        error: "",
      },
    }));
    try {
      const result = await onGenerateSection({
        section,
        currentValue,
        previousCandidates: previous,
      });
      setSectionGenerations((current) => ({
        ...current,
        [section]: {
          status: "ready",
          candidates: result.candidates,
          error: "",
          sourceMode: result.sourceMode || "content-only",
          sourceUpdatedAt: result.sourceUpdatedAt || null,
        },
      }));
    } catch (generationError) {
      setSectionGenerations((current) => ({
        ...current,
        [section]: {
          ...current[section],
          status: "error",
          error: generationError.message,
        },
      }));
    }
  }

  function selectCandidate(section, candidate) {
    if (section === "publish-title") {
      setPublishTitle(candidate);
      setSectionBodyVersions((current) => ({
        ...current,
        "publish-title": bodyVersion,
      }));
      return;
    }
    if (section === "body" && candidate === fields.body) return;
    onApplySection(section, candidate);
    if (section === "body") {
      setBodyVersion((current) => current + 1);
      return;
    }
    if (section === "description" || section === "tags") {
      setSectionBodyVersions((current) => ({
        ...current,
        [section]: bodyVersion,
      }));
    }
  }

  function generationControls(section, currentValue) {
    const generationState = sectionGenerations[section];
    const hasMultipleCandidates =
      section === "longform-title" || section === "publish-title";
    const regenerateLabel = hasMultipleCandidates
      ? "重新生成3个"
      : {
          body: "重新生成正文",
          description: "重新生成描述",
          tags: "重新生成标签",
        }[section];
    const isGenerating = generationState.status === "generating";

    return {
      panel: (
        <GenerationPanel
          section={section}
          candidates={generationState.candidates}
          currentValue={currentValue}
          status={generationState.status}
          error={generationState.error}
          sourceMode={generationState.sourceMode}
          sourceUpdatedAt={generationState.sourceUpdatedAt}
          disabled={false}
          onSelect={(candidate) => selectCandidate(section, candidate)}
        />
      ),
      action: (
        <button
          className="section-copy-button section-regenerate-button"
          type="button"
          title={isGenerating ? "正在生成…" : regenerateLabel}
          aria-label={isGenerating ? "正在生成…" : regenerateLabel}
          disabled={isGenerating}
          onClick={() => regenerateSection(section)}
        >
          {isGenerating ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <RefreshIcon />
          )}
        </button>
      ),
    };
  }

  async function copyField(step, value, { richText = false } = {}) {
    if (!value) return;
    if (
      richText &&
      navigator.clipboard.write &&
      typeof window.ClipboardItem === "function"
    ) {
      try {
        const plainText = toXiaohongshuPlainText(value);
        const richHtml = toXiaohongshuRichHtml(value);
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "text/plain": new Blob([plainText], { type: "text/plain" }),
            "text/html": new Blob([richHtml], { type: "text/html" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(toXiaohongshuPlainText(value));
      }
    } else {
      await navigator.clipboard.writeText(
        richText ? toXiaohongshuPlainText(value) : value,
      );
    }
    setCopiedStep(step);
    window.setTimeout(() => {
      setCopiedStep((current) => (current === step ? "" : current));
    }, 1800);
  }

  function exportMarkdownBody() {
    if (!fields.body) return;

    try {
      const blob = new Blob([buildMarkdownBody(fields.body)], {
        type: "text/markdown;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      try {
        anchor.href = objectUrl;
        anchor.download = buildMarkdownFilename(fields.longformTitle);
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      }
      setExportStatus("success");
      window.setTimeout(() => {
        setExportStatus((current) => (current === "success" ? "" : current));
      }, 1800);
    } catch {
      setExportStatus("error");
    }
  }

  return (
    <div className="publish-workflow">
      <WorkflowSummary
        historyCount={historyCount}
        onRestore={onRestore}
      />

      <div className="workflow-intro">
        <strong>按发布流程分段复制，不满意可重新生成对应内容</strong>
        <p>
          复制正文时优先转换为富文本，平台不支持时自动使用无井号纯文本。
        </p>
      </div>

      <CopyStep
        number="01"
        title="输入长文标题"
        hint="粘贴到「写长文」编辑器的标题区域。"
        value={fields.longformTitle}
        meta={`${fields.counts.longformTitle}字`}
        copied={copiedStep === "longform-title"}
        onCopy={() => copyField("longform-title", fields.longformTitle)}
        copyLabel="复制标题"
        copyAriaLabel="复制长文标题"
        generationControls={generationControls(
          "longform-title",
          fields.longformTitle,
        )}
        disabled={false}
      />

      <CopyStep
        number="02"
        title="输入长文正文"
        hint="推荐复制正文以保留完整格式；也可下载 Markdown（部分格式可能不受小红书导入支持）。导入会覆盖编辑器内已有正文。"
        value={fields.body}
        meta={`${fields.counts.body.toLocaleString()}字`}
        copied={copiedStep === "body"}
        onCopy={() => copyField("body", fields.body, { richText: true })}
        copyLabel="复制正文"
        copyAriaLabel="复制长文正文"
        exportStatus={exportStatus}
        onExport={exportMarkdownBody}
        generationControls={generationControls("body", fields.body)}
        disabled={false}
        previewSize="body"
        expandable
      />

      <ActionStep
        number="03"
        title="点击「一键排版」"
        description="由小红书生成封面和内容卡片，确认排版后继续。"
      />

      <CopyStep
        number="04"
        title="修改发布标题"
        hint="发布标题独立生成，选择后粘贴到发布页；硬限制不超过20字。"
        value={publishTitle}
        meta={`${countPlatformCharacters(publishTitle)}/20字`}
        warning={countPlatformCharacters(publishTitle) > 20}
        copied={copiedStep === "publish-title"}
        onCopy={() => copyField("publish-title", publishTitle)}
        copyLabel="复制发布标题"
        generationControls={generationControls(
          "publish-title",
          publishTitle,
        )}
        stale={sectionBodyVersions["publish-title"] < bodyVersion}
        disabled={false}
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
        copyLabel="复制描述"
        previewSize="description"
        generationControls={generationControls(
          "description",
          fields.description,
        )}
        stale={sectionBodyVersions.description < bodyVersion}
        disabled={false}
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
        copyLabel="复制标签"
        generationControls={generationControls("tags", fields.tags)}
        stale={sectionBodyVersions.tags < bodyVersion}
        disabled={false}
      />

      <ActionStep
        number="07"
        title="预览并发布"
        description={
          Object.entries(sectionBodyVersions).some(
            ([, version]) => version < bodyVersion,
          )
            ? "正文已更新，发布标题、描述或标签仍基于上一版正文；请重新生成或人工确认后发布。"
            : "在小红书确认封面、内容卡片、标题、描述和标签，确认无误后点击「发布」。"
        }
      />
    </div>
  );
}
