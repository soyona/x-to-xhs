import { useEffect, useState } from "react";

const emptyProviders = {};

export function ApiSettingsDialog({
  open,
  health,
  onClose,
  onSave,
}) {
  const [providers, setProviders] = useState(emptyProviders);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
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
  }, [health.providers, open]);

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

  async function submit(event) {
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
            <span className="settings-eyebrow">本地服务配置</span>
            <h2 id="settings-title">API 配置</h2>
          </div>
          <button
            className="settings-close"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭 API 配置"
          >
            ×
          </button>
        </div>

        <p className="settings-security-note">
          Key 仅保存到本机服务端的 .env 文件；页面不会读取或回显已保存的完整
          Key。
        </p>

        <form className="settings-form" onSubmit={submit}>
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
      </section>
    </div>
  );
}
