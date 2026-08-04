import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "./components/ui/icons";

const emptyProviders = {};
const PROMPT_MODULES = [
  ["global", "全局规则"],
  ["title", "标题"],
  ["body", "正文"],
  ["summary", "正文摘要"],
  ["tags", "标签"],
];

function selectedPromptProfile(promptState) {
  if (!promptState) return null;
  if (promptState.selectedId === "default") return promptState.defaultProfile;
  return (
    promptState.profiles.find(
      (profile) => profile.id === promptState.selectedId,
    ) || promptState.defaultProfile
  );
}

function PromptSettings({
  promptState,
  saving,
  setSaving,
  message,
  setMessage,
  onUpdatePrompts,
  onPromptUtility,
}) {
  const [draftId, setDraftId] = useState("default");
  const [draftName, setDraftName] = useState("系统默认");
  const [draftModules, setDraftModules] = useState({});
  const [activeModule, setActiveModule] = useState("title");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [messageTone, setMessageTone] = useState("info");
  const [saveComplete, setSaveComplete] = useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    const profile = selectedPromptProfile(promptState);
    if (!profile) return;
    setDraftId(profile.id);
    setDraftName(profile.name);
    setDraftModules({ ...profile.modules });
    setConfirmingDelete(false);
  }, [promptState]);

  useEffect(() => {
    if (!saveComplete) return undefined;
    const timeout = window.setTimeout(() => setSaveComplete(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [saveComplete]);

  if (!promptState) {
    return (
      <div className="prompt-settings-empty" role="status">
        暂时无法读取提示词方案，请确认本地服务已启动后重试。
      </div>
    );
  }

  const isNew = draftId === "new";
  const isDefault = draftId === "default";
  const profiles = [promptState.defaultProfile, ...promptState.profiles];

  async function runPromptAction(action, successMessage) {
    setSaving(true);
    setMessage("");
    try {
      await onUpdatePrompts(action);
      setMessageTone("success");
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessageTone("error");
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function selectProfile(event) {
    setConfirmingDelete(false);
    setSaveComplete(false);
    await runPromptAction(
      { action: "select", id: event.target.value },
      "提示词方案已切换。",
    );
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaveComplete(false);
    const saved = await runPromptAction(
      {
        action: "save",
        profile: {
          id: isDefault || isNew ? undefined : draftId,
          name: isDefault ? "系统默认副本" : draftName,
          modules: draftModules,
        },
      },
      isDefault || isNew ? "自定义方案已创建并启用。" : "提示词方案已保存。",
    );
    if (saved) setSaveComplete(true);
  }

  async function deleteProfile() {
    if (isDefault || isNew) return;
    const deleted = await runPromptAction(
      { action: "delete", id: draftId },
      "自定义方案已删除，已切换到系统默认。",
    );
    if (deleted) setConfirmingDelete(false);
  }

  function createCopy() {
    const profile = selectedPromptProfile(promptState);
    setConfirmingDelete(false);
    setSaveComplete(false);
    setDraftId("new");
    setDraftName(`${profile?.name || "提示词方案"} 副本`);
    setDraftModules({ ...(profile?.modules || promptState.defaultProfile.modules) });
    setMessageTone("info");
    setMessage("正在编辑新方案，保存后才会启用。");
  }

  function resetActiveModule() {
    setDraftModules((current) => ({
      ...current,
      [activeModule]: promptState.defaultProfile.modules[activeModule],
    }));
    setSaveComplete(false);
    setMessage("");
  }

  async function downloadPrompt({ useDefault = false } = {}) {
    setSaving(true);
    setMessage("");
    try {
      const result = await onPromptUtility({
        action: "export",
        modules: useDefault ? null : draftModules,
      });
      const blob = new Blob([result.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = draftName
        .trim()
        .replace(/[\\/:*?"<>|]+/gu, "-")
        .slice(0, 40);
      anchor.href = url;
      anchor.download = useDefault
        ? "Long-form-post-prompt.md"
        : `Long-form-post-prompt--${safeName || "当前方案"}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessageTone("success");
      setMessage(useDefault ? "默认模板已下载。" : "当前方案已下载。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function importPrompt(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.md$/iu.test(file.name)) {
      setMessageTone("error");
      setMessage("请选择 .md 格式的提示词模板。");
      return;
    }
    if (file.size > 200 * 1024) {
      setMessageTone("error");
      setMessage("提示词模板不能超过 200 KiB。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const markdown = await file.text();
      const importedName =
        file.name
          .replace(/\.md$/iu, "")
          .replace(/^Long-form-post-prompt(?:--)?/iu, "")
          .trim()
          .slice(0, 40) || "导入的提示词方案";
      await onUpdatePrompts({
        action: "import",
        profile: {
          name: importedName,
          markdown,
        },
      });
      setMessageTone("success");
      setMessage("模板已导入为新方案并启用。");
      setSaveComplete(false);
    } catch (error) {
      setMessageTone("error");
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="settings-form"
      onSubmit={saveProfile}
      onKeyDown={(event) => {
        if (event.key === "Escape" && confirmingDelete) {
          event.stopPropagation();
          setConfirmingDelete(false);
        }
      }}
    >
      <div className="prompt-settings">
        <div className="prompt-profile-toolbar">
          <label htmlFor="prompt-profile-select">
            当前方案
            <select
              id="prompt-profile-select"
              value={isNew ? "new" : promptState.selectedId}
              onChange={selectProfile}
              disabled={saving || isNew}
            >
              {profiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.name}
                </option>
              ))}
              {isNew && <option value="new">{draftName}</option>}
            </select>
          </label>
          <button
            className="settings-reset"
            type="button"
            onClick={createCopy}
            disabled={saving}
          >
            新建副本
          </button>
        </div>
        <div className="prompt-file-actions">
          <button
            className="settings-reset"
            type="button"
            onClick={() => downloadPrompt({ useDefault: true })}
            disabled={saving}
          >
            下载默认模板
          </button>
          <button
            className="settings-reset"
            type="button"
            onClick={() => downloadPrompt()}
            disabled={saving}
          >
            下载当前方案
          </button>
          <button
            className="settings-reset"
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={saving}
          >
            上传模板
          </button>
          <input
            ref={importInputRef}
            className="prompt-file-input"
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={importPrompt}
          />
        </div>

        <label className="prompt-name-field" htmlFor="prompt-profile-name">
          方案名称
          <input
            id="prompt-profile-name"
            value={draftName}
            maxLength={40}
            onChange={(event) => {
              setDraftName(event.target.value);
              setSaveComplete(false);
              setMessage("");
            }}
            disabled={saving || isDefault}
            required
          />
        </label>

        <div className="prompt-module-tabs" role="tablist" aria-label="提示词模块">
          {PROMPT_MODULES.map(([id, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeModule === id}
              className={activeModule === id ? "active" : ""}
              onClick={() => setActiveModule(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="prompt-module-editor" htmlFor="prompt-module-editor">
          {PROMPT_MODULES.find(([id]) => id === activeModule)?.[1]}提示词
          <textarea
            id="prompt-module-editor"
            value={draftModules[activeModule] || ""}
            onChange={(event) => {
              setDraftModules((current) => ({
                ...current,
                [activeModule]: event.target.value,
              }));
              setSaveComplete(false);
              setMessage("");
            }}
            disabled={saving}
            spellCheck="false"
          />
          <span>{(draftModules[activeModule] || "").length.toLocaleString()} 字符</span>
        </label>

      </div>

      {message && (
        <p
          className={`settings-message prompt-action-message is-${messageTone}`}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <div className="settings-actions preference-actions">
        {!confirmingDelete && (
          <button
            className="settings-reset"
            type="button"
            onClick={resetActiveModule}
            disabled={saving}
          >
            当前模块恢复默认
          </button>
        )}
        {confirmingDelete ? (
          <div
            className="settings-delete-confirm"
            role="group"
            aria-label={`确认删除提示词方案“${draftName}”`}
          >
            <span>
              删除“{draftName}”？删除后不可恢复。
            </span>
            <button
              className="settings-cancel"
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={saving}
            >
              取消
            </button>
            <button
              className="settings-delete-confirm-button"
              type="button"
              onClick={deleteProfile}
              disabled={saving}
              autoFocus
            >
              {saving ? "正在删除…" : "确认删除"}
            </button>
          </div>
        ) : (
          <>
            {!isDefault && !isNew && (
              <button
                className="settings-cancel"
                type="button"
                onClick={() => {
                  setSaveComplete(false);
                  setMessage("");
                  setConfirmingDelete(true);
                }}
                disabled={saving}
              >
                删除方案
              </button>
            )}
            <button className="settings-save" type="submit" disabled={saving}>
              {saving
                ? "正在保存…"
                : saveComplete
                  ? "已保存"
                  : isDefault || isNew
                    ? "保存为新方案"
                    : "保存方案"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

export function ApiSettingsDialog({
  open,
  health,
  promptState,
  initialTab = "creation",
  onClose,
  onSave,
  onUpdatePrompts,
  onPromptUtility,
}) {
  const [providers, setProviders] = useState(emptyProviders);
  const [activeTab, setActiveTab] = useState(
    initialTab === "providers" ? "providers" : "creation",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedProviderId, setExpandedProviderId] = useState(null);
  const [editingKeyProviderId, setEditingKeyProviderId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === "providers" ? "providers" : "creation");
    setProviders(
      Object.fromEntries(
        health.providers.map((provider) => [
          provider.id,
          {
            apiKey: "",
            clearKey: false,
            models: provider.models || [provider.model],
            availableModels: provider.availableModels || [provider.model],
            newModel: "",
          },
        ]),
      ),
    );
    setSaving(false);
    setMessage("");
    setExpandedProviderId(health.providers[0]?.id || null);
    setEditingKeyProviderId(null);
  }, [health.providers, initialTab, open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, open, saving]);

  if (!open) return null;

  function updateProvider(id, patch) {
    setProviders((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function submitProviders(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSave({ providers });
      setMessage("配置已安全保存。");
      onClose();
    } catch (error) {
      setMessage(error.message);
      setSaving(false);
    }
  }

  return (
    <div className="settings-backdrop" role="presentation">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-dialog-header">
          <div>
            <span className="settings-eyebrow"></span>
            <h2 id="settings-title">设置</h2>
          </div>
          <button
            className="settings-close"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭设置"
          >
            ×
          </button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="设置分类">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "creation"}
            className={activeTab === "creation" ? "active" : ""}
            onClick={() => {
              setActiveTab("creation");
              setMessage("");
            }}
            disabled={saving}
          >
            创作设置
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "providers"}
            className={activeTab === "providers" ? "active" : ""}
            onClick={() => {
              setActiveTab("providers");
              setMessage("");
            }}
            disabled={saving}
          >
            模型与 API
          </button>
        </div>

        {activeTab === "creation" ? (
          <div className="creation-settings">
            <PromptSettings
              promptState={promptState}
              saving={saving}
              setSaving={setSaving}
              message={message}
              setMessage={setMessage}
              onUpdatePrompts={onUpdatePrompts}
              onPromptUtility={onPromptUtility}
            />
          </div>
        ) : (
          <form className="settings-form" onSubmit={submitProviders}>
            <div className="settings-provider-list">
              {health.providers.map((provider, index) => {
                const value = providers[provider.id] || {
                  apiKey: "",
                  clearKey: false,
                  models: provider.models || [provider.model],
                  availableModels: provider.availableModels || [provider.model],
                  newModel: "",
                };
                const isExpanded = expandedProviderId === provider.id;
                const hasNewKey = Boolean(value.apiKey.trim());
                const isEditingKey =
                  editingKeyProviderId === provider.id ||
                  !provider.configured ||
                  hasNewKey;
                const statusLabel = value.clearKey
                  ? "待移除"
                  : hasNewKey
                    ? "待保存"
                    : provider.configured
                      ? "已配置"
                      : "未配置";
                const statusClass =
                  value.clearKey || (!provider.configured && !hasNewKey)
                    ? "missing"
                    : "ready";
                const detailsId = `${provider.id}-settings-details`;
                return (
                  <section
                    className={`settings-provider${
                      isExpanded ? " expanded" : ""
                    }`}
                    key={provider.id}
                  >
                    <div className="settings-provider-summary">
                      <div className="settings-provider-identity">
                        <span>{index + 1}</span>
                        <h3>{provider.label}</h3>
                        <b className={statusClass}>{statusLabel}</b>
                      </div>
                      <span
                        className="settings-provider-model-summary"
                        title={value.models.join(" → ")}
                      >
                        模型：{value.models.join(" → ") || "未设置"}
                      </span>
                      <button
                        className="settings-provider-manage"
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        aria-label={`${isExpanded ? "收起" : "管理"} ${
                          provider.label
                        }`}
                        onClick={() =>
                          setExpandedProviderId((current) =>
                            current === provider.id ? null : provider.id,
                          )
                        }
                        disabled={saving}
                      >
                        管理
                        <ChevronDown
                          aria-hidden="true"
                          className={isExpanded ? "expanded" : ""}
                        />
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        className="settings-provider-details"
                        id={detailsId}
                      >
                        <div className="settings-provider-fields">
                          <label htmlFor={`${provider.id}-api-key`}>
                            {provider.id === "gemini"
                              ? "API Keys"
                              : "API Key"}
                            {isEditingKey ? (
                              <input
                                id={`${provider.id}-api-key`}
                                type="password"
                                value={value.apiKey}
                                onChange={(event) =>
                                  updateProvider(provider.id, {
                                    apiKey: event.target.value,
                                    clearKey: false,
                                  })
                                }
                                placeholder={
                                  provider.id === "gemini"
                                    ? "按顺序粘贴，多个 Key 用英文逗号分隔"
                                    : provider.configured
                                      ? "粘贴新的 API Key"
                                      : "粘贴真实 API Key"
                                }
                                autoComplete="off"
                                spellCheck="false"
                                disabled={saving || value.clearKey}
                              />
                            ) : (
                              <span className="settings-saved-key">
                                已安全保存到本机
                              </span>
                            )}
                            {provider.id === "gemini" && (
                              <small>
                                支持多个 Key，以英文逗号分隔；额度用尽后按顺序切换。
                              </small>
                            )}
                          </label>

                          <div className="settings-model-field">
                            <span>模型（按勾选顺序自动降级）</span>
                            <div className="settings-model-list">
                              {value.availableModels.map((model) => {
                                const checked = value.models.includes(model);
                                const isBuiltIn = (
                                  provider.defaultModels || [provider.model]
                                ).includes(model);
                                return (
                                  <div
                                    className="settings-model-option"
                                    key={model}
                                  >
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          const models = event.target.checked
                                            ? [...value.models, model]
                                            : value.models.filter(
                                                (item) => item !== model,
                                              );
                                          if (!models.length) {
                                            setMessage("每项服务至少选择一个模型。");
                                            return;
                                          }
                                          setMessage("");
                                          updateProvider(provider.id, { models });
                                        }}
                                        disabled={saving}
                                      />
                                      <span>{model}</span>
                                    </label>
                                    {isBuiltIn ? (
                                      <small>内置</small>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateProvider(provider.id, {
                                            models: checked
                                              ? value.models.filter(
                                                  (item) => item !== model,
                                                )
                                              : value.models,
                                            availableModels:
                                              value.availableModels.filter(
                                                (item) => item !== model,
                                              ),
                                          })
                                        }
                                        disabled={
                                          saving ||
                                          (checked && value.models.length === 1)
                                        }
                                      >
                                        删除
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="settings-model-add">
                              <input
                                type="text"
                                value={value.newModel}
                                onChange={(event) =>
                                  updateProvider(provider.id, {
                                    newModel: event.target.value,
                                  })
                                }
                                placeholder="输入模型名称"
                                autoComplete="off"
                                spellCheck="false"
                                disabled={saving}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const model = value.newModel.trim();
                                  if (!model) return;
                                  if (model.includes(",")) {
                                    setMessage("模型名称不能包含英文逗号。");
                                    return;
                                  }
                                  setMessage("");
                                  updateProvider(provider.id, {
                                    availableModels: [
                                      ...new Set([
                                        ...value.availableModels,
                                        model,
                                      ]),
                                    ],
                                    models: [
                                      ...new Set([...value.models, model]),
                                    ],
                                    newModel: "",
                                  });
                                }}
                                disabled={saving || !value.newModel.trim()}
                              >
                                增加模型
                              </button>
                            </div>
                          </div>
                        </div>

                        {provider.configured && !value.clearKey && (
                          <div className="settings-replace-key">
                            {isEditingKey ? (
                              <button
                                type="button"
                                onClick={() => {
                                  updateProvider(provider.id, { apiKey: "" });
                                  setEditingKeyProviderId(null);
                                }}
                                disabled={saving}
                              >
                                取消更换
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingKeyProviderId(provider.id)
                                }
                                disabled={saving}
                              >
                                更换 Key
                              </button>
                            )}
                          </div>
                        )}

                        {provider.configured && (
                          <div
                            className={`settings-provider-danger${
                              value.clearKey ? " pending" : ""
                            }`}
                          >
                            <div>
                              <strong>
                                {value.clearKey
                                  ? "保存后将从本机移除此 Key"
                                  : "从本机移除 Key"}
                              </strong>
                              <span>
                                仅删除本机配置，不会停用供应商端 Key。
                              </span>
                            </div>
                            {value.clearKey ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProvider(provider.id, {
                                    clearKey: false,
                                  })
                                }
                                disabled={saving}
                              >
                                撤销
                              </button>
                            ) : (
                              <button
                                className="settings-remove-key"
                                type="button"
                                onClick={() => {
                                  updateProvider(provider.id, {
                                    apiKey: "",
                                    clearKey: true,
                                  });
                                  setEditingKeyProviderId(null);
                                }}
                                disabled={saving}
                              >
                                从本机移除 Key
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {message && (
              <p className="settings-message" role="alert">
                {message}
              </p>
            )}

            <div className="settings-actions">
              <button
                className="settings-cancel"
                type="button"
                onClick={onClose}
                disabled={saving}
              >
                取消
              </button>
              <button className="settings-save" type="submit" disabled={saving}>
                {saving ? "正在保存…" : "保存配置"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
