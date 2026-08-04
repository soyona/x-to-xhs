import { useEffect, useMemo, useRef, useState } from "react";
import { ApiSettingsDialog } from "./ApiSettingsDialog";
import { Button } from "./components/ui/Button";
import { IconButton } from "./components/ui/IconButton";
import { SegmentedControl } from "./components/ui/SegmentedControl";
import {
  AlertIcon,
  ArrowIcon,
  HistoryIcon,
  SettingsIcon,
} from "./components/ui/icons";
import { HistoryDialog } from "./HistoryDialog";
import { MarkdownPreview } from "./MarkdownPreview";
import { PublishWorkflow } from "./PublishWorkflow";
import { StatusBar } from "./StatusBar";
import { replaceWorkflowSection } from "./workflowDraft";
import { splitXiaohongshuDraft } from "./xiaohongshuPublish";
import {
  SOURCE_MODES,
  extractStandaloneHttpUrl,
  extractXStatusUrl,
  inferSourceMode,
  normalizeSourceMode,
} from "./sourceContext";
import {
  PROTOTYPE_DRAFT_PASSED,
  PROTOTYPE_INPUT,
} from "./prototypeDraft";

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "请求失败，请重试。");
    if (Array.isArray(data.attempts)) error.attempts = data.attempts;
    throw error;
  }
  return data;
}

const prototypeMode =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("prototype") === "1";

const SOURCE_MODE_OPTIONS = [
  { label: "原始素材", value: SOURCE_MODES.X_CONTENT },
  { label: "自主创作", value: SOURCE_MODES.ORIGINAL },
];

function getHistoryNotice(result) {
  if (prototypeMode) return "";
  if (result.historyWarning) return result.historyWarning;
  if (!result.historyId) {
    return "本地服务尚未加载历史功能，请重启 npm run dev；本次稿件尚未写入历史。";
  }
  return "";
}

function prototypeSectionResult(section) {
  const fields = splitXiaohongshuDraft(PROTOTYPE_DRAFT_PASSED);
  const candidates = {
    "longform-title": [
      "🔥AI写作总卡壳超全干货带你破局",
      "💡别再硬翻X内容超全干货重构指南",
      "📌X内容创作超全干货系统进阶指南",
    ],
    body: [
      fields.body.replace(
        "这份示例稿把任务拆成",
        "新版本把完整任务进一步拆成",
      ),
    ],
    description: [fields.description],
    tags: [fields.tags],
  }[section];
  if (!candidates) throw new Error("不支持这个局部生成步骤。");
  return {
    section,
    candidates,
    provider: "prototype",
    providerLabel: "本地交互稿",
    model: "不调用模型",
    sourceMode: "content-only",
    sourceUpdatedAt: null,
  };
}

export default function App() {
  const [input, setInput] = useState(prototypeMode ? PROTOTYPE_INPUT : "");
  const [draft, setDraft] = useState(
    prototypeMode ? PROTOTYPE_DRAFT_PASSED : "",
  );
  const [status, setStatus] = useState(prototypeMode ? "done" : "idle");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(
    prototypeMode
      ? {
          provider: "prototype",
          providerLabel: "本地交互稿",
          model: "不调用模型",
          attempts: [],
          source: {
            mode: SOURCE_MODES.X_CONTENT,
            content: PROTOTYPE_INPUT,
            sourceUrl: null,
            authorHandle: null,
            authorName: null,
            resolved: false,
          },
        }
      : null,
  );
  const [latestRun, setLatestRun] = useState(null);
  const sourceInputRef = useRef(null);
  const [sourceModeOverride, setSourceModeOverride] = useState(
    SOURCE_MODES.X_CONTENT,
  );
  const [draftHistory, setDraftHistory] = useState([]);
  const [workflowId, setWorkflowId] = useState(prototypeMode ? 1 : 0);
  const [generateInitialTitleCandidates, setGenerateInitialTitleCandidates] =
    useState(prototypeMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeHistory, setActiveHistory] = useState(null);
  const [historyNotice, setHistoryNotice] = useState("");
  const [settingsTab, setSettingsTab] = useState("creation");
  const [promptState, setPromptState] = useState(null);
  const [health, setHealth] = useState({
    configured: false,
    providers: [],
  });

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ configured: false, providers: [] }));
  }, []);

  useEffect(() => {
    if (prototypeMode) return;
    fetch("/api/prompts")
      .then((response) => response.json())
      .then(setPromptState)
      .catch(() => setPromptState(null));
  }, []);

  const isGenerating = status === "generating";
  const isWorking = isGenerating;
  const detectedSourceMode = useMemo(() => inferSourceMode(input), [input]);
  const detectedSourceUrl = useMemo(() => extractXStatusUrl(input), [input]);
  const standaloneInputUrl = useMemo(
    () => extractStandaloneHttpUrl(input),
    [input],
  );
  const unsupportedStandaloneUrl = Boolean(
    standaloneInputUrl && !detectedSourceUrl,
  );
  const sourceMode =
    detectedSourceMode || normalizeSourceMode(sourceModeOverride);
  const recognizedSourceUrl =
    detectedSourceUrl ||
    generation?.source?.sourceUrl ||
    generation?.source?.url ||
    null;
  const activeSource = generation?.source
    ? {
        ...generation.source,
        mode: sourceMode || generation.source.mode,
      }
    : sourceMode
      ? {
          mode: sourceMode,
          content: input,
          sourceUrl: recognizedSourceUrl,
          authorHandle: null,
          authorName: null,
          resolved: false,
        }
      : null;
  const configuredCount = health.providers.filter(
    (provider) => provider.configured,
  ).length;

  async function generate() {
    if (!input.trim() || isWorking) return;
    if (unsupportedStandaloneUrl) {
      setError("暂不支持读取非 X 网页链接，请粘贴文章正文后再生成。");
      return;
    }
    if (!sourceMode) {
      setError("请先确认这是从 X 复制的原文，还是你自主编写的内容。");
      return;
    }
    setStatus("generating");
    setError("");
    setGeneration(null);
    setLatestRun(null);
    setDraftHistory([]);
    setHistoryNotice("");
    setGenerateInitialTitleCandidates(false);
    try {
      const result = prototypeMode
        ? await new Promise((resolve) => {
            window.setTimeout(
              () =>
                resolve({
                  draft: PROTOTYPE_DRAFT_PASSED,
                  provider: "prototype",
                  providerLabel: "本地交互稿",
                  model: "不调用模型",
                  attempts: [],
                }),
              650,
            );
          })
        : await postJson("/api/generate", {
            input,
            sourceMode,
          });
      setDraft(result.draft);
      setGeneration(result);
      setLatestRun(result);
      setSourceModeOverride(result.source?.mode || sourceMode);
      setActiveHistory(
        result.historyId
          ? { id: result.historyId, version: result.historyVersion }
          : null,
      );
      setHistoryNotice(getHistoryNotice(result));
      setGenerateInitialTitleCandidates(true);
      setWorkflowId((current) => current + 1);
      setStatus("done");
    } catch (generationError) {
      if (Array.isArray(generationError.attempts)) {
        setLatestRun({
          attempts: generationError.attempts,
          failed: true,
        });
      }
      setError(generationError.message);
      setStatus("error");
    }
  }

  async function saveSettings(settings) {
    const result = await postJson("/api/settings", settings);
    setHealth(result);
  }

  function openSettings(tab = "creation") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  async function updatePrompts(payload) {
    if (prototypeMode) return promptState;
    const result = await postJson("/api/prompts", payload);
    setPromptState(result);
    return result;
  }

  async function runPromptUtility(payload) {
    if (prototypeMode) {
      throw new Error("本地交互稿不支持导入或下载提示词。");
    }
    return postJson("/api/prompts", payload);
  }

  function restorePreviousDraft() {
    const previous = draftHistory.at(-1);
    if (!previous || isWorking) return;
    setDraft(previous.draft);
    setGeneration(previous.generation);
    setLatestRun(previous.generation);
    setDraftHistory((history) => history.slice(0, -1));
    setError("");
    setStatus("done");
    setGenerateInitialTitleCandidates(false);
    setWorkflowId((current) => current + 1);
  }

  async function generateWorkflowSection({
    section,
    currentValue,
    previousCandidates = [],
    rejectionReasons = [],
  }) {
    if (!draft || isWorking) {
      throw new Error("当前整稿处理中，请稍后再试。");
    }
    const result = prototypeMode
      ? await new Promise((resolve) => {
          window.setTimeout(
            () => resolve(prototypeSectionResult(section)),
            520,
          );
        })
      : await postJson("/api/generate-section", {
          section,
          input,
          sourceMode,
          source: activeSource,
          draft,
          currentValue,
          previousCandidates,
          rejectionReasons,
        });
    setLatestRun(result);
    return result;
  }

  function applyWorkflowSection(section, value) {
    const nextDraft = replaceWorkflowSection(draft, section, value);
    if (nextDraft === draft) return;
    if (section === "body") {
      setDraftHistory((history) =>
        [...history, { draft, generation }].slice(-2),
      );
    }
    setDraft(nextDraft);
    setError("");
  }

  function loadHistory({ record, version }) {
    const restoredSourceMode =
      normalizeSourceMode(record.source?.mode) ||
      (record.source?.url ? SOURCE_MODES.X_URL : null);
    const restoredSource = {
      mode: restoredSourceMode,
      content: record.source?.content || "",
      sourceUrl: record.source?.url || null,
      authorHandle: record.source?.authorHandle || null,
      authorName: record.source?.authorName || null,
      resolved: record.source?.type === "url",
    };
    setInput(record.source?.content || "");
    setSourceModeOverride(restoredSourceMode);
    setDraft(version.draft);
    const restoredGeneration = {
      provider: version.provider,
      providerLabel:
        version.providerLabel || version.provider || "历史记录",
      model: version.model || "模型未知",
      usage: version.usage || null,
      attempts: Array.isArray(version.attempts) ? version.attempts : [],
      source: restoredSource,
    };
    setGeneration(restoredGeneration);
    setLatestRun(restoredGeneration);
    setActiveHistory({
      id: record.id,
      version: record.currentVersion,
    });
    setDraftHistory([]);
    setHistoryNotice(
      version.version === record.currentVersion
        ? "已载入历史笔记，未调用模型。"
        : `已载入历史版本 ${version.version}，可继续重新生成需要调整的部分。`,
    );
    setError("");
    setStatus("done");
    setGenerateInitialTitleCandidates(false);
    setWorkflowId((current) => current + 1);
    setHistoryOpen(false);
  }

  function handleHistoryDeleted(id) {
    if (activeHistory?.id === id) {
      setActiveHistory(null);
      setHistoryNotice(
        "当前工作区内容仍然保留，但对应历史记录已删除；下次生成会创建新记录。",
      );
    }
  }

  function handleInputChange(event) {
    const nextInput = event.target.value;
    setInput(nextInput);
    if (
      !nextInput.trim() ||
      inferSourceMode(nextInput) ||
      extractStandaloneHttpUrl(nextInput)
    ) {
      setSourceModeOverride(
        nextInput.trim() ? null : SOURCE_MODES.X_CONTENT,
      );
    }
  }

  const sourceStatus =
    unsupportedStandaloneUrl
      ? "暂不支持读取非 X 网页链接，请粘贴文章正文"
      : sourceMode === SOURCE_MODES.ORIGINAL
      ? ""
      : sourceMode === SOURCE_MODES.X_URL
        ? "已识别 X 原帖链接"
        : sourceMode === SOURCE_MODES.X_CONTENT && recognizedSourceUrl
          ? "已识别原文内容和 X 原帖链接"
          : sourceMode === SOURCE_MODES.X_CONTENT
            ? "缺少原帖链接，发布前需补充"
            : "";
  const sourcePlaceholder =
    sourceMode === SOURCE_MODES.ORIGINAL
      ? "输入你自主编写的内容，例如观点、草稿或文章素材。"
      : sourceMode === SOURCE_MODES.X_CONTENT ||
          sourceMode === SOURCE_MODES.X_URL
        ? "粘贴 X 原文或原帖链接；粘贴原文时，请在末尾附上原帖链接。"
        : "请先选择内容来源，再粘贴或输入内容。";
  const needsSourceUrl =
    Boolean(input.trim()) &&
    sourceMode === SOURCE_MODES.X_CONTENT &&
    !recognizedSourceUrl &&
    !unsupportedStandaloneUrl;
  const canSupplementSourceUrl = needsSourceUrl && !isWorking;

  function focusSourceInputForUrl() {
    const inputElement = sourceInputRef.current;
    if (!inputElement) return;
    inputElement.focus();
    inputElement.setSelectionRange(input.length, input.length);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="X 转小红书首页">
          <span className="wordmark-code">&lt;/&gt;</span>
          <span>X</span>
          <ArrowIcon />
          <span>小红书</span>
        </a>
        <div className="topbar-actions">
          <div className="local-status">
            <span
              className={`status-dot ${health.configured ? "ready" : "not-ready"}`}
            />
            {health.configured
              ? `本地运行 · ${configuredCount}/${health.providers.length} 个服务已配置`
              : "本地运行 · 等待 API Key"}
            {prototypeMode && " · 交互稿"}
          </div>
          <IconButton
            label="查看历史"
            icon={<HistoryIcon />}
            onClick={() => setHistoryOpen(true)}
          />
          <IconButton
            label="设置"
            icon={<SettingsIcon />}
            onClick={() => openSettings("creation")}
          />
        </div>
      </header>

      <main className="workspace">
        <section className="source-panel" aria-labelledby="source-heading">
          <div className="panel-header">
            <div className="panel-title">
              <span className="step-number">01</span>
              <h1 id="source-heading">粘贴 X 内容</h1>
            </div>
          </div>

          <div className="source-content">
            <div className="source-mode-picker">
              <SegmentedControl
                label="内容来源"
                value={
                  sourceMode === SOURCE_MODES.ORIGINAL
                    ? SOURCE_MODES.ORIGINAL
                    : sourceMode === SOURCE_MODES.X_CONTENT ||
                        sourceMode === SOURCE_MODES.X_URL
                      ? SOURCE_MODES.X_CONTENT
                      : ""
                }
                options={SOURCE_MODE_OPTIONS}
                disabled={isWorking || Boolean(detectedSourceMode) || unsupportedStandaloneUrl}
                onChange={setSourceModeOverride}
              />
            </div>

            <div className="source-input-shell">
              <textarea
                ref={sourceInputRef}
                id="source-input"
                value={input}
                onChange={handleInputChange}
                aria-label={`输入内容，${input.length.toLocaleString()} 字符`}
                placeholder={sourcePlaceholder}
                disabled={isWorking}
              />
              <span className="source-character-count" aria-hidden="true">
                {input.length.toLocaleString()} 字符
              </span>
            </div>

            {input.trim() && sourceStatus && (
              <p
                className={`source-mode-status ${
                  unsupportedStandaloneUrl ||
                  needsSourceUrl
                    ? "warning"
                    : ""
                }`}
              >
                <span>{sourceStatus}</span>
                {canSupplementSourceUrl && (
                  <Button
                    className="source-supplement-action"
                    size="sm"
                    variant="ghost"
                    onClick={focusSourceInputForUrl}
                    aria-label="在原文末尾补充原帖链接"
                  >
                    补充链接
                  </Button>
                )}
              </p>
            )}

            <Button
              className="source-generate-action"
              variant="primary"
              size="lg"
              icon={!isGenerating ? <ArrowIcon /> : <span className="spinner" />}
              iconPosition="end"
              onClick={generate}
              aria-busy={isGenerating}
              disabled={
                !input.trim() ||
                !sourceMode ||
                unsupportedStandaloneUrl ||
                isWorking
              }
            >
              {isGenerating ? "正在生成长文…" : "生成小红书长文"}
            </Button>

            {error && !draft && (
              <div className="error-message" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            {historyNotice && (
              <div className="history-notice" role="status">
                <AlertIcon />
                <span>{historyNotice}</span>
              </div>
            )}

          </div>
        </section>

        <section className="draft-panel" aria-labelledby="draft-heading">
          <div className="panel-header draft-header">
            <div className="panel-title">
              <span className="step-number">02</span>
              <h2 id="draft-heading">小红书长文</h2>
            </div>
            <div className="toolbar-actions">
                  {draft && (
                    <span className="prompt-profile-summary">
                      {generation?.promptProfile?.name || promptState?.defaultProfile?.name || "当前提示词"}
                    </span>
                  )}
            </div>
          </div>
          <div
            className={`document-scroll ${
              isGenerating ? "is-loading" : ""
            }`}
          >
            {isGenerating ? (
              <div className="generating-state" aria-live="polite">
                <span className="writing-line line-one" />
                <span className="writing-line line-two" />
                <span className="writing-line line-three" />
                <h2>
                  {sourceMode === SOURCE_MODES.ORIGINAL
                    ? "正在整理这份原创草稿"
                    : "正在生成公开内容解读"}
                </h2>
                <p>正在生成，请保持页面打开。</p>
              </div>
            ) : (
              draft ? (
                <PublishWorkflow
                  draft={draft}
                  source={activeSource}
                  historyCount={draftHistory.length}
                  onRestore={restorePreviousDraft}
                  workflowId={workflowId}
                  generateInitialTitleCandidates={
                    generateInitialTitleCandidates
                  }
                  onGenerateSection={generateWorkflowSection}
                  onApplySection={applyWorkflowSection}
                />
              ) : (
                <MarkdownPreview markdown="" />
              )
            )}
          </div>
        </section>
      </main>

      <StatusBar
        health={health}
        isGenerating={isGenerating}
        prototypeMode={prototypeMode}
        run={latestRun || generation}
      />

      <ApiSettingsDialog
        open={settingsOpen}
        health={health}
        promptState={promptState}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onUpdatePrompts={updatePrompts}
        onPromptUtility={runPromptUtility}
      />
      <HistoryDialog
        open={historyOpen}
        activeHistoryId={activeHistory?.id}
        onClose={() => setHistoryOpen(false)}
        onLoad={loadHistory}
        onDeleted={handleHistoryDeleted}
      />
    </div>
  );
}
