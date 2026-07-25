import { useEffect, useMemo, useState } from "react";
import { AlertIcon, ArrowIcon, CheckIcon, CopyIcon } from "./icons";
import { MAX_REPAIR_ATTEMPTS } from "./repairStrategy";
import { validationGroups } from "./validation";
import { splitXiaohongshuDraft } from "./xiaohongshuPublish";
import {
  toXiaohongshuPlainText,
  toXiaohongshuRichHtml,
} from "./xiaohongshuText";

const checkLabels = new Map(
  validationGroups.flatMap((group) =>
    group.items.map((item) => [item.id, item.label]),
  ),
);

function statusCopy(checks, isRepairing, hasError) {
  const failedCount = checks.filter((check) => !check.pass).length;
  if (isRepairing) return "正在修复";
  if (hasError) return "修复失败";
  if (failedCount) return `${failedCount} 项需要修复`;
  return `${checks.length} 项检查通过`;
}

function InlineChecks({
  title,
  scopeId,
  checkIds,
  validationMap,
  attempts,
  isRepairing,
  repairScope,
  repairError,
  onRepair,
}) {
  const checks = checkIds
    .map((id) => validationMap.get(id))
    .filter(Boolean);
  const failedChecks = checks.filter((check) => !check.pass);
  const scopeIsRepairing = isRepairing && repairScope?.id === scopeId;
  const scopeHasError = Boolean(
    repairError && repairScope?.id === scopeId && !isRepairing,
  );
  const [expanded, setExpanded] = useState(failedChecks.length > 0);

  useEffect(() => {
    setExpanded(failedChecks.length > 0 || scopeHasError);
  }, [failedChecks.length, scopeHasError]);

  if (!checks.length) return null;

  const state = scopeIsRepairing
    ? "working"
    : scopeHasError
      ? "error"
      : failedChecks.length
        ? "fail"
        : "pass";
  const canRepair =
    failedChecks.length > 0 &&
    attempts < MAX_REPAIR_ATTEMPTS &&
    !isRepairing;

  return (
    <div className={`inline-checks ${state}`} aria-live="polite">
      <button
        className="inline-checks-toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="inline-checks-icon">
          {state === "pass" ? <CheckIcon /> : <AlertIcon />}
        </span>
        <span className="inline-checks-title">{title}</span>
        <strong>{statusCopy(checks, scopeIsRepairing, scopeHasError)}</strong>
        <span className="inline-checks-disclosure" aria-hidden="true">
          {expanded ? "收起" : "查看规范"}
        </span>
      </button>

      {expanded && (
        <div className="inline-checks-detail">
          {scopeHasError && (
            <div className="inline-repair-error" role="alert">
              {repairError}
            </div>
          )}

          <div className="inline-check-list">
            {checks.map((check) => (
              <div
                className={`inline-check-row ${check.pass ? "pass" : "fail"}`}
                key={check.id}
              >
                <span>{check.pass ? <CheckIcon /> : <AlertIcon />}</span>
                <div>
                  <strong>{checkLabels.get(check.id) || check.label}</strong>
                  <p>
                    当前：{check.actual}；要求：{check.requirement}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {failedChecks.length > 0 && (
            <div className="inline-repair-action">
              <div>
                <strong>
                  {attempts >= MAX_REPAIR_ATTEMPTS
                    ? "已达到两次自动处理上限"
                    : "重点修复当前问题，并重新检查整稿"}
                </strong>
                <p>
                  {attempts >= MAX_REPAIR_ATTEMPTS
                    ? "请人工确认剩余问题，或恢复上一版本后再调整。"
                    : "其他已通过内容会作为保留条件提交给模型。"}
                </p>
              </div>
              <button
                className="inline-repair-button"
                type="button"
                disabled={!canRepair}
                onClick={() =>
                  onRepair({
                    id: scopeId,
                    label: title,
                    checkIds,
                  })
                }
              >
                {scopeIsRepairing ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <ArrowIcon />
                )}
                {scopeIsRepairing ? "正在修复…" : "修复此部分"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyStep({
  number,
  title,
  hint,
  value,
  meta,
  copied,
  onCopy,
  children,
  large = false,
  warning = false,
  disabled = false,
}) {
  return (
    <section
      className={`publish-step ${large ? "is-large" : ""}`}
      id={`publish-step-${number}`}
    >
      <div className="publish-step-heading">
        <span className="publish-step-number">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <span className={`publish-step-meta ${warning ? "is-warning" : ""}`}>
          {meta}
        </span>
      </div>
      <div className="publish-copy-area">
        <pre>{value || "生成结果中未识别到此部分，请先检查当前草稿。"}</pre>
        <button
          className="section-copy-button"
          type="button"
          onClick={onCopy}
          disabled={!value || disabled}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {children}
    </section>
  );
}

function ActionStep({ number, title, description, children }) {
  return (
    <section className="publish-step is-action" id={`publish-step-${number}`}>
      <div className="publish-step-heading">
        <span className="publish-step-number">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="platform-action">在小红书操作</span>
      </div>
      {children}
    </section>
  );
}

function WorkflowSummary({
  validation,
  attempts,
  historyCount,
  isRepairing,
  repairScope,
  repairError,
  onRepair,
  onRestore,
}) {
  const failedChecks = validation.checks.filter((check) => !check.pass);
  const passedCount = validation.checks.length - failedChecks.length;

  return (
    <div
      className={`workflow-summary ${
        validation.valid ? "pass" : "needs-attention"
      }`}
      aria-live="polite"
    >
      <div className="workflow-summary-copy">
        <span className="workflow-summary-icon">
          {validation.valid ? <CheckIcon /> : <AlertIcon />}
        </span>
        <div>
          <strong>
            {validation.valid
              ? "自动规范已全部通过"
              : `${failedChecks.length} 项需要修复`}
          </strong>
          <p>
            {passedCount}/{validation.checks.length} 项自动检查通过
            {validation.valid
              ? " · 可以继续按步骤发布"
              : " · 修复后会重新检查整稿"}
          </p>
          {repairError && repairScope?.id === "all" && (
            <small role="alert">{repairError}</small>
          )}
        </div>
      </div>
      <div className="workflow-summary-actions">
        {!validation.valid && attempts < MAX_REPAIR_ATTEMPTS && (
          <button
            className="summary-repair-button"
            type="button"
            disabled={isRepairing}
            onClick={() =>
              onRepair({
                id: "all",
                label: "全部未通过项目",
                checkIds: failedChecks.map((check) => check.id),
              })
            }
          >
            {isRepairing && repairScope?.id === "all"
              ? "正在修复…"
              : "修复全部问题"}
          </button>
        )}
        {historyCount > 0 && (
          <button
            className="summary-restore-button"
            type="button"
            disabled={isRepairing}
            onClick={onRestore}
          >
            恢复上一版本
          </button>
        )}
      </div>
    </div>
  );
}

export function PublishWorkflow({
  draft,
  validation,
  attempts,
  historyCount,
  isRepairing,
  repairScope,
  repairError,
  onRepair,
  onRestore,
}) {
  const fields = useMemo(() => splitXiaohongshuDraft(draft), [draft]);
  const validationMap = useMemo(
    () => new Map(validation.checks.map((check) => [check.id, check])),
    [validation],
  );
  const [copiedStep, setCopiedStep] = useState("");

  useEffect(() => {
    setCopiedStep("");
  }, [draft]);

  async function copyField(step, value, { richText = false } = {}) {
    if (!value) return;
    if (
      richText &&
      navigator.clipboard.write &&
      typeof window.ClipboardItem === "function"
    ) {
      try {
        const plainText = toXiaohongshuPlainText(value);
        const richHtml = toXiaohongshuRichHtml(value);
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "text/plain": new Blob([plainText], { type: "text/plain" }),
            "text/html": new Blob([richHtml], { type: "text/html" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(toXiaohongshuPlainText(value));
      }
    } else {
      await navigator.clipboard.writeText(
        richText ? toXiaohongshuPlainText(value) : value,
      );
    }
    setCopiedStep(step);
    window.setTimeout(() => {
      setCopiedStep((current) => (current === step ? "" : current));
    }, 1800);
  }

  const inlineCheckProps = {
    validationMap,
    attempts,
    isRepairing,
    repairScope,
    repairError,
    onRepair,
  };

  return (
    <div className="publish-workflow">
      <WorkflowSummary
        validation={validation}
        attempts={attempts}
        historyCount={historyCount}
        isRepairing={isRepairing}
        repairScope={repairScope}
        repairError={repairError}
        onRepair={onRepair}
        onRestore={onRestore}
      />

      <div className="workflow-intro">
        <strong>按发布流程分段复制，检查结果已放回对应内容</strong>
        <p>
          复制正文时优先转换为富文本，平台不支持时自动使用无井号纯文本；修复后会重新检查整份草稿。
        </p>
      </div>

      <CopyStep
        number="01"
        title="输入长文标题"
        hint="粘贴到「写长文」编辑器的标题区域。"
        value={fields.longformTitle}
        meta={`${fields.counts.longformTitle}字`}
        copied={copiedStep === "longform-title"}
        onCopy={() => copyField("longform-title", fields.longformTitle)}
        disabled={isRepairing}
      >
        <InlineChecks
          {...inlineCheckProps}
          title="标题规范"
          scopeId="longform-title"
          checkIds={["title"]}
        />
      </CopyStep>

      <CopyStep
        number="02"
        title="输入长文正文"
        hint="复制时同时写入富文本标题/列表与无井号纯文本兜底；不包含摘要、标签和审稿自查。"
        value={fields.body}
        meta={`${fields.counts.body.toLocaleString()}字`}
        copied={copiedStep === "body"}
        onCopy={() => copyField("body", fields.body, { richText: true })}
        disabled={isRepairing}
        large
      >
        <InlineChecks
          {...inlineCheckProps}
          title="正文与整稿规范"
          scopeId="body"
          checkIds={[
            "body",
            "opening",
            "structure",
            "practice",
            "fixed-format",
            "review",
          ]}
        />
      </CopyStep>

      <ActionStep
        number="03"
        title="点击「一键排版」"
        description="由小红书生成封面和内容卡片，确认排版后继续。"
      />

      <CopyStep
        number="04"
        title="修改发布标题"
        hint="与步骤 01 使用同一标题；进入发布页后再次粘贴。"
        value={fields.publishTitle}
        meta={`${fields.counts.publishTitle}/20字`}
        warning={fields.counts.publishTitle > 20}
        copied={copiedStep === "publish-title"}
        onCopy={() => copyField("publish-title", fields.publishTitle)}
        disabled={isRepairing}
      >
        <InlineChecks
          {...inlineCheckProps}
          title="发布标题（与步骤 01 同源）"
          scopeId="publish-title"
          checkIds={["title"]}
        />
      </CopyStep>

      <CopyStep
        number="05"
        title="输入正文描述"
        hint={
          fields.sources.description === "summary"
            ? "使用生成稿中的「正文小结 / 摘要」；平台限制 1000 字。"
            : "未识别到独立摘要，已自动提取正文结尾；平台限制 1000 字。"
        }
        value={fields.description}
        meta={`${fields.counts.description}/1000字`}
        warning={fields.counts.description > 1000}
        copied={copiedStep === "description"}
        onCopy={() => copyField("description", fields.description)}
        disabled={isRepairing}
      >
        <InlineChecks
          {...inlineCheckProps}
          title="摘要与发布描述"
          scopeId="description"
          checkIds={["summary", "description-limit"]}
        />
      </CopyStep>

      <CopyStep
        number="06"
        title="输入标签"
        hint={
          fields.sources.tags === "default-fallback"
            ? "未识别到推荐标签，已补充通用 AI 标签，可在发布前调整。"
            : "复制推荐标签，粘贴到发布页标签区域。"
        }
        value={fields.tags}
        meta={`${fields.counts.tags}个`}
        copied={copiedStep === "tags"}
        onCopy={() => copyField("tags", fields.tags)}
        disabled={isRepairing}
      >
        <InlineChecks
          {...inlineCheckProps}
          title="标签规范"
          scopeId="tags"
          checkIds={["tags", "tag-format"]}
        />
      </CopyStep>

      <ActionStep
        number="07"
        title="检查并发布"
        description="在小红书确认封面、内容卡片、标题、描述和标签，确认无误后点击「发布」。"
      />
    </div>
  );
}
