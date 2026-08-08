import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const protectedSources = [
  "src/App.jsx",
  "src/GenerationDetails.jsx",
  "src/PublishWorkflow.jsx",
];

const requiredFiles = [
  "docs/ui-system.md",
  "src/components/ui/Button.jsx",
  "src/components/ui/IconButton.jsx",
  "src/components/ui/ActionGroup.jsx",
  "src/components/ui/SegmentedControl.jsx",
  "src/components/ui/icons.js",
  "src/styles/foundations.css",
  "src/styles/ui-system.css",
];

const failures = [];

async function read(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    failures.push(`${relativePath}: 无法读取（${error.code || error.message}）`);
    return "";
  }
}

const files = new Map();
for (const relativePath of [
  ...requiredFiles,
  ...protectedSources,
  ".codexrules",
  "package.json",
  "src/styles.css",
  "src/styles/shell.css",
  "src/styles/publish-workflow.css",
  "src/styles/responsive.css",
]) {
  files.set(relativePath, await read(relativePath));
}

async function collectJsx(relativeDirectory) {
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await collectJsx(relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".jsx")) {
      paths.push(relativePath);
    }
  }
  return paths;
}

async function collectCss(relativeDirectory) {
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await collectCss(relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      paths.push(relativePath);
    }
  }
  return paths;
}

if (!files.get("docs/ui-system.md").startsWith("# UI System v1")) {
  failures.push("docs/ui-system.md: 必须以 # UI System v1 开头");
}

if (!files.get(".codexrules").includes("docs/ui-system.md")) {
  failures.push(".codexrules: 必须路由到 docs/ui-system.md");
}

if (!files.get("src/styles.css").includes('@import "./styles/ui-system.css";')) {
  failures.push("src/styles.css: 必须加载 UI System 样式");
}

if (!files.get("package.json").includes('"check:ui": "node scripts/check-ui-contract.mjs"')) {
  failures.push("package.json: 必须保留 check:ui 契约检查");
}

for (const token of [
  "--ui-font-sans",
  "--ui-font-mono",
  "--ui-font-size-body",
  "--ui-font-size-control",
  "--ui-font-weight-regular",
  "--ui-font-weight-medium",
  "--ui-font-weight-bold",
  "--ui-line-height-body",
  "--ui-letter-spacing-overline",
]) {
  if (!files.get("src/styles/foundations.css").includes(token)) {
    failures.push(`src/styles/foundations.css: 必须保留字体 Token ${token}`);
  }
}

const forbiddenActionClass = /(?:material-action|generate-button|section-copy-button|topbar-icon-button|material-cancel-action|source-mode-options)/u;

for (const relativePath of ["src/styles/shell.css", "src/styles/publish-workflow.css", "src/styles/responsive.css"]) {
  if (forbiddenActionClass.test(files.get(relativePath))) {
    failures.push(`${relativePath}: 禁止恢复旧操作控件样式体系`);
  }
}

for (const relativePath of await collectJsx("src")) {
  const source = await read(relativePath);
  if (/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/iu.test(source)) {
    failures.push(`${relativePath}: JSX 中的颜色必须使用 UI System 语义 Token`);
  }
  if (relativePath !== "src/components/ui/icons.js" && /from\s+["']lucide-react["']/u.test(source)) {
    failures.push(`${relativePath}: 应从 src/components/ui/icons.js 引入应用图标`);
  }
  if (/from\s+["']\.\/icons["']/u.test(source)) {
    failures.push(`${relativePath}: 禁止恢复旧的局部图标体系`);
  }
}

for (const relativePath of await collectCss("src")) {
  if (relativePath === "src/styles/foundations.css") continue;
  const source = await read(relativePath);
  if (/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/iu.test(source)) {
    failures.push(`${relativePath}: 业务样式颜色必须使用 foundations.css 语义 Token`);
  }

  for (const match of source.matchAll(/(font-(?:family|size|weight)|line-height|letter-spacing)\s*:\s*([^;]+);/gu)) {
    const [, property, rawValue] = match;
    const value = rawValue.trim();
    const usesTypographyToken =
      (property === "font-family" && (value === "inherit" || /^var\(--ui-font-(?:sans|mono)\)$/u.test(value))) ||
      (property === "font-size" && (value === "0" || /^var\(--ui-font-size-[\w-]+\)$/u.test(value))) ||
      (property === "font-weight" && /^var\(--ui-font-weight-[\w-]+\)$/u.test(value)) ||
      (property === "line-height" && /^var\(--ui-line-height-[\w-]+\)$/u.test(value)) ||
      (property === "letter-spacing" && (value === "normal" || /^var\(--ui-letter-spacing-[\w-]+\)$/u.test(value)));

    if (!usesTypographyToken) {
      failures.push(`${relativePath}: ${property} 必须使用 UI System 字体 Token`);
      break;
    }
  }
}

for (const relativePath of protectedSources) {
  const source = files.get(relativePath);

  if (/function\s+(?:MaterialAction|PublishingKitAction)\b/u.test(source)) {
    failures.push(`${relativePath}: 禁止重新声明独立操作按钮组件`);
  }

  for (const match of source.matchAll(/<button\b[\s\S]*?<\/button>/gu)) {
    const isSpecializedCandidate = relativePath === "src/PublishWorkflow.jsx" && /section-candidate/u.test(match[0]);
    if (!isSpecializedCandidate) {
      failures.push(`${relativePath}: 通用操作按钮必须使用 src/components/ui/**`);
      break;
    }
  }
}

if (failures.length) {
  console.error("UI System v1 契约检查失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("UI System v1 契约检查通过");
}
