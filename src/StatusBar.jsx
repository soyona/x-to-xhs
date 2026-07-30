import {
  GenerationDetails,
  getRunState,
} from "./GenerationDetails";
const TOKEN_NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");
const DEFAULT_PROVIDER_LABELS = [
  "Gemini",
  "Groq Qwen",
  "智谱 GLM",
  "硅基流动 Qwen",
  "OpenRouter Free",
];

function formatTokenCount(value) {
  return Number.isFinite(value)
    ? TOKEN_NUMBER_FORMAT.format(value)
    : null;
}

export function StatusBar({
  health,
  isGenerating,
  prototypeMode,
  run,
}) {
  const providerLabels = health.providers.length
    ? health.providers.map((provider) => provider.label)
    : DEFAULT_PROVIDER_LABELS;
  const {
    attempts,
    success: successfulAttempt,
    degraded,
  } = getRunState(run);
  const chainText =
    attempts.length
      ? attempts
          .map((attempt) => {
            const keyLabel =
              attempt.keyIndex && attempt.keyCount
                ? ` Key ${attempt.keyIndex}/${attempt.keyCount}`
                : "";
            if (attempt.status === "success") {
              return `${attempt.label}${keyLabel} 成功`;
            }
            if (attempt.status === "skipped") {
              return `${attempt.label} 已跳过`;
            }
            return `${attempt.label}${keyLabel} 失败`;
          })
          .join(" → ")
      : providerLabels.join(" → ");
  const inputTokens = formatTokenCount(run?.usage?.input);
  const outputTokens = formatTokenCount(run?.usage?.output);
  const totalTokens = formatTokenCount(run?.usage?.total);

  return (
    <footer className="statusbar">
      <div className="statusbar-chain" title={chainText}>
        {attempts.length ? (
          <GenerationDetails run={run} />
        ) : (
          <>
            <span className="statusbar-label">自动切换</span>
            <span>{chainText}</span>
          </>
        )}
      </div>
      <div className="statusbar-run" role="status" aria-live="polite">
        {isGenerating ? (
          <>
            <span className="statusbar-outcome">正在按顺序调用模型</span>
            <span className="statusbar-token">Token 统计中</span>
          </>
        ) : run?.failed ? (
          <>
            <span className="statusbar-outcome failed">
              生成失败，可查看调用详情
            </span>
            <span className="statusbar-token">Token —</span>
          </>
        ) : run ? (
          <>
            <span className={`statusbar-outcome${degraded ? " degraded" : ""}`}>
              {degraded
                ? `已由备用模型完成：${successfulAttempt?.label}`
                : `本次：${run.providerLabel}`}
            </span>
            <span className="statusbar-model" title={run.model}>
              {run.model}
            </span>
            <span className="statusbar-token">
              {prototypeMode
                ? "Token —"
                : totalTokens
                  ? `Token ${totalTokens}`
                  : "Token 未返回"}
            </span>
            {inputTokens && outputTokens && (
              <span className="statusbar-token-breakdown">
                输入 {inputTokens} / 输出 {outputTokens}
              </span>
            )}
          </>
        ) : (
          <span className="statusbar-outcome">等待生成</span>
        )}
      </div>
    </footer>
  );
}
