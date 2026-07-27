import { useEffect, useMemo, useState } from "react";

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && /^\/api\/history(?:\?|$)/.test(path)) {
      throw new Error(
        "本地服务尚未加载历史功能，请重启 npm run dev 后再试。刚刚由旧服务生成的稿件尚未写入历史。",
      );
    }
    throw new Error(data.error || "历史记录请求失败。");
  }
  return data;
}

function formatTime(value) {
  if (!value) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function HistoryDialog({
  open,
  activeHistoryId,
  onClose,
  onLoad,
  onDeleted,
}) {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    setConfirmDeleteId(null);
    requestJson("/api/history?limit=50")
      .then((result) => {
        if (cancelled) return;
        setRecords(result.records || []);
        const preferredId =
          result.records?.find((record) => record.id === activeHistoryId)?.id ||
          result.records?.[0]?.id ||
          null;
        setSelectedId(preferredId);
        if (!preferredId) setDetail(null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeHistoryId, open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape" && !deletingId) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [deletingId, onClose, open]);

  useEffect(() => {
    if (!open || !selectedId) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setError("");
    requestJson(`/api/history/${encodeURIComponent(selectedId)}`)
      .then((record) => {
        if (cancelled) return;
        setDetail(record);
        setSelectedVersion(record.currentVersion);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  const activeVersion = useMemo(
    () =>
      detail?.versions?.find(
        (version) => version.version === selectedVersion,
      ) ||
      detail?.versions?.at(-1) ||
      null,
    [detail, selectedVersion],
  );

  if (!open) return null;

  async function removeRecord(id) {
    setDeletingId(id);
    setError("");
    try {
      await requestJson(`/api/history/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const nextRecords = records.filter((record) => record.id !== id);
      setRecords(nextRecords);
      setConfirmDeleteId(null);
      onDeleted(id);
      if (selectedId === id) {
        setSelectedId(nextRecords[0]?.id || null);
        setDetail(null);
      }
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="settings-backdrop history-backdrop" role="presentation">
      <section
        className="history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="settings-dialog-header history-dialog-header">
          <div>
            <span className="settings-eyebrow">仅保存在本机服务端</span>
            <h2 id="history-title">历史笔记</h2>
          </div>
          <button
            className="settings-close"
            type="button"
            onClick={onClose}
            disabled={Boolean(deletingId)}
            aria-label="关闭历史笔记"
          >
            ×
          </button>
        </div>

        <div className="history-layout">
          <aside className="history-list-panel" aria-label="历史笔记列表">
            <div className="history-list-summary">
              <strong>{records.length} 条记录</strong>
              <span>最近更新优先</span>
            </div>

            <div className="history-list">
              {loading ? (
                <p className="history-empty">正在读取历史…</p>
              ) : records.length ? (
                records.map((record) => (
                  <button
                    className={`history-list-item ${
                      selectedId === record.id ? "active" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedId(record.id);
                      setConfirmDeleteId(null);
                    }}
                    aria-pressed={selectedId === record.id}
                    key={record.id}
                  >
                    <strong>{record.title}</strong>
                    <span>
                      {formatTime(record.updatedAt)} · 版本
                      {record.currentVersion}
                    </span>
                    <small>
                      {record.promptProfile?.name || "历史提示词方案"}
                      {record.generation?.providerLabel
                        ? ` · ${record.generation.providerLabel}`
                        : ""}
                    </small>
                  </button>
                ))
              ) : (
                <div className="history-empty">
                  <strong>还没有历史笔记</strong>
                  <span>首次生成成功后会自动保存在这里。</span>
                </div>
              )}
            </div>
          </aside>

          <div className="history-detail">
            {error && (
              <p className="history-error" role="alert">
                {error}
              </p>
            )}

            {detailLoading ? (
              <p className="history-empty">正在载入笔记…</p>
            ) : detail && activeVersion ? (
              <>
                <div className="history-detail-heading">
                  <div>
                    <h3>{detail.title}</h3>
                    <p>
                      首次生成 {formatTime(detail.createdAt)} · 最近修改{" "}
                      {formatTime(detail.updatedAt)}
                    </p>
                  </div>
                  <label htmlFor="history-version">
                    查看版本
                    <select
                      id="history-version"
                      value={selectedVersion || ""}
                      onChange={(event) =>
                        setSelectedVersion(Number(event.target.value))
                      }
                    >
                      {[...(detail.versions || [])]
                        .reverse()
                        .map((version) => (
                          <option
                            value={version.version}
                            key={version.version}
                          >
                            版本 {version.version} ·{" "}
                            {version.type === "generate" ? "首次生成" : "内容版本"}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="history-meta">
                  <span>
                    {activeVersion.promptProfile?.name ||
                      detail.promptProfile?.name ||
                      "历史提示词方案"}
                  </span>
                  <span>
                    {activeVersion.providerLabel ||
                      activeVersion.provider ||
                      "模型未知"}
                  </span>
                  <span>{activeVersion.model || "模型版本未知"}</span>
                </div>

                <pre className="history-draft">{activeVersion.draft}</pre>

                <div className="history-actions">
                  {confirmDeleteId === detail.id ? (
                    <div className="history-delete-confirm" role="alert">
                      <span>确定删除这条历史笔记及其全部版本？</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={Boolean(deletingId)}
                      >
                        取消
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => removeRecord(detail.id)}
                        disabled={Boolean(deletingId)}
                      >
                        {deletingId ? "正在删除…" : "确认删除"}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="history-delete"
                      type="button"
                      onClick={() => setConfirmDeleteId(detail.id)}
                    >
                      删除
                    </button>
                  )}
                  <button
                    className="history-load"
                    type="button"
                    onClick={() =>
                      onLoad({ record: detail, version: activeVersion })
                    }
                  >
                    载入工作区
                  </button>
                </div>
              </>
            ) : !loading ? (
              <div className="history-empty history-detail-empty">
                <strong>选择一条历史笔记</strong>
                <span>可查看完整内容或载入当前工作区。</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
