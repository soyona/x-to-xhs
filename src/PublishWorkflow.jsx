import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Code2, Eye } from "lucide-react";
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
  appendSourceAttribution,
  countPlatformCharacters,
  splitXiaohongshuDraft,
} from "./xiaohongshuPublish";
import { SOURCE_MODES, normalizeSourceMode } from "./sourceContext";
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
          <div className="publish-copy-actions">
            {hasMarkdownModes && (
              <button
                className="section-copy-button markdown-mode-toggle"
                type="button"
                title={
                  viewMode === "preview"
                    ? "切换到 Markdown Code"
                    : "切换到 Markdown Preview"
                }
                aria-label={
                  viewMode === "preview"
                    ? "切换到 Markdown Code"
                    : "切换到 Markdown Preview"
                }
                onClick={toggleMarkdownMode}
              >
                {viewMode === "preview" ? (
                  <Code2 aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            )}
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
        {generationControls?.preview}
        {hasMarkdownModes && viewMode === "code" ? (
          <textarea
            ref={codeEditorRef}
            className="publish-code-editor"
            id={`publish-step-${number}-preview`}
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
            id={`publish-step-${number}-preview`}
            aria-label={`${title}效果预览`}
            tabIndex="0"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : generationControls?.preview ? null : (
          <pre
            id={`publish-step-${number}-preview`}
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

const WORKFLOW_STEPS = [
  { id: "01", title: "长文标题" },
  { id: "02", title: "长文正文" },
  { id: "03", title: "一键排版" },
  { id: "04", title: "正文描述" },
  { id: "05", title: "标签" },
  { id: "06", title: "预览并发布" },
];

function WorkflowRail({
  activeStep,
  onSelect,
  fields,
  sectionBodyVersions,
  bodyVersion,
}) {
  const stale = Object.values(sectionBodyVersions).some(
    (version) => version < bodyVersion,
  );
  const states = [
    fields.longformTitle ? "已就绪" : "待处理",
    fields.body ? "已就绪" : "待处理",
    "待处理",
    stale ? "需复核" : fields.description ? "已就绪" : "待处理",
    stale ? "需复核" : fields.tags ? "已就绪" : "待处理",
    stale ? "需复核" : "待发布",
  ];

  return (
    <nav className="workflow-rail" aria-label="发布流程">
      <div className="workflow-rail-label">发布流程</div>
      {WORKFLOW_STEPS.map((step, index) => {
        const selected = activeStep === step.id;
        const state = states[index];
        return (
          <button
            className={`workflow-rail-step ${selected ? "is-active" : ""} ${state === "需复核" ? "is-stale" : ""}`}
            type="button"
            key={step.id}
            aria-current={selected ? "step" : undefined}
            onClick={() => onSelect(step.id)}
          >
            <span className="workflow-rail-number">{step.id}</span>
            <span className="workflow-rail-title">{step.title}</span>
            <span className="workflow-rail-state">{state}</span>
          </button>
        );
      })}
    </nav>
  );
}

function LegacyPublishWorkflow({
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
  const [activeStep, setActiveStep] = useState("01");

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
    setActiveStep("01");
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
    <div className="publish-workflow-frame">
      <WorkflowRail
        activeStep={activeStep}
        onSelect={setActiveStep}
        fields={fields}
        sectionBodyVersions={sectionBodyVersions}
        bodyVersion={bodyVersion}
      />
      <div className={`publish-workflow active-step-${activeStep}`}>
      <WorkflowSummary
        historyCount={historyCount}
        onRestore={onRestore}
      />

      <CopyStep
        number="01"
        title="输入长文标题"
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
        number="02"
        title="输入长文正文"
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

      <ActionStep
        number="03"
        title="点击「一键排版」"
        description="由小红书生成封面和内容卡片，确认排版后继续。"
      />

      <CopyStep
        number="04"
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
        number="05"
        title="输入标签"
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

      <ActionStep
        number="06"
        title="预览并发布"
        description={
          normalizeSourceMode(source?.mode) === SOURCE_MODES.X_CONTENT &&
          !source?.sourceUrl &&
          !source?.url
            ? "尚未提供原帖链接，请补充来源；同时确认引用、事实、图片使用和小红书 AI 内容声明后再发布。"
            : Object.entries(sectionBodyVersions).some(
            ([, version]) => version < bodyVersion,
          )
            ? "正文已更新，描述或标签仍基于上一版正文；请重新生成或人工确认后发布。"
            : normalizeSourceMode(source?.mode) === SOURCE_MODES.ORIGINAL
              ? "确认内容、封面和标签无误，并使用小红书的 AI 内容声明后发布。"
              : "确认作者、原帖链接、引用和事实无误，并使用小红书的 AI 内容声明后发布。"
        }
      />
      </div>
    </div>
  );
}

function PublishingKitAction({ icon, children, variant = "", ...props }) {
  return (
    <button className={`material-action ${variant ? `is-${variant}` : ""}`} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function PublishingKitCandidates({
  section,
  candidates,
  currentValue,
  error,
  onApply,
  onCopy,
}) {
  if (!candidates.length && !error) return null;
  return (
    <div className={`material-candidates is-${section}`}>
      {error && <p className="section-generation-error" role="alert">{error}</p>}
      {candidates.map((candidate, index) => {
        const value = Array.isArray(candidate) ? candidate.join(" ") : candidate;
        const selected = value === currentValue;
        return (
          <div className={`material-candidate ${selected ? "is-selected" : ""}`} key={`${section}-${index}-${value}`}>
            <span>{value}</span>
            <button type="button" onClick={() => onCopy(value)}>复制</button>
            <button type="button" disabled={selected} onClick={() => onApply(candidate)}>{selected ? "已采用" : "采用"}</button>
          </div>
        );
      })}
    </div>
  );
}

export function PublishWorkflow({
  draft,
  source,
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
  const [sectionGenerations, setSectionGenerations] = useState(initialSectionGenerations);
  const [copied, setCopied] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [bodyMode, setBodyMode] = useState("edit");
  const [exportStatus, setExportStatus] = useState("");
  const [bodyVersion, setBodyVersion] = useState(1);
  const [sectionBodyVersions, setSectionBodyVersions] = useState({
    description: 1,
    tags: 1,
  });
  const copyTokenRef = useRef(0);
  const initialTitleGenerationWorkflowRef = useRef(null);

  useEffect(() => {
    copyTokenRef.current += 1;
    setCopied("");
    setCopyFeedback(null);
    setExportStatus("");
  }, [draft]);

  useEffect(() => {
    setSectionGenerations(initialSectionGenerations());
    setBodyVersion(1);
    setSectionBodyVersions({ description: 1, tags: 1 });
    setBodyMode("edit");
  }, [workflowId]);

  useEffect(() => {
    if (
      !generateInitialTitleCandidates ||
      initialTitleGenerationWorkflowRef.current === workflowId
    ) return;
    initialTitleGenerationWorkflowRef.current = workflowId;
    void regenerateSection("longform-title");
  }, [generateInitialTitleCandidates, workflowId]);

  async function regenerateSection(section) {
    const currentValue = {
      "longform-title": fields.longformTitle,
      body: fields.body,
      description: fields.description,
      tags: fields.tags,
    }[section];
    const previousCandidates = sectionGenerations[section].candidates;
    setSectionGenerations((current) => ({
      ...current,
      [section]: { ...current[section], status: "generating", error: "" },
    }));
    try {
      const result = await onGenerateSection({
        section,
        currentValue,
        previousCandidates,
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
    } catch (error) {
      setSectionGenerations((current) => ({
        ...current,
        [section]: { ...current[section], status: "error", error: error.message },
      }));
    }
  }

  function applyCandidate(section, candidate) {
    onApplySection(section, candidate);
    if (section === "body") {
      setBodyVersion((current) => current + 1);
    } else if (section === "description" || section === "tags") {
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

  async function copyField(key, value, { richText = false } = {}) {
    if (!value) return;
    const token = ++copyTokenRef.current;
    try {
      let message = "已复制";
      if (
        richText &&
        navigator.clipboard?.write &&
        typeof window.ClipboardItem === "function"
      ) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({
              "text/plain": new Blob([toXiaohongshuPlainText(value)], { type: "text/plain" }),
              "text/html": new Blob([toXiaohongshuRichHtml(value)], { type: "text/html" }),
            }),
          ]);
          message = "已复制富文本";
        } catch {
          await navigator.clipboard.writeText(toXiaohongshuPlainText(value));
          message = "已复制纯文本";
        }
      } else {
        await navigator.clipboard.writeText(richText ? toXiaohongshuPlainText(value) : value);
        if (richText) message = "已复制纯文本";
      }
      setCopied(key);
      setCopyFeedback({ key, tone: "success", message });
      window.setTimeout(() => {
        if (copyTokenRef.current !== token) return;
        setCopied("");
        setCopyFeedback(null);
      }, 1800);
    } catch {
      setCopyFeedback({ key, tone: "error", message: "复制失败，请重试" });
      window.setTimeout(() => {
        if (copyTokenRef.current === token) setCopyFeedback(null);
      }, 2400);
    }
  }

  function exportMarkdownBody() {
    try {
      const blob = new Blob([buildMarkdownBody(fields.body)], {
        type: "text/markdown;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = buildMarkdownFilename(fields.longformTitle);
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setExportStatus("success");
      window.setTimeout(() => setExportStatus(""), 1800);
    } catch {
      setExportStatus("error");
    }
  }

  function feedbackFor(key) {
    if (copyFeedback?.key !== key) return null;
    return (
      <span className={`material-copy-feedback is-${copyFeedback.tone}`} role={copyFeedback.tone === "error" ? "alert" : "status"}>
        {copyFeedback.message}
      </span>
    );
  }

  function regenerateAction(section, label = "重新生成") {
    const loading = sectionGenerations[section].status === "generating";
    return (
      <PublishingKitAction icon={<RefreshIcon />} disabled={loading} onClick={() => regenerateSection(section)}>
        {loading ? "生成中" : label}
      </PublishingKitAction>
    );
  }

  return (
    <div className="publishing-kit longform-kit">
      <section className="material-section is-title" aria-labelledby="longform-title-label">
        <div className="material-section-heading">
          <h3 id="longform-title-label">标题</h3>
          <span className="material-meta">{fields.counts.longformTitle} 字</span>
          <div className="material-actions">
            {feedbackFor("longform-title")}
            <PublishingKitAction variant="copy" icon={copied === "longform-title" ? <CheckIcon /> : <CopyIcon />} disabled={!fields.longformTitle} onClick={() => copyField("longform-title", fields.longformTitle)}>复制</PublishingKitAction>
            {regenerateAction("longform-title")}
          </div>
        </div>
        <input className="material-input" value={fields.longformTitle} onChange={(event) => onApplySection("longform-title", event.target.value)} aria-label="长文标题" />
        <PublishingKitCandidates section="longform-title" candidates={sectionGenerations["longform-title"].candidates} currentValue={fields.longformTitle} error={sectionGenerations["longform-title"].error} onApply={(candidate) => applyCandidate("longform-title", candidate)} onCopy={(candidate) => copyField("title-candidate", candidate)} />
      </section>

      <section className="material-section is-body" aria-labelledby="longform-body-label">
        <div className="material-section-heading">
          <h3 id="longform-body-label">正文</h3>
          <span className="material-meta">{countPlatformCharacters(attributedBody).toLocaleString()} 字</span>
          <div className="material-actions">
            {feedbackFor("body")}
            <PublishingKitAction icon={bodyMode === "edit" ? <Eye /> : <Code2 />} onClick={() => setBodyMode((current) => current === "edit" ? "preview" : "edit")}>{bodyMode === "edit" ? "预览" : "编辑"}</PublishingKitAction>
            <PublishingKitAction variant="copy" icon={copied === "body" ? <CheckIcon /> : <CopyIcon />} disabled={!attributedBody} onClick={() => copyField("body", attributedBody, { richText: true })}>复制正文</PublishingKitAction>
            <PublishingKitAction icon={exportStatus === "success" ? <CheckIcon /> : <DownloadIcon />} disabled={!fields.body} onClick={exportMarkdownBody}>{exportStatus === "success" ? "已下载" : exportStatus === "error" ? "重试下载" : "下载 Markdown"}</PublishingKitAction>
            {regenerateAction("body", "重新生成正文")}
          </div>
        </div>
        {bodyMode === "edit" ? (
          <textarea className="material-textarea body-editor" value={fields.body} onChange={(event) => editBody(event.target.value)} aria-label="长文正文" spellCheck="false" />
        ) : (
          <div className="material-rich-preview" tabIndex="0" aria-label="长文正文预览" dangerouslySetInnerHTML={{ __html: attributedBodyHtml }} />
        )}
        <PublishingKitCandidates section="body" candidates={sectionGenerations.body.candidates} currentValue={fields.body} error={sectionGenerations.body.error} onApply={(candidate) => applyCandidate("body", candidate)} onCopy={(candidate) => copyField("body-candidate", candidate, { richText: true })} />
      </section>

      <section className="material-section is-description" aria-labelledby="longform-description-label">
        <div className="material-section-heading">
          <h3 id="longform-description-label">正文描述</h3>
          <span className={`material-meta ${fields.counts.description > 1000 ? "is-warning" : ""}`}>{fields.counts.description} / 1000 字</span>
          <div className="material-actions">
            {feedbackFor("description")}
            <PublishingKitAction variant="copy" icon={copied === "description" ? <CheckIcon /> : <CopyIcon />} disabled={!fields.description} onClick={() => copyField("description", fields.description)}>复制</PublishingKitAction>
            {regenerateAction("description")}
          </div>
        </div>
        {sectionBodyVersions.description < bodyVersion && <p className="material-stale-notice">正文已更新，当前描述可能仍基于上一版正文。</p>}
        <textarea className="material-textarea" value={fields.description} onChange={(event) => applyCandidate("description", event.target.value)} aria-label="长文正文描述" />
        <PublishingKitCandidates section="description" candidates={sectionGenerations.description.candidates} currentValue={fields.description} error={sectionGenerations.description.error} onApply={(candidate) => applyCandidate("description", candidate)} onCopy={(candidate) => copyField("description-candidate", candidate)} />
      </section>

      <section className="material-section is-tags" aria-labelledby="longform-tags-label">
        <div className="material-section-heading">
          <h3 id="longform-tags-label">标签</h3>
          <span className="material-meta">{fields.counts.tags} 个</span>
          <div className="material-actions">
            {feedbackFor("tags")}
            <PublishingKitAction variant="copy" icon={copied === "tags" ? <CheckIcon /> : <CopyIcon />} disabled={!fields.tags} onClick={() => copyField("tags", fields.tags)}>复制</PublishingKitAction>
            {regenerateAction("tags")}
          </div>
        </div>
        {sectionBodyVersions.tags < bodyVersion && <p className="material-stale-notice">正文已更新，当前标签可能仍基于上一版正文。</p>}
        <input className="material-input" value={fields.tags} onChange={(event) => applyCandidate("tags", event.target.value)} aria-label="长文标签" />
        <PublishingKitCandidates section="tags" candidates={sectionGenerations.tags.candidates} currentValue={fields.tags} error={sectionGenerations.tags.error} onApply={(candidate) => applyCandidate("tags", candidate)} onCopy={(candidate) => copyField("tags-candidate", candidate)} />
      </section>
    </div>
  );
}
