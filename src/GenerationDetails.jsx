import {
  CheckCircle2,
  ChevronDown,
  CircleMinus,
  X,
  XCircle,
} from "./components/ui/icons";
import { Button } from "./components/ui/Button";
import { IconButton } from "./components/ui/IconButton";
import { useEffect, useId, useRef, useState } from "react";

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
  const detailsRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open || placement !== "statusbar") return undefined;

    panelRef.current?.focus();

    function closeOnOutsidePointer(event) {
      if (!detailsRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open, placement]);

  if (!attempts.length) return null;

  const summary = run?.failed
    ? "全部调用失败 · 查看详情"
    : degraded
      ? `自动切换成功 · 共尝试 ${failedCount + 1} 次`
      : "本次生成详情";
  const tone = run?.failed
    ? "danger"
    : degraded
      ? "warning"
      : success
        ? "success"
        : "neutral";

  function closeAndRestoreFocus() {
    setOpen(false);
    requestAnimationFrame(() => {
      detailsRef.current?.querySelector(".generation-details-trigger")?.focus();
    });
  }

  const panel = (
    <div
      ref={placement === "statusbar" ? panelRef : undefined}
      className="generation-details-panel"
      id={panelId}
      role={placement === "statusbar" ? "dialog" : undefined}
      aria-label={placement === "statusbar" ? "本次生成详情" : undefined}
      tabIndex={placement === "statusbar" ? -1 : undefined}
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
          <IconButton
            className="generation-details-close"
            label="关闭生成详情"
            icon={<X />}
            size="sm"
            variant="ghost"
            onClick={closeAndRestoreFocus}
          />
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
        ref={detailsRef}
        className={`generation-details statusbar-details is-${tone}${open ? " open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeAndRestoreFocus();
          }
        }}
      >
        <Button
          className="generation-details-trigger"
          icon={<ChevronDown />}
          iconPosition="end"
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {summary}
        </Button>
        {open && panel}
      </div>
    );
  }

  return (
    <details className={`generation-details ${placement} is-${tone}`}>
      <summary>
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" />
      </summary>
      {panel}
    </details>
  );
}
