import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CONTENT_PREFERENCE_FIELDS,
  DEFAULT_CONTENT_PREFERENCES,
  normalizeContentPreferences,
} from "./contentPreferences";

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
  legacyInstructions,
  onMigrateLegacyInstructions,
  saving,
  setSaving,
  message,
  setMessage,
  onUpdatePrompts,
}) {
  const [draftId, setDraftId] = useState("default");
  const [draftName, setDraftName] = useState("系统默认");
  const [draftModules, setDraftModules] = useState({});
  const [activeModule, setActiveModule] = useState("title");

  useEffect(() => {
    const profile = selectedPromptProfile(promptState);
    if (!profile) return;
    setDraftId(profile.id);
    setDraftName(profile.name);
    setDraftModules({ ...profile.modules });
  }, [promptState]);

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
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function selectProfile(event) {
    await runPromptAction(
      { action: "select", id: event.target.value },
      "提示词方案已切换。",
    );
  }

  async function saveProfile(event) {
    event.preventDefault();
    await runPromptAction(
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
  }

  async function deleteProfile() {
    if (isDefault || isNew) return;
    if (!window.confirm(`确定删除提示词方案“${draftName}”吗？`)) return;
    await runPromptAction(
      { action: "delete", id: draftId },
      "自定义方案已删除，已切换到系统默认。",
    );
  }

  function createCopy() {
    const profile = selectedPromptProfile(promptState);
    setDraftId("new");
    setDraftName(`${profile?.name || "提示词方案"} 副本`);
    setDraftModules({ ...(profile?.modules || promptState.defaultProfile.modules) });
    setMessage("正在编辑新方案，保存后才会启用。");
  }

  function resetActiveModule() {
    setDraftModules((current) => ({
      ...current,
      [activeModule]: promptState.defaultProfile.modules[activeModule],
    }));
  }

  async function migrateLegacyInstructions() {
    if (!legacyInstructions?.trim()) return;
    const migratedModules = {
      ...draftModules,
      global: `${draftModules.global.trim()}\n\n## 已迁移的补充创作指令\n\n${legacyInstructions.trim()}`,
    };
    setSaving(true);
    setMessage("");
    try {
      await onUpdatePrompts({
        action: "save",
        profile: {
          id: isDefault || isNew ? undefined : draftId,
          name: isDefault ? "迁移后的创作方案" : draftName,
          modules: migratedModules,
        },
      });
      onMigrateLegacyInstructions();
      setDraftModules(migratedModules);
      setMessage("旧版补充指令已迁移到当前方案的全局规则。");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={saveProfile}>
      <div className="prompt-settings">
        {legacyInstructions?.trim() && (
          <div className="legacy-instructions-note">
            <div>
              <strong>检测到旧版补充创作指令</strong>
              <span>
                当前仍会继续生效。迁移后将写入全局规则，并从快速设置中移除。
              </span>
            </div>
            <button
              className="settings-reset"
              type="button"
              onClick={migrateLegacyInstructions}
              disabled={saving}
            >
              迁移到全局规则
            </button>
          </div>
        )}
        <p className="preference-note">
          修改全局规则或任一内容模块，即可影响完整生成和对应的局部重新生成。固定输出协议由
          系统保护，系统默认来自 Long-form-post-prompt.md。
        </p>

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

        <label className="prompt-name-field" htmlFor="prompt-profile-name">
          方案名称
          <input
            id="prompt-profile-name"
            value={draftName}
            maxLength={40}
            onChange={(event) => setDraftName(event.target.value)}
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
            onChange={(event) =>
              setDraftModules((current) => ({
                ...current,
                [activeModule]: event.target.value,
              }))
            }
            disabled={saving}
            spellCheck="false"
          />
          <span>{(draftModules[activeModule] || "").length.toLocaleString()} 字符</span>
        </label>

        {message && (
          <p className="settings-message" role="status">
            {message}
          </p>
        )}
      </div>

      <div className="settings-actions preference-actions">
        <button
          className="settings-reset"
          type="button"
          onClick={resetActiveModule}
          disabled={saving}
        >
          当前模块恢复默认
        </button>
        {!isDefault && !isNew && (
          <button
            className="settings-cancel"
            type="button"
            onClick={deleteProfile}
            disabled={saving}
          >
            删除方案
          </button>
        )}
        <button className="settings-save" type="submit" disabled={saving}>
          {saving
            ? "正在保存…"
            : isDefault || isNew
              ? "保存为新方案"
              : "保存方案"}
        </button>
      </div>
    </form>
  );
}

export function ApiSettingsDialog({
  open,
  health,
  preferences,
  promptState,
  initialTab = "creation",
  onClose,
  onSave,
  onSavePreferences,
  onUpdatePrompts,
}) {
  const [providers, setProviders] = useState(emptyProviders);
  const [preferenceDraft, setPreferenceDraft] = useState(
    DEFAULT_CONTENT_PREFERENCES,
  );
  const [activeTab, setActiveTab] = useState(
    initialTab === "providers" ? "providers" : "creation",
  );
  const [creationMode, setCreationMode] = useState(
    initialTab === "prompts" ? "advanced" : "quick",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [expandedProviderId, setExpandedProviderId] = useState(null);
  const [editingKeyProviderId, setEditingKeyProviderId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === "providers" ? "providers" : "creation");
    setCreationMode(initialTab === "prompts" ? "advanced" : "quick");
    setPreferenceDraft(normalizeContentPreferences(preferences));
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
    setPreferenceMessage("");
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

  function updatePreference(id, value) {
    setPreferenceDraft((current) => ({ ...current, [id]: value }));
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

  function submitPreferences(event) {
    event.preventDefault();
    onSavePreferences(normalizeContentPreferences(preferenceDraft));
    setPreferenceMessage("快速设置已保存，将在下次生成或重新生成时生效。");
  }

  function clearLegacyInstructions() {
    const next = normalizeContentPreferences({
      ...preferenceDraft,
      additionalInstructions: "",
    });
    setPreferenceDraft(next);
    onSavePreferences(next);
    setPreferenceMessage("");
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
            <span className="settings-eyebrow">本地个性化配置</span>
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
            <p className="creation-settings-intro">
              先用快速设置调整本次表达；需要长期复用或精细控制时，再编辑高级提示词。
            </p>

            <div
              className="creation-mode-switch"
              role="tablist"
              aria-label="创作设置类型"
            >
              <button
                type="button"
                role="tab"
                aria-selected={creationMode === "quick"}
                className={creationMode === "quick" ? "active" : ""}
                onClick={() => setCreationMode("quick")}
              >
                <span>
                  <strong>快速设置</strong>
                  <small>适合每篇文章快速调整</small>
                </span>
                <b>低风险</b>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={creationMode === "advanced"}
                className={creationMode === "advanced" ? "active" : ""}
                onClick={() => setCreationMode("advanced")}
              >
                <span>
                  <strong>高级提示词</strong>
                  <small>用于建立长期复用的生成规则</small>
                </span>
                <b>高级</b>
              </button>
            </div>

            {creationMode === "quick" ? (
              <form className="settings-form" onSubmit={submitPreferences}>
                <div className="preference-settings">
                  <p className="preference-note">
                    调整读者、语气和内容侧重；与提示词中的同类表达偏好冲突时，以这里为准。
                  </p>

                  <div className="preference-grid">
                    {CONTENT_PREFERENCE_FIELDS.map((field) => (
                      <label key={field.id} htmlFor={`preference-${field.id}`}>
                        {field.label}
                        <select
                          id={`preference-${field.id}`}
                          value={preferenceDraft[field.id]}
                          onChange={(event) =>
                            updatePreference(field.id, event.target.value)
                          }
                        >
                          {field.options.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="preference-text-fields">
                    <label htmlFor="preference-author-persona">
                      作者表达身份
                      <input
                        id="preference-author-persona"
                        type="text"
                        maxLength={100}
                        value={preferenceDraft.authorPersona}
                        onChange={(event) =>
                          updatePreference("authorPersona", event.target.value)
                        }
                        placeholder="例如：有产品和工程经验的独立开发者"
                      />
                      <span>{preferenceDraft.authorPersona.length}/100</span>
                    </label>

                    <label htmlFor="preference-banned-phrases">
                      禁用表达
                      <input
                        id="preference-banned-phrases"
                        type="text"
                        maxLength={200}
                        value={preferenceDraft.bannedPhrases}
                        onChange={(event) =>
                          updatePreference("bannedPhrases", event.target.value)
                        }
                        placeholder="用逗号分隔，例如：封神、颠覆、遥遥领先"
                      />
                      <span>{preferenceDraft.bannedPhrases.length}/200</span>
                    </label>
                  </div>
                </div>

                {preferenceMessage && (
                  <p className="settings-message" role="status">
                    {preferenceMessage}
                  </p>
                )}

                <div className="settings-actions preference-actions">
                  <button
                    className="settings-reset"
                    type="button"
                    onClick={() =>
                      setPreferenceDraft({ ...DEFAULT_CONTENT_PREFERENCES })
                    }
                  >
                    恢复默认
                  </button>
                  <button className="settings-save" type="submit">
                    保存快速设置
                  </button>
                </div>
              </form>
            ) : (
              <PromptSettings
                promptState={promptState}
                legacyInstructions={preferenceDraft.additionalInstructions}
                onMigrateLegacyInstructions={clearLegacyInstructions}
                saving={saving}
                setSaving={setSaving}
                message={message}
                setMessage={setMessage}
                onUpdatePrompts={onUpdatePrompts}
              />
            )}
          </div>
        ) : (
          <form className="settings-form" onSubmit={submitProviders}>
            <p className="settings-security-note">
              Key 仅保存到本机服务端的 .env 文件；页面不会读取或回显完整 Key。
              移除只会删除本机配置，不会停用供应商端 Key。
            </p>

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
