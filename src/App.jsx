import { useEffect, useMemo, useState } from "react";
import { ApiSettingsDialog } from "./ApiSettingsDialog";
import {
  CONTENT_PREFERENCE_STORAGE_KEY,
  DEFAULT_CONTENT_PREFERENCES,
  normalizeContentPreferences,
} from "./contentPreferences";
import { AlertIcon, ArrowIcon } from "./icons";
import { MarkdownPreview } from "./MarkdownPreview";
import { PublishWorkflow } from "./PublishWorkflow";
import { getRepairStrategy } from "./repairStrategy";
import { validateDraft, validationGroups } from "./validation";
import {
  PROTOTYPE_DRAFT_FAILED,
  PROTOTYPE_DRAFT_PASSED,
  PROTOTYPE_INPUT,
} from "./prototypeDraft";

const repairCheckLabels = new Map(
  validationGroups.flatMap((group) =>
    group.items.map((item) => [
      item.id,
      `${group.label} / ${item.label}`,
    ]),
  ),
);

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

export default function App() {
  const [input, setInput] = useState(prototypeMode ? PROTOTYPE_INPUT : "");
  const [draft, setDraft] = useState(
    prototypeMode ? PROTOTYPE_DRAFT_FAILED : "",
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
  const [repairAttempts, setRepairAttempts] = useState(0);
  const [lastRepairProvider, setLastRepairProvider] = useState("");
  const [draftHistory, setDraftHistory] = useState([]);
  const [repairScope, setRepairScope] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("preferences");
  const [contentPreferences, setContentPreferences] = useState(
    loadContentPreferences,
  );
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

  const validation = useMemo(() => validateDraft(draft), [draft]);
  const isGenerating = status === "generating";
  const isRepairing = status === "repairing";
  const isWorking = isGenerating || isRepairing;
  const configuredCount = health.providers.filter(
    (provider) => provider.configured,
  ).length;

  async function generate() {
    if (!input.trim() || isWorking) return;
    setStatus("generating");
    setError("");
    setGeneration(null);
    setRepairAttempts(0);
    setLastRepairProvider("");
    setDraftHistory([]);
    setRepairScope(null);
    try {
      const result = prototypeMode
        ? await new Promise((resolve) => {
            window.setTimeout(
              () =>
                resolve({
                  draft: PROTOTYPE_DRAFT_FAILED,
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

  function openSettings(tab = "preferences") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  async function repair(scope = null) {
    if (!draft || validation.valid || isWorking || repairAttempts >= 2) return;
    const repairChecks = validation.checks.map((check) => ({
      ...check,
      label: repairCheckLabels.get(check.id) || check.label,
    }));
    const requestedIds = new Set(scope?.checkIds || []);
    const failedChecks = repairChecks.filter(
      (check) =>
        !check.pass && (!requestedIds.size || requestedIds.has(check.id)),
    );
    if (!failedChecks.length) return;
    const passedChecks = repairChecks.filter((check) => check.pass);
    const scopedStrategy = getRepairStrategy({
      ...validation,
      checks: failedChecks,
    });
    const hasAlternativeProvider = health.providers.some(
      (provider) =>
        provider.configured && provider.id !== lastRepairProvider,
    );
    setStatus("repairing");
    setError("");
    setRepairScope(
      scope || {
        id: "all",
        label: "全部未通过项目",
        checkIds: failedChecks.map((check) => check.id),
      },
    );

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
              850,
            );
          })
        : await postJson("/api/repair", {
            input,
            draft,
            failedChecks,
            passedChecks,
            mode: scopedStrategy.mode,
            preferences: contentPreferences,
            skipProvider:
              repairAttempts >= 1 && hasAlternativeProvider
                ? lastRepairProvider
                : null,
          });
      setDraftHistory((history) =>
        [...history, { draft, generation }].slice(-2),
      );
      setDraft(result.draft);
      setGeneration(result);
      setLastRepairProvider(result.provider);
      setRepairAttempts((attempts) => attempts + 1);
      setStatus("done");
      setRepairScope(null);
    } catch (repairError) {
      setError(repairError.message);
      setStatus("error");
    }
  }

  function restorePreviousDraft() {
    const previous = draftHistory.at(-1);
    if (!previous || isWorking) return;
    setDraft(previous.draft);
    setGeneration(previous.generation);
    setDraftHistory((history) => history.slice(0, -1));
    setError("");
    setStatus("done");
    setRepairScope(null);
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
            className="settings-button"
            type="button"
            onClick={() => openSettings("preferences")}
          >
            设置
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
                  <span>Gemini → Groq Qwen → OpenRouter Free</span>
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
                        return attempt.message === "本次修复改用其他模型"
                          ? `${attempt.label} 已跳过`
                          : `${attempt.label} 未配置`;
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
                <li>最终草稿会按原始 Markdown 规范逐项检查。</li>
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
                    <span
                  className={`validation-summary ${
                    validation.valid ? "valid" : "invalid"
                  }`}
                    >
                  {validation.valid
                    ? `${validation.checks.length}/${validation.checks.length} 通过`
                    : `${validation.checks.filter((check) => check.pass).length}/${validation.checks.length} 通过 · ${
                        validation.checks.filter((check) => !check.pass).length
                      } 需修复`}
                    </span>
                  )}
            </div>
          </div>
          <div
            className={`document-scroll ${
              isGenerating ? "is-loading" : ""
            } ${isRepairing ? "is-repairing" : ""}`}
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
                  正按 Gemini → Groq Qwen → OpenRouter Free 自动尝试，并生成完整长文。
                </p>
              </div>
            ) : (
              draft ? (
                <PublishWorkflow
                  draft={draft}
                  validation={validation}
                  attempts={repairAttempts}
                  historyCount={draftHistory.length}
                  isRepairing={isRepairing}
                  repairScope={repairScope}
                  repairError={draft ? error : ""}
                  onRepair={repair}
                  onRestore={restorePreviousDraft}
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
            : "默认：Gemini · 备用：Groq Qwen · 兜底：OpenRouter Free"}
        </span>
        <span className="secure-note">API Key 仅保留在本地服务端</span>
      </footer>

      <ApiSettingsDialog
        open={settingsOpen}
        health={health}
        preferences={contentPreferences}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onSavePreferences={saveContentPreferences}
      />
    </div>
  );
}
