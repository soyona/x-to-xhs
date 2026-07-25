import { ArrowIcon } from "./icons";
import { MAX_REPAIR_ATTEMPTS } from "./repairStrategy";

export function RepairControls({
  validation,
  strategy,
  attempts,
  historyCount,
  isRepairing,
  onRepair,
  onRestore,
}) {
  const failedCount = validation.checks.filter((check) => !check.pass).length;

  if (validation.valid && !historyCount) return null;

  return (
    <div className="repair-controls">
      {!validation.valid && (
        <div className="repair-guidance">
          <strong>
            {attempts
              ? `第${attempts}次处理后仍有 ${failedCount} 项未通过`
              : strategy.description}
          </strong>
          <p>
            {attempts >= MAX_REPAIR_ATTEMPTS
              ? "已达到两次自动处理上限，请人工确认剩余项目。"
              : "修复完成后会自动重新执行全部规范检查。"}
          </p>
        </div>
      )}

      <div className="repair-buttons">
        {!validation.valid && attempts < MAX_REPAIR_ATTEMPTS && (
          <button
            className="repair-button"
            type="button"
            onClick={onRepair}
            disabled={isRepairing}
          >
            <span>{isRepairing ? "正在处理…" : strategy.label}</span>
            {isRepairing ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <ArrowIcon />
            )}
          </button>
        )}

        {historyCount > 0 && (
          <button
            className="restore-button"
            type="button"
            onClick={onRestore}
            disabled={isRepairing}
          >
            恢复上一版本
          </button>
        )}
      </div>
    </div>
  );
}
