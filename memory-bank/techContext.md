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
| 持久化 | 本地 `.env`，无数据库 |

要求 Node.js 20.18 或更高版本。

## 开发与生产

```bash
npm install
npm run dev
```

`npm run dev` 通过 `scripts/dev.mjs` 同时启动：

- Vite：`http://localhost:5173`
- Node API：`http://localhost:8787`

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
| `OPENROUTER_API_KEY` | OpenRouter 密钥 |
| `GEMINI_MODEL` | 覆盖 Gemini 默认模型 |
| `GROQ_MODEL` | 覆盖 Groq 默认模型 |
| `OPENROUTER_MODEL` | 覆盖 OpenRouter 默认模型 |
| `PORT` | Node 服务端口，默认 8787 |
| `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` | 外部请求代理 |

默认模型：

- Gemini：`gemini-3.5-flash`
- Groq Qwen：`qwen/qwen3.6-27b`
- OpenRouter：`openrouter/free`

## API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 返回供应商、模型和是否配置；绝不返回 Key |
| POST | `/api/settings` | 保存/保留/清除 Key，更新模型 |
| POST | `/api/resolve` | 将 X URL 解析为正文 |
| POST | `/api/generate` | 组装提示词并生成草稿 |
| POST | `/api/repair` | 按失败项修复、修订或重生草稿 |

请求体上限为 64 KiB。

`/api/generate` 和 `/api/repair` 可携带 `preferences`。服务端仅接受
`src/contentPreferences.js` 声明的枚举值，并限制自由文本长度；偏好不写入
`.env`，由浏览器本地存储持久化。

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
- OpenRouter：OpenAI 兼容 Chat Completions API

模型请求超时为 300 秒，最大输出 Token 为 14,000。

## 验证命令

```bash
npm run test
npm run build
npm run check
git diff --check
```

截至 2026-07-25，共有 27 项自动化测试。最新运行结果为 26 项通过、1
项因缺少 `examples/demo1.md` 测试夹具而失败；生产构建通过。
