import { useEffect, useState } from "react";
import { ApiSettingsDialog } from "./ApiSettingsDialog";
import {
  CONTENT_PREFERENCE_STORAGE_KEY,
  DEFAULT_CONTENT_PREFERENCES,
  normalizeContentPreferences,
} from "./contentPreferences";
import { History as HistoryIcon, Settings as SettingsIcon } from "lucide-react";
import { AlertIcon, ArrowIcon } from "./icons";
import { HistoryDialog } from "./HistoryDialog";
import { MarkdownPreview } from "./MarkdownPreview";
import { PublishWorkflow } from "./PublishWorkflow";
import { replaceWorkflowSection } from "./workflowDraft";
import { splitXiaohongshuDraft } from "./xiaohongshuPublish";
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
  if (!response.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}

const prototypeMode =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("prototype") === "1";

function getHistoryNotice(result) {
  if (prototypeMode) return "";
  if (result.historyWarning) return result.historyWarning;
  if (!result.historyId) {
    return "本地服务尚未加载历史功能，请重启 npm run dev；本次稿件尚未写入历史。";
  }
  return "";
}

function loadContentPreferences() {
  try {
    const stored = window.localStorage.getItem(
      CONTENT_PREFERENCE_STORAGE_KEY,
    );
    return stored
      ? normalizeContentPreferences(JSON.parse(stored))
      : { ...DEFAULT_CONTENT_PREFERENCES };
  } catch {
    return { ...DEFAULT_CONTENT_PREFERENCES };
  }
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
    "publish-title": [
      "X内容别再硬翻了🔥",
      "一套方法重构X长文🚀",
      "把X观点写成好长文✨",
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
        }
      : null,
  );
  const [draftHistory, setDraftHistory] = useState([]);
  const [workflowId, setWorkflowId] = useState(prototypeMode ? 1 : 0);
  const [autoGenerateTitles, setAutoGenerateTitles] = useState(prototypeMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeHistory, setActiveHistory] = useState(null);
  const [historyNotice, setHistoryNotice] = useState("");
  const [settingsTab, setSettingsTab] = useState("creation");
  const [contentPreferences, setContentPreferences] = useState(
    loadContentPreferences,
  );
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
  const configuredCount = health.providers.filter(
    (provider) => provider.configured,
  ).length;

  async function generate() {
    if (!input.trim() || isWorking) return;
    setStatus("generating");
    setError("");
    setGeneration(null);
    setDraftHistory([]);
    setHistoryNotice("");
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
            preferences: contentPreferences,
          });
      setDraft(result.draft);
      setGeneration(result);
      setActiveHistory(
        result.historyId
          ? { id: result.historyId, version: result.historyVersion }
          : null,
      );
      setHistoryNotice(getHistoryNotice(result));
      setAutoGenerateTitles(true);
      setWorkflowId((current) => current + 1);
      setStatus("done");
    } catch (generationError) {
      setError(generationError.message);
      setStatus("error");
    }
  }

  async function saveSettings(settings) {
    const result = await postJson("/api/settings", settings);
    setHealth(result);
  }

  function saveContentPreferences(preferences) {
    const normalized = normalizeContentPreferences(preferences);
    setContentPreferences(normalized);
    window.localStorage.setItem(
      CONTENT_PREFERENCE_STORAGE_KEY,
      JSON.stringify(normalized),
    );
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

  function restorePreviousDraft() {
    const previous = draftHistory.at(-1);
    if (!previous || isWorking) return;
    setDraft(previous.draft);
    setGeneration(previous.generation);
    setDraftHistory((history) => history.slice(0, -1));
    setError("");
    setStatus("done");
    setAutoGenerateTitles(false);
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
    if (prototypeMode) {
      return new Promise((resolve) => {
        window.setTimeout(() => resolve(prototypeSectionResult(section)), 520);
      });
    }
    return postJson("/api/generate-section", {
      section,
      input,
      draft,
      currentValue,
      previousCandidates,
      rejectionReasons,
      preferences: contentPreferences,
    });
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
    const restoredPreferences = normalizeContentPreferences(record.preferences);
    setInput(record.source?.content || "");
    setDraft(version.draft);
    setGeneration({
      provider: version.provider,
      providerLabel:
        version.providerLabel || version.provider || "历史记录",
      model: version.model || "模型未知",
      attempts: [],
    });
    setActiveHistory({
      id: record.id,
      version: record.currentVersion,
    });
    setContentPreferences(restoredPreferences);
    window.localStorage.setItem(
      CONTENT_PREFERENCE_STORAGE_KEY,
      JSON.stringify(restoredPreferences),
    );
    setDraftHistory([]);
    setHistoryNotice(
      version.version === record.currentVersion
        ? "已载入历史笔记，未调用模型。"
        : `已载入历史版本 ${version.version}，可继续重新生成需要调整的部分。`,
    );
    setError("");
    setStatus("done");
    setAutoGenerateTitles(false);
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
          <button
            className="section-copy-button topbar-icon-button"
            type="button"
            title="查看历史"
            aria-label="查看历史"
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon />
          </button>
          <button
            className="section-copy-button topbar-icon-button"
            type="button"
            title="设置"
            aria-label="设置"
            onClick={() => openSettings("creation")}
          >
            <SettingsIcon />
          </button>
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
            <label className="input-label" htmlFor="source-input">
              原始内容
              <span>{input.length.toLocaleString()} 字符</span>
            </label>
            <textarea
              id="source-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="支持完整帖子文本，或单独一条 x.com / twitter.com 帖子链接。"
              disabled={isWorking}
            />

            <button
              className="generate-button"
              onClick={generate}
              disabled={!input.trim() || isWorking}
            >
              <span>{isGenerating ? "正在生成长文…" : "生成小红书长文"}</span>
              {!isGenerating && <ArrowIcon />}
              {isGenerating && <span className="spinner" aria-hidden="true" />}
            </button>

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

            <div className="provider-chain" aria-label="模型调用顺序">
              <strong>自动切换顺序</strong>
              <div>
                {health.providers.length ? (
                  health.providers.map((provider, index) => (
                    <span className="provider-step" key={provider.id}>
                      {index > 0 && <b aria-hidden="true">→</b>}
                      <span
                        className={
                          provider.configured ? "configured" : "unconfigured"
                        }
                      >
                        {provider.label}
                      </span>
                    </span>
                  ))
                ) : (
                  <span>
                    Gemini → Groq Qwen → 智谱 GLM → 硅基流动 Qwen →
                    OpenRouter Free
                  </span>
                )}
              </div>
              {generation?.attempts && (
                <p className="attempt-summary" role="status">
                  {generation.attempts
                    .map((attempt) => {
                      if (attempt.status === "success") {
                        return `${attempt.label} 成功`;
                      }
                      if (attempt.status === "skipped") {
                        return `${attempt.label} 未配置`;
                      }
                      return `${attempt.label} 失败`;
                    })
                    .join(" → ")}
                </p>
              )}
            </div>

            <div className="source-tips">
              <h2>使用提示</h2>
              <ol>
                <li>链接会先在本地服务端解析成正文。</li>
                <li>生成通常需要几分钟，请保持此页面打开。</li>
                <li>生成规则来自当前提示词方案，不满意可分部分重新生成。</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="draft-panel" aria-labelledby="draft-heading">
          <div className="panel-header draft-header">
            <div className="panel-title">
              <span className="step-number">02</span>
              <h2 id="draft-heading">小红书长文</h2>
              <span className="format-label">按发布流程分段复制</span>
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
                  正在深度重构这条 X 帖子
                </h2>
                <p>
                  正按 Gemini → Groq Qwen → 智谱 GLM → 硅基流动 Qwen →
                  OpenRouter Free 自动尝试，并生成完整长文。
                </p>
              </div>
            ) : (
              draft ? (
                <PublishWorkflow
                  draft={draft}
                  historyCount={draftHistory.length}
                  onRestore={restorePreviousDraft}
                  workflowId={workflowId}
                  autoGenerateTitles={autoGenerateTitles}
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

      <footer className="statusbar">
        <span>
          {generation
            ? `服务：${generation.providerLabel} · 模型：${generation.model}`
            : "默认：Gemini · 备用：Groq Qwen / 智谱 GLM / 硅基流动 Qwen · 兜底：OpenRouter Free"}
        </span>
        <span className="secure-note">API Key 仅保留在本地服务端</span>
      </footer>

      <ApiSettingsDialog
        open={settingsOpen}
        health={health}
        preferences={contentPreferences}
        promptState={promptState}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onSavePreferences={saveContentPreferences}
        onUpdatePrompts={updatePrompts}
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
