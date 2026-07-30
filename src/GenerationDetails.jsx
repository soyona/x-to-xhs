import {
  CheckCircle2,
  ChevronDown,
  CircleMinus,
  X,
  XCircle,
} from "lucide-react";
import { useId, useState } from "react";

const FAILURE_LABELS = {
  auth: "Key 无效或没有调用权限",
  empty: "没有返回可用内容",
  quota: "额度或速率限制已用尽",
  request: "请求失败",
  timeout: "请求超时",
  unavailable: "服务暂时不可用",
  unknown: "调用失败",
};

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return null;
  if (durationMs < 1000) return `${Math.max(0, Math.round(durationMs))} 毫秒`;
  return `${(durationMs / 1000).toFixed(1)} 秒`;
}

function attemptResult(attempt) {
  if (attempt.status === "success") return "生成成功";
  if (attempt.status === "skipped") return attempt.message || "已跳过";
  return FAILURE_LABELS[attempt.reason] || attempt.message || "调用失败";
}

function attemptIcon(attempt) {
  if (attempt.status === "success") return CheckCircle2;
  if (attempt.status === "skipped") return CircleMinus;
  return XCircle;
}

export function getRunState(run) {
  const attempts = Array.isArray(run?.attempts) ? run.attempts : [];
  const failedCount = attempts.filter(
    (attempt) => attempt.status === "failed",
  ).length;
  const success = attempts.find((attempt) => attempt.status === "success");
  return {
    attempts,
    failedCount,
    success,
    degraded: failedCount > 0 && Boolean(success),
  };
}

export function GenerationDetails({ run, placement = "statusbar" }) {
  const { attempts, failedCount, success, degraded } = getRunState(run);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!attempts.length) return null;

  const summary = run?.failed
    ? "全部调用失败 · 查看详情"
    : degraded
      ? `自动切换成功 · 共尝试 ${failedCount + 1} 次`
      : "本次生成详情";

  const panel = (
    <div
      className="generation-details-panel"
      id={panelId}
      role={placement === "statusbar" ? "dialog" : undefined}
      aria-label={placement === "statusbar" ? "本次生成详情" : undefined}
    >
      <div className="generation-details-heading">
        <div>
          <strong>
            {run?.failed
              ? "本次生成未完成"
              : degraded
                ? `最终由 ${success.label} 完成`
                : `${success?.label || run?.providerLabel || "模型"} 生成成功`}
          </strong>
          <span>调用记录不显示或保存完整 API Key</span>
        </div>
        {placement === "statusbar" && (
          <button
            type="button"
            className="generation-details-close"
            aria-label="关闭生成详情"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <ol>
        {attempts.map((attempt, index) => {
          const AttemptIcon = attemptIcon(attempt);
          const duration = formatDuration(attempt.durationMs);
          const metadata = [
            attempt.statusCode ? `HTTP ${attempt.statusCode}` : null,
            duration,
          ].filter(Boolean);
          return (
            <li className={attempt.status} key={`${attempt.provider}-${index}`}>
              <AttemptIcon aria-hidden="true" />
              <div>
                <strong>
                  {attempt.label || attempt.provider || "模型"}
                  {attempt.keyIndex && attempt.keyCount
                    ? ` · Key ${attempt.keyIndex}/${attempt.keyCount}`
                    : ""}
                </strong>
                <span>{attemptResult(attempt)}</span>
                {metadata.length > 0 && (
                  <small>{metadata.join(" · ")}</small>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  if (placement === "statusbar") {
    return (
      <div
        className={`generation-details statusbar-details${open ? " open" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <button
          type="button"
          className="generation-details-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{summary}</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {open && panel}
      </div>
    );
  }

  return (
    <details className={`generation-details ${placement}`}>
      <summary>
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" />
      </summary>
      {panel}
    </details>
  );
}
