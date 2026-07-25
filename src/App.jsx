import { useEffect, useMemo, useState } from "react";
import { ApiSettingsDialog } from "./ApiSettingsDialog";
import { AlertIcon, ArrowIcon, CheckIcon } from "./icons";
import { MarkdownPreview } from "./MarkdownPreview";
import { PublishWorkflow } from "./PublishWorkflow";
import { RepairControls } from "./RepairControls";
import { getRepairStrategy } from "./repairStrategy";
import { validateDraft, validationGroups } from "./validation";

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

export default function App() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(null);
  const [repairAttempts, setRepairAttempts] = useState(0);
  const [lastRepairProvider, setLastRepairProvider] = useState("");
  const [draftHistory, setDraftHistory] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const validationChecks = useMemo(
    () => new Map(validation.checks.map((check) => [check.id, check])),
    [validation],
  );
  const repairStrategy = useMemo(
    () => getRepairStrategy(validation),
    [validation],
  );
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
    try {
      const result = await postJson("/api/generate", { input });
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

  async function repair() {
    if (!draft || validation.valid || isWorking || repairAttempts >= 2) return;
    const repairChecks = validation.checks.map((check) => ({
      ...check,
      label: repairCheckLabels.get(check.id) || check.label,
    }));
    const failedChecks = repairChecks.filter((check) => !check.pass);
    const passedChecks = repairChecks.filter((check) => check.pass);
    const hasAlternativeProvider = health.providers.some(
      (provider) =>
        provider.configured && provider.id !== lastRepairProvider,
    );
    setStatus("repairing");
    setError("");

    try {
      const result = await postJson("/api/repair", {
        input,
        draft,
        failedChecks,
        passedChecks,
        mode: repairStrategy.mode,
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
          </div>
          <button
            className="settings-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            API 配置
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

            {error && (
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
                  {validation.valid ? "规范通过" : "需要调整"}
                </span>
              )}
            </div>
          </div>
          <div className={`document-scroll ${isWorking ? "is-loading" : ""}`}>
            {isWorking ? (
              <div className="generating-state" aria-live="polite">
                <span className="writing-line line-one" />
                <span className="writing-line line-two" />
                <span className="writing-line line-three" />
                <h2>
                  {isRepairing
                    ? "正在按规范修复当前长文"
                    : "正在深度重构这条 X 帖子"}
                </h2>
                <p>
                  {isRepairing
                    ? "将保留上一版本，完成后自动重新检查全部规范。"
                    : "正按 Gemini → Groq Qwen → OpenRouter Free 自动尝试，并生成完整长文。"}
                </p>
              </div>
            ) : (
              draft ? (
                <PublishWorkflow draft={draft} />
              ) : (
                <MarkdownPreview markdown="" />
              )
            )}
          </div>
        </section>

        <aside className="validation-panel" aria-labelledby="validation-heading">
          <div className="panel-header">
            <div className="panel-title">
              <span className="step-number">03</span>
              <h2 id="validation-heading">规范检查</h2>
            </div>
          </div>

          <div className="validation-content">
            <p className="panel-intro">
              检查可确定验证的 Markdown 输出要求。
            </p>
            <div className="check-groups">
              {validationGroups.map((group) => {
                const groupItems = group.items
                  .map((item) => ({
                    ...item,
                    check: item.manual
                      ? null
                      : validationChecks.get(item.id),
                  }))
                  .filter((item) => item.manual || item.check);
                const automaticItems = groupItems.filter((item) => item.check);
                const groupPass = automaticItems.every(
                  (item) => item.check.pass,
                );

                return (
                  <section
                    className={`check-group ${
                      group.manual
                        ? "manual"
                        : draft
                          ? groupPass
                            ? "pass"
                            : "fail"
                          : "pending"
                    }`}
                    key={group.id}
                    aria-labelledby={`check-group-${group.id}`}
                  >
                    <div className="check-group-heading">
                      <span className="check-group-number">{group.number}</span>
                      <strong id={`check-group-${group.id}`}>
                        {group.label}
                      </strong>
                      <span className="check-group-status">
                        {group.manual
                          ? "发布前确认"
                          : draft
                          ? groupPass
                            ? "通过"
                            : `${automaticItems.filter((item) => !item.check.pass).length}项未通过`
                          : "待生成"}
                      </span>
                    </div>
                    <div className="check-list">
                      {groupItems.map((item) => (
                        <div
                          className={`check-row ${
                            item.manual
                              ? "manual"
                              : draft
                              ? item.check.pass
                                ? "pass"
                                : "fail"
                              : "pending"
                          }`}
                          key={item.id}
                        >
                          <span className="check-icon">
                            {!item.manual && draft && item.check.pass ? (
                              <CheckIcon />
                            ) : (
                              <AlertIcon />
                            )}
                          </span>
                          <span className="check-copy">
                            <strong>{item.label}</strong>
                            <small>
                              {item.manual
                                ? item.requirement
                                : item.check.requirement}
                            </small>
                          </span>
                          <span className="check-actual">
                            {item.manual
                              ? "人工确认"
                              : draft
                                ? item.check.actual
                                : "待生成"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            {draft && (
              <RepairControls
                validation={validation}
                strategy={repairStrategy}
                attempts={repairAttempts}
                historyCount={draftHistory.length}
                isRepairing={isRepairing}
                onRepair={repair}
                onRestore={restorePreviousDraft}
              />
            )}
            <div className="validation-note">
              <strong>
                {draft
                  ? validation.valid
                    ? "这份草稿已通过结构与字数检查。"
                    : `${validation.checks.filter((check) => !check.pass).length} 项未通过，可使用上方自动处理。`
                  : "生成后自动核对"}
              </strong>
              <p>
                自动检查结构和字数；二度创作、语气、案例真实性与内容质量仍需发布前人工复核。
              </p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="statusbar">
        <span>
          {generation
            ? `服务：${generation.providerLabel} · 模型：${generation.model}`
            : "默认：Gemini · 备用：Groq Qwen · 兜底：OpenRouter Free"}
        </span>
        <span>规范：Long-form-post-prompt.md</span>
        <span className="secure-note">API Key 仅保留在本地服务端</span>
      </footer>

      <ApiSettingsDialog
        open={settingsOpen}
        health={health}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
