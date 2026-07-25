# X → 小红书

一个围绕 [`Long-form-post-prompt.md`](./Long-form-post-prompt.md) 的本地转换器。粘贴 X 帖子正文或单条帖子 URL，应用会生成小红书「写长文」草稿，并逐项验证标题、正文、摘要、标签、固定结构与审稿自查要求。

应用内部保留 Markdown 用于拆分和确定性校验；发布时按小红书流程分别复制长文标题、正文、发布标题、正文描述和标签。复制内容会自动清理标题井号、加粗星号、代码围栏、分隔线和 Markdown 表格语法。

模型调用顺序固定为：

1. 默认：Gemini
2. 备用：Groq Qwen
3. 兜底：OpenRouter Free

服务端会跳过没有配置 Key 的服务；遇到限流、额度耗尽、超时或调用错误时，会自动继续下一家。

## 本地运行

需要 Node.js 20.18 或更高版本。

```bash
npm install
cp .env.example .env
```

可以在页面右上角打开“API 配置”，填写至少一个 API Key；也可以直接编辑 `.env`。全部配置时可获得完整的自动切换链路：

```dotenv
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
```

密钥只由本地 Node 服务读取，不会回显到浏览器，也不会写入浏览器存储。

开发模式：

```bash
npm run dev
```

然后打开 [http://localhost:5173](http://localhost:5173)。

生产模式：

```bash
npm run build
npm start
```

然后打开 [http://localhost:8787](http://localhost:8787)。

## 输入与生成

- 直接粘贴完整 X 帖子文本时，内容会原样进入仓库中的 Markdown 提示词。
- 只粘贴 `x.com/.../status/...` 或 `twitter.com/.../status/...` URL 时，本地服务会先通过 X 的公开 oEmbed 接口解析正文。若公开接口只返回短链或帖子不可读取，界面会要求改为粘贴完整正文，避免模型凭空补写。
- 本地服务会自动读取常见的 `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` 环境变量。
- 默认模型分别为 `gemini-3.5-flash`、`qwen/qwen3.6-27b` 和 `openrouter/free`；可用 `GEMINI_MODEL`、`GROQ_MODEL`、`OPENROUTER_MODEL` 覆盖。
- 生成后的验证是确定性的结构/字数检查，不替代事实核查和发布前人工审稿。
- `03 规范检查` 包含 11 项自动检查和 8 项发布前人工复核；人工项不计入自动失败数量。

## 小红书发布流程

生成后请按界面中的 7 个步骤操作，不要一次复制整个 Markdown：

1. 输入长文标题
2. 输入长文正文
3. 点击「一键排版」
4. 修改发布标题
5. 输入正文描述
6. 输入标签
7. 检查并发布

## 验证

```bash
npm run check
```

设计概念保存在
[`product-assets/docs/design-concept.png`](./product-assets/docs/design-concept.png)。

后续开发请先阅读 [`.codexrules`](./.codexrules) 和
[`memory-bank/activeContext.md`](./memory-bank/activeContext.md)。
