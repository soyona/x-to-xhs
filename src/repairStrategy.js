export const MAX_REPAIR_ATTEMPTS = 2;

export function getRepairStrategy(validation) {
  const failedChecks = validation.checks.filter((check) => !check.pass);
  const failedCount = failedChecks.length;
  const severe =
    validation.counts.bodyCount < 2940 ||
    failedChecks.some(
      (check) =>
        check.id === "structure" &&
        ["不完整", "缺失", "无法识别"].includes(check.actual),
    );

  if (severe || failedCount >= 7) {
    return {
      mode: "regenerate",
      label: `重新生成合格长文（${failedCount}项）`,
      description: "当前草稿整体不完整，将根据原始 X 内容重新生成。",
    };
  }
  if (failedCount >= 4) {
    return {
      mode: "revise",
      label: `结构化修订（${failedCount}项）`,
      description: "保留可用内容，并统一修订结构与篇幅。",
    };
  }
  return {
    mode: "repair",
    label: `自动修复（${failedCount}项）`,
    description: "保留已通过内容，只修复未通过项目。",
  };
}
