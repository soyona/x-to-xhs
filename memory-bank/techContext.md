# Technical Context

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、React DOM 19 |
| 构建与开发 | Vite 6、`@vitejs/plugin-react` |
| 服务端 | Node.js ESM、原生 `node:http` |
| HTTP / 代理 | 原生 `fetch`、Undici `ProxyAgent` |
| 测试 | Node.js 内置 `node:test`、`node:assert/strict` |
| 样式 | 单文件原生 CSS |
| 持久化 | 本地 `.env` + `.local-data/history.json` + `.local-data/prompts.json`，无数据库 |

要求 Node.js 20.18 或更高版本。

## 开发与生产

```bash
npm install
npm run dev
```

`npm run dev` 通过 `scripts/dev.mjs` 同时启动：

- Vite：`http://localhost:5173`
- Node API：`http://localhost:8787`

开发脚本以 Node watch 模式运行本地服务；服务端代码及其依赖变化后会自动
重启，避免页面热更新与 API 版本不一致。
监听清单必须只包含现存的服务端依赖；当前包含提示词存储、内容偏好、
局部生成及小红书文本拆分模块，不再监听已删除的 `src/validation.js`。

Vite 将 `/api` 代理到 8787。

生产运行：

```bash
npm run build
npm start
```

生产服务由 `server.mjs` 同时提供 API 和 `dist/` 静态文件。

## 环境变量

| 变量 | 用途 |
|---|---|
| `GEMINI_API_KEY` | Gemini 密钥 |
| `GROQ_API_KEY` | Groq 密钥 |
| `ZHIPU_API_KEY` | 智谱开放平台密钥 |
| `SILICONFLOW_API_KEY` | 硅基流动密钥 |
| `OPENROUTER_API_KEY` | OpenRouter 密钥 |
| `GEMINI_MODEL` | 覆盖 Gemini 默认模型 |
| `GROQ_MODEL` | 覆盖 Groq 默认模型 |
| `ZHIPU_MODEL` | 覆盖智谱默认模型 |
| `SILICONFLOW_MODEL` | 覆盖硅基流动默认模型 |
| `OPENROUTER_MODEL` | 覆盖 OpenRouter 默认模型 |
| `PORT` | Node 服务端口，默认 8787 |
| `X_TO_XHS_HOST` | 服务监听地址，默认仅 `127.0.0.1` |
| `X_TO_XHS_DATA_DIR` | 可选的历史数据目录覆盖 |
| `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` | 外部请求代理 |

默认模型：

- Gemini：`gemini-3.5-flash`
- Groq Qwen：`qwen/qwen3.6-27b`
- 智谱 GLM：`glm-4.7-flash`
- 硅基流动 Qwen：`Qwen/Qwen3.5-4B`
- OpenRouter：`openrouter/free`

## API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 返回供应商、模型和是否配置；绝不返回 Key |
| POST | `/api/settings` | 保存/保留/清除 Key，更新模型 |
| GET | `/api/prompts` | 返回系统默认、自定义方案和当前选中方案 |
| POST | `/api/prompts` | 保存、切换或删除自定义提示词方案 |
| GET | `/api/history` | 最近更新时间倒序返回历史列表 |
| GET | `/api/history/:id` | 返回一条历史详情和最近 3 个版本 |
| DELETE | `/api/history/:id` | 删除一条历史及其全部版本 |
| POST | `/api/resolve` | 将 X URL 解析为正文 |
| POST | `/api/generate` | 组装提示词并生成草稿 |
| POST | `/api/generate-section` | 按当前提示词方案重新生成指定内容模块 |

请求体上限为 256 KiB。

`/api/generate` 和 `/api/generate-section` 可携带 `preferences`。服务端仅接受
`src/contentPreferences.js` 声明的枚举值，并限制自由文本长度；偏好不写入
`.env`，由浏览器本地存储持久化。

生成接口成功保存历史后返回 `historyId` 和 `historyVersion`。历史保存失败不会
吞掉已经生成的草稿，而是返回 `historyWarning` 供页面明确提示。

历史文件写入采用同目录临时文件和原子重命名，主文件替换前保存最近的有效备份；
目录权限为 `700`，JSON 与备份权限为 `600`。

## 密钥安全

- `.env` 在 `.gitignore` 中。
- 设置页使用 `type="password"`，已保存 Key 永不回显。
- 留空 Key 表示保持不变；勾选后才清除。
- 保存采用临时文件 + 原子重命名，并将 `.env` 权限设置为 `600`。
- `your_*_key_here`、`replace_me` 等占位符不算已配置。
- 不要在测试输出、截图、文档或日志中打印真实 Key。

## 外部接口

- X URL 解析：`https://publish.twitter.com/oembed`
- Gemini：Google Generative Language API
- Groq：OpenAI 兼容 Chat Completions API
- 智谱：OpenAI 兼容 Chat Completions API
- 硅基流动：OpenAI 兼容 Chat Completions API
- OpenRouter：OpenAI 兼容 Chat Completions API

模型请求超时为 300 秒，最大输出 Token 为 14,000。

## 验证命令

```bash
npm run test
npm run build
npm run check
git diff --check
```

截至 2026-07-25，共有 44 项自动化测试。最新运行结果为全部通过；生产构建通过。
