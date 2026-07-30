# System Patterns

## 总体数据流

```text
用户输入 → X URL 解析（可选）
        ↓
promptStore 读取当前提示词方案
        ↑
Long-form-post-prompt.md 默认模块
        ↑
.local-data/prompts.json 自定义内容模块（可选覆盖）
        ↓
Gemini → Groq Qwen → 智谱 GLM → 硅基流动 Qwen → OpenRouter Free
        ↓
Markdown 草稿
  ├─ splitXiaohongshuDraft → 标题/正文/描述/标签
  ├─ generate-section → 指定模块候选
  └─ historyStore → history.json + history.json.bak
```

## 提示词单一来源

- `Long-form-post-prompt.md` 定义 `global`、`title`、`body`、`summary`、
  `tags`、`output` 六个默认模块。
- `promptStore.mjs` 是模块解析、本地方案选择和原子保存的唯一权威。
- 页面方案保存 `global` 与四个内容模块；仅 `output` 始终继承默认文件。
- 完整生成组合全部模块；局部生成只组合 `global` 与目标内容模块。
- 默认模板和当前页面方案都可导出为完整 Markdown；上传模板解析相同模块，
  并拒绝固定 `output` 协议被修改的文件。
- JSON 返回格式、原始素材注入和候选数量由代码附加，不允许内容方案覆盖。
- 内容规则不得复制到 JavaScript、测试断言或 UI 文案中。

## 内容结果策略

- 不执行标题字数、Emoji、章节、摘要长度或标签数量等内容 validation。
- 模型内容不符合提示词时仍返回页面，由用户选择、重新生成或人工调整。
- 只保留技术协议检查：JSON 可解析、结果非空、候选数量正确。
- 新稿固定尾部包含摘要和标签，不再生成审稿自查。
- `xiaohongshuPublish.js` 与 `workflowDraft.js` 继续兼容旧稿的审稿自查分区。

## 发布文本分层

- 正文保留`#`、`##`、`-`和`1.`，供小红书识别标题与列表。
- `xiaohongshuPublish.js` 拆分发布字段。
- `xiaohongshuText.js` 只做兼容清理，不定义内容风格。
- 富文本复制与纯文本兜底必须由同一个正文值确定性派生。
- `---` 和文字版页脚不能控制卡片分页，兼容清理会删除这些旧信号。

## 设置与持久化

- 自定义提示词保存在 `.local-data/prompts.json`，采用临时文件和原子重命名。
- API Key 只保存在 `.env`，设置页永不读取或回显完整 Key。
- 历史保存在 `.local-data/history.json`，有效旧文件备份为
  `history.json.bak`。
- `.local-data` 目录权限为 `700`，数据文件权限为 `600`。

## UI 布局模式

- 页面只有两个核心工作区，整页禁止滚动，各面板内部滚动。
- 设置弹窗包含“创作设置”和“模型与 API”；创作设置只展示当前提示词方案。
- `PublishWorkflow` 按 7 步分段复制，并在对应部分提供主动重新生成。
- 正文变化后，发布标题、摘要和标签继续显示基于旧正文的提示。
- 页面不显示内容通过数、失败数、修复入口或自动重写状态。
