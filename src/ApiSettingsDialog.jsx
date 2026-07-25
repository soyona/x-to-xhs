import { useEffect, useState } from "react";
import {
  CONTENT_PREFERENCE_FIELDS,
  DEFAULT_CONTENT_PREFERENCES,
  normalizeContentPreferences,
} from "./contentPreferences";

const emptyProviders = {};

export function ApiSettingsDialog({
  open,
  health,
  preferences,
  initialTab = "preferences",
  onClose,
  onSave,
  onSavePreferences,
}) {
  const [providers, setProviders] = useState(emptyProviders);
  const [preferenceDraft, setPreferenceDraft] = useState(
    DEFAULT_CONTENT_PREFERENCES,
  );
  const [activeTab, setActiveTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setPreferenceDraft(normalizeContentPreferences(preferences));
    setProviders(
      Object.fromEntries(
        health.providers.map((provider) => [
          provider.id,
          {
            apiKey: "",
            clearKey: false,
            model: provider.model,
          },
        ]),
      ),
    );
    setSaving(false);
    setMessage("");
  }, [health.providers, initialTab, open, preferences]);

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
    onClose();
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
            aria-selected={activeTab === "preferences"}
            className={activeTab === "preferences" ? "active" : ""}
            onClick={() => {
              setActiveTab("preferences");
              setMessage("");
            }}
            disabled={saving}
          >
            创作偏好
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

        {activeTab === "preferences" ? (
          <form className="settings-form" onSubmit={submitPreferences}>
            <div className="preference-settings">
              <p className="preference-note">
                偏好只影响受众、语气和内容侧重。固定输出结构、事实边界与平台规范不会被覆盖。
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

                <label
                  className="preference-instructions"
                  htmlFor="preference-additional-instructions"
                >
                  高级设置：补充创作指令
                  <textarea
                    id="preference-additional-instructions"
                    maxLength={500}
                    value={preferenceDraft.additionalInstructions}
                    onChange={(event) =>
                      updatePreference(
                        "additionalInstructions",
                        event.target.value,
                      )
                    }
                    placeholder="例如：多解释工程取舍，减少营销语气。这里只补充写作偏好，不能修改固定输出协议。"
                  />
                  <span>{preferenceDraft.additionalInstructions.length}/500</span>
                </label>
              </div>
            </div>

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
              <button
                className="settings-cancel"
                type="button"
                onClick={onClose}
              >
                取消
              </button>
              <button className="settings-save" type="submit">
                保存偏好
              </button>
            </div>
          </form>
        ) : (
          <form className="settings-form" onSubmit={submitProviders}>
            <p className="settings-security-note">
              Key 仅保存到本机服务端的 .env 文件；页面不会读取或回显已保存的完整
              Key。
            </p>

            <div className="settings-provider-list">
              {health.providers.map((provider, index) => {
                const value = providers[provider.id] || {
                  apiKey: "",
                  clearKey: false,
                  model: provider.model,
                };
                return (
                  <fieldset className="settings-provider" key={provider.id}>
                    <legend>
                      <span>{index + 1}</span>
                      {provider.label}
                      <b className={provider.configured ? "ready" : "missing"}>
                        {provider.configured ? "已配置" : "未配置"}
                      </b>
                    </legend>

                    <label htmlFor={`${provider.id}-api-key`}>
                      API Key
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
                          provider.configured
                            ? "已保存；留空保持不变"
                            : "粘贴真实 API Key"
                        }
                        autoComplete="off"
                        spellCheck="false"
                        disabled={saving || value.clearKey}
                      />
                    </label>

                    <label htmlFor={`${provider.id}-model`}>
                      模型
                      <input
                        id={`${provider.id}-model`}
                        type="text"
                        value={value.model}
                        onChange={(event) =>
                          updateProvider(provider.id, {
                            model: event.target.value,
                          })
                        }
                        autoComplete="off"
                        spellCheck="false"
                        disabled={saving}
                        required
                      />
                    </label>

                    {provider.configured && (
                      <label className="settings-clear-key">
                        <input
                          type="checkbox"
                          checked={value.clearKey}
                          onChange={(event) =>
                            updateProvider(provider.id, {
                              apiKey: "",
                              clearKey: event.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        清除已保存的 Key
                      </label>
                    )}
                  </fieldset>
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
