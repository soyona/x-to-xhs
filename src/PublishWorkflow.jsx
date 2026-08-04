import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionGroup } from "./components/ui/ActionGroup";
import { Button } from "./components/ui/Button";
import { IconButton } from "./components/ui/IconButton";
import {
  AlertIcon,
  AlignLeft,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  Heading1,
  ListTree,
  PreviewIcon,
  RefreshIcon,
  Tags,
} from "./components/ui/icons";
import {
  buildMarkdownBody,
  buildMarkdownFilename,
} from "./markdownExport";
import {
  appendSourceAttribution,
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
  onCopy,
}) {
  const hasMultipleCandidates = section === "longform-title";
  const candidateLabel = {
    "longform-title": "长文标题候选",
    body: "正文新版本",
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
            <small>采用新正文后，步骤 04–05 会标记为需要复核。</small>
          )}
          {section === "tags" && (
            <small>
              {sourceMode === "trend"
                ? `结合趋势数据${sourceUpdatedAt ? ` · ${sourceUpdatedAt}` : ""}`
                : "基于正文生成 · 未使用实时趋势数据"}
            </small>
          )}
          {hasMultipleCandidates && <small>双击相应标题即可复制</small>}
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
            if (hasMultipleCandidates) {
              return (
                <div
                  className="section-candidate is-copyable"
                  role="button"
                  tabIndex={disabled || isGenerating ? -1 : 0}
                  key={`${section}-${candidate}`}
                  aria-label={`双击复制标题：${candidate}`}
                  aria-disabled={disabled || isGenerating}
                  title="双击复制此标题"
                  onDoubleClick={() => {
                    if (!disabled && !isGenerating) onCopy(candidate);
                  }}
                  onKeyDown={(event) => {
                    if (
                      !disabled &&
                      !isGenerating &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onCopy(candidate);
                    }
                  }}
                >
                  <span className="candidate-index">{index + 1}</span>
                  <span className="candidate-content">{candidate}</span>
                </div>
              );
            }
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
  sectionId,
  icon,
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
  copyFeedback,
  children,
  previewSize = "compact",
  warning = false,
  stale = false,
  disabled = false,
  editorValue,
  onEditorChange,
  previewHtml,
}) {
  const [viewMode, setViewMode] = useState("preview");
  const [codeValue, setCodeValue] = useState(editorValue || "");
  const codeEditorRef = useRef(null);
  const hasMarkdownModes =
    typeof onEditorChange === "function" && typeof previewHtml === "string";

  useEffect(() => {
    setCodeValue(editorValue || "");
  }, [editorValue]);

  useLayoutEffect(() => {
    const editor = codeEditorRef.current;
    if (!editor || viewMode !== "code") return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [codeValue, viewMode]);

  function toggleMarkdownMode() {
    if (viewMode === "code" && codeValue !== editorValue) {
      onEditorChange(codeValue);
    }
    setViewMode((current) => current === "preview" ? "code" : "preview");
  }

  return (
    <section
      className={`publish-step is-${sectionId}`}
      id={`publish-section-${sectionId}`}
    >
      <div className="publish-step-heading">
        <span className="publish-step-icon" aria-hidden="true">{icon}</span>
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
      <div className={`publish-copy-area is-${previewSize}`}>
        <div className="publish-copy-toolbar">
          <div className="publish-copy-toolbar-meta">
            {copyFeedback ? (
              <span
                className={`copy-feedback is-${copyFeedback.tone}`}
                role={copyFeedback.tone === "error" ? "alert" : "status"}
              >
                {copyFeedback.message}
              </span>
            ) : (
              <span>内容预览</span>
            )}
          </div>
          <ActionGroup className="publish-copy-actions" aria-label={`${title}操作`}>
            {hasMarkdownModes && (
              <IconButton
                label={viewMode === "preview" ? "切换到 Markdown Code" : "切换到 Markdown Preview"}
                variant="ghost"
                icon={viewMode === "preview" ? <CodeIcon /> : <PreviewIcon />}
                onClick={toggleMarkdownMode}
              />
            )}
            {onExport && (
              <IconButton
                label={
                  exportStatus === "success"
                    ? "Markdown 正文已导出"
                    : exportStatus === "error"
                      ? "重试导出 Markdown 正文"
                      : "下载 Markdown（部分格式可能不受小红书导入支持）"
                }
                icon={exportStatus === "success" ? <CheckIcon /> : <DownloadIcon />}
                variant="ghost"
                onClick={onExport}
                disabled={!value || disabled}
              />
            )}
            {generationControls?.action}
            <IconButton
              label={copied ? `${copyAriaLabel}，已复制` : copyAriaLabel}
              icon={copied ? <CheckIcon /> : <CopyIcon />}
              onClick={onCopy}
              disabled={!value || disabled}
            />
          </ActionGroup>
        </div>
        {generationControls?.preview}
        {hasMarkdownModes && viewMode === "code" ? (
          <textarea
            ref={codeEditorRef}
            className="publish-code-editor"
            id={`publish-section-${sectionId}-preview`}
            aria-label={`${title} Markdown 编辑器`}
            value={codeValue}
            onChange={(event) => setCodeValue(event.target.value)}
            onBlur={() => {
              if (codeValue !== editorValue) onEditorChange(codeValue);
            }}
            disabled={disabled}
            spellCheck="false"
          />
        ) : hasMarkdownModes ? (
          <div
            className="publish-rich-preview"
            id={`publish-section-${sectionId}-preview`}
            aria-label={`${title}效果预览`}
            tabIndex="0"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : generationControls?.preview ? null : (
          <pre
            id={`publish-section-${sectionId}-preview`}
            aria-label={`${title}内容预览`}
            tabIndex="0"
          >
            {value || "生成结果中未识别到此部分，请先检查当前草稿。"}
          </pre>
        )}
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

function WorkflowSummary({ historyCount, onRestore }) {
  return (
    <div className="workflow-summary pass" aria-live="polite">
      <div className="workflow-summary-copy">
        <span className="workflow-summary-icon">
          <CheckIcon />
        </span>
        <div>
          <strong>发布素材已准备好</strong>
          <p>分别复制标题、正文、正文描述和标签到小红书。</p>
        </div>
      </div>
      <ActionGroup className="workflow-summary-actions">
        {historyCount > 0 && (
          <Button
            size="sm"
            onClick={onRestore}
          >
            恢复上一版本
          </Button>
        )}
      </ActionGroup>
    </div>
  );
}

export function PublishWorkflow({
  draft,
  source,
  historyCount,
  onRestore,
  workflowId,
  generateInitialTitleCandidates,
  onGenerateSection,
  onApplySection,
}) {
  const fields = useMemo(() => splitXiaohongshuDraft(draft), [draft]);
  const attributedBody = useMemo(
    () => appendSourceAttribution(fields.body, source),
    [fields.body, source],
  );
  const attributedBodyHtml = useMemo(
    () => toXiaohongshuRichHtml(attributedBody),
    [attributedBody],
  );
  const [copiedStep, setCopiedStep] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTokenRef = useRef(0);
  const [exportStatus, setExportStatus] = useState("");
  const [bodyVersion, setBodyVersion] = useState(1);
  const [sectionBodyVersions, setSectionBodyVersions] = useState({
    description: 1,
    tags: 1,
  });
  const [sectionGenerations, setSectionGenerations] = useState(
    initialSectionGenerations,
  );

  useEffect(() => {
    copyFeedbackTokenRef.current += 1;
    setCopiedStep("");
    setCopyFeedback(null);
    setExportStatus("");
  }, [draft]);

  useEffect(() => {
    setBodyVersion(1);
    setSectionBodyVersions({
      description: 1,
      tags: 1,
    });
    setSectionGenerations(initialSectionGenerations());
  }, [workflowId]);

  async function regenerateSection(section) {
    const previous = sectionGenerations[section].candidates;
    const currentValue = {
      "longform-title": fields.longformTitle,
      body: fields.body,
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

  const initialTitleGenerationWorkflowRef = useRef(null);

  useEffect(() => {
    if (
      !generateInitialTitleCandidates ||
      initialTitleGenerationWorkflowRef.current === workflowId
    ) {
      return;
    }
    initialTitleGenerationWorkflowRef.current = workflowId;
    void regenerateSection("longform-title");
  }, [generateInitialTitleCandidates, workflowId]);

  function selectCandidate(section, candidate) {
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

  function editBody(value) {
    onApplySection("body", value);
    setBodyVersion((current) => current + 1);
  }

  function generationControls(section, currentValue) {
    const generationState = sectionGenerations[section];
    const hasMultipleCandidates = section === "longform-title";
    const regenerateLabel = hasMultipleCandidates
      ? "重新生成3个"
      : {
          body: "重新生成正文",
          description: "重新生成描述",
          tags: "重新生成标签",
        }[section];
    const isGenerating = generationState.status === "generating";
    const generationPanel = (
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
        onCopy={(candidate) => copyField("longform-title", candidate)}
      />
    );
    const titlePreview =
      section === "longform-title" &&
      (generationState.candidates.length > 0 || generationState.error)
        ? generationPanel
        : null;

    return {
      panel: section === "longform-title" ? null : generationPanel,
      preview: titlePreview,
      action: (
        <IconButton
          label={isGenerating ? "正在生成…" : regenerateLabel}
          icon={isGenerating ? <span className="spinner" /> : <RefreshIcon />}
          disabled={isGenerating}
          onClick={() => regenerateSection(section)}
        />
      ),
    };
  }

  async function copyField(step, value, { richText = false } = {}) {
    if (!value) return;
    let feedbackMessage = "已复制";
    try {
      if (
        richText &&
        navigator.clipboard?.write &&
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
          feedbackMessage = "已复制富文本";
        } catch {
          await navigator.clipboard.writeText(toXiaohongshuPlainText(value));
          feedbackMessage = "已复制纯文本";
        }
      } else {
        await navigator.clipboard.writeText(
          richText ? toXiaohongshuPlainText(value) : value,
        );
        if (richText) feedbackMessage = "已复制纯文本";
      }
    } catch {
      const token = ++copyFeedbackTokenRef.current;
      setCopyFeedback({
        step,
        tone: "error",
        message: "复制失败，请重试",
      });
      window.setTimeout(() => {
        if (copyFeedbackTokenRef.current === token) setCopyFeedback(null);
      }, 2400);
      return;
    }

    const token = ++copyFeedbackTokenRef.current;
    setCopiedStep(step);
    setCopyFeedback({
      step,
      tone: "success",
      message: feedbackMessage,
    });
    window.setTimeout(() => {
      if (copyFeedbackTokenRef.current !== token) return;
      setCopiedStep("");
      setCopyFeedback(null);
    }, 1800);
  }

  function exportMarkdownBody(body = fields.body) {
    if (!body) return;

    try {
      const blob = new Blob([buildMarkdownBody(body)], {
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

      <CopyStep
        sectionId="title"
        icon={<Heading1 />}
        title="长文标题"
        hint="粘贴到「写长文」编辑器的标题区域。"
        value={fields.longformTitle}
        meta={`${fields.counts.longformTitle}字`}
        copied={copiedStep === "longform-title"}
        copyFeedback={
          copyFeedback?.step === "longform-title" ? copyFeedback : null
        }
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
        sectionId="body"
        icon={<AlignLeft />}
        title="长文正文"
        hint="Preview 查看粘贴后的排版效果，Code 可编辑 Markdown；复制正文可保留完整格式。"
        value={attributedBody}
        meta={`${countPlatformCharacters(attributedBody).toLocaleString()}字`}
        copied={copiedStep === "body"}
        copyFeedback={copyFeedback?.step === "body" ? copyFeedback : null}
        onCopy={() => copyField("body", attributedBody, { richText: true })}
        copyLabel="复制正文"
        copyAriaLabel="复制长文正文"
        exportStatus={exportStatus}
        onExport={() => exportMarkdownBody(attributedBody)}
        generationControls={generationControls("body", fields.body)}
        disabled={false}
        previewSize="body"
        editorValue={fields.body}
        onEditorChange={editBody}
        previewHtml={attributedBodyHtml}
      />

      <CopyStep
        sectionId="description"
        icon={<ListTree />}
        title="正文描述"
        hint={
          fields.sources.description === "summary"
            ? "使用生成稿中的「正文小结 / 摘要」；平台限制 1000 字。"
            : "未识别到独立摘要，已自动提取正文结尾；平台限制 1000 字。"
        }
        value={fields.description}
        meta={`${fields.counts.description}/1000字`}
        warning={fields.counts.description > 1000}
        copied={copiedStep === "description"}
        copyFeedback={
          copyFeedback?.step === "description" ? copyFeedback : null
        }
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
        sectionId="tags"
        icon={<Tags />}
        title="标签"
        hint={
          fields.sources.tags === "default-fallback"
            ? "未识别到推荐标签，已补充通用 AI 标签，可在发布前调整。"
            : "复制推荐标签，粘贴到发布页标签区域。"
        }
        value={fields.tags}
        meta={`${fields.counts.tags}个`}
        copied={copiedStep === "tags"}
        copyFeedback={copyFeedback?.step === "tags" ? copyFeedback : null}
        onCopy={() => copyField("tags", fields.tags)}
        copyLabel="复制标签"
        generationControls={generationControls("tags", fields.tags)}
        stale={sectionBodyVersions.tags < bodyVersion}
        disabled={false}
      />

    </div>
  );
}
