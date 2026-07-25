# System Patterns

## 总体数据流

```text
用户输入
  ├─ 完整文本 ───────────────┐
  └─ X URL → oEmbed 解析 ────┤
                             ↓
Long-form-post-prompt.md 注入原文
                             ↓
Gemini → Groq Qwen → OpenRouter Free
                             ↓
Markdown 草稿
  ├─ validateDraft → 自动检查 + 人工复核提示
  ├─ splitXiaohongshuDraft → 标题/正文/描述/标签
  └─ repair / revise / regenerate → 新草稿 → 重新检查
```

## 提示词模式

`server.mjs` 每次生成都重新读取 `Long-form-post-prompt.md`，再替换唯一输入占位符。这样修改 Markdown 规范后无需把完整提示词复制进 JavaScript。

禁止：

- 在代码中复制一份独立的完整提示词。
- 绕过占位符直接拼接不受控的模板版本。
- 让 UI 文案成为内容规范的唯一来源。

## 供应商适配模式

`providers.mjs` 维护唯一的供应商数组，顺序就是自动降级顺序。

- 未配置或使用占位符：跳过。
- 当前供应商失败：记录错误并继续下一家。
- 401/403：统一为 Key 无效或无权限。
- 429/配额错误：统一为免费额度或速率限制耗尽。
- 5xx：统一为服务暂时不可用。
- 全部失败：把各家的安全错误摘要组合给 UI。

第二次自动修复可以跳过上一次成功的供应商，尝试另一模型。

## Markdown 与发布文本分层

- 模型输出保持 Markdown，供结构识别和校验。
- `validation.js` 读取 Markdown 标题和固定分区。
- `xiaohongshuPublish.js` 拆分发布字段。
- `xiaohongshuText.js` 清理井号、加粗、代码、引用、表格和列表符号。
- 剪贴板只接收清理后的字段，不直接复制内部 Markdown。

不要把“预览格式”和“小红书粘贴格式”混成同一个字符串。

## 验证模式

`validateDraft()` 返回：

```js
{
  checks: [{ id, label, requirement, actual, pass }],
  valid,
  counts
}
```

- 自动项拥有机器可判定的 `pass`。
- 人工项只存在 `validationGroups` 中，不进入 `checks`。
- UI 通过 ID 把检查项映射回父级分组。
- 固定格式检查会拒绝摘要、标签、自查之间或自查之后的额外 Markdown 分区。

## 修复模式

`repairStrategy.js` 根据失败数量和严重程度选择：

- `repair`：少量问题，保留已通过内容。
- `revise`：中等数量问题，统一修订结构与篇幅。
- `regenerate`：严重残缺或失败过多，重新生成。

前端提交：

- 原始输入。
- 当前草稿。
- 失败项及当前值、目标要求。
- 已通过项。
- 修复模式。

服务端把这些内容加入原始规范提示词，模型只返回修复后的完整 Markdown。

当前限制：复合检查缺少细粒度失败原因，且单个主体结构失败可能过早触发 `regenerate`。详见 `activeContext.md`。

## 设置持久化模式

设置页永不读取 Key：

1. `/api/health` 只返回 `id`、`label`、`model`、`configured`。
2. 密码框初始化为空。
3. 留空表示保留服务器已有值。
4. 新 Key 通过同源 POST 提交。
5. 服务端合并 `.env`，保留无关变量。
6. 写入后更新当前进程环境，使配置即时生效。

## UI 布局模式

- `app-shell` 使用固定的顶部栏、工作区、状态栏三行布局。
- 工作区桌面为三列，窄屏为三行。
- `html/body/#root` 和工作区禁止溢出。
- 长内容必须放在面板内部滚动容器。
- 弹窗使用固定遮罩和自身滚动区，不改变整页高度。
