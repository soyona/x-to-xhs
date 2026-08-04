# x-to-xhs 图文笔记功能 Spec

版本：1.1  
状态：终审通过，待实施  
日期：2026-08-04

## 1. 产品目标

在不破坏现有“小红书长文笔记”能力的前提下，增加“小红书图文笔记”模式。

图文笔记生成结果包括：

1. 标题
2. 图片组
3. 正文描述
4. 标签

产品要求：

- 图片组对应长文笔记中的长文正文。
- 标题、正文描述和标签在两种模式中保持一致的操作体验。
- 长文和图文使用完全独立的 Prompt 文件、方案存储、当前选择和输出协议。
- 用户可以把不同图文 Prompt 保存为“商务简约”等图文方案。
- 图文方案中的视觉模块可以像小红书“一键排版”主题一样单独应用。
- 图文预览与最终下载图片必须所见即所得。

## 2. 非目标

首版不包含：

- 自动发布到小红书。
- 视频、GIF、Live Photo。
- AI 直接生成包含中文文字的整张图片。
- AI 插画或摄影背景生成。
- 用户字体、Logo 和品牌素材库。
- 云端同步。
- 多人协作。
- 单页局部重新生成。

## 3. 核心产品原则

### 3.1 内容完全独立

长文 Prompt 和图文 Prompt 不共享任何内容模块。

即使两者都有标题、正文描述和标签模块，也分别维护、分别选择、分别生成。

修改图文标题规则不得影响长文标题；修改长文标签规则不得影响图文标签。

### 3.2 体验保持一致

两种模式共享：

- 方案选择与增删改交互。
- 标题候选、复制和重新生成交互。
- 正文描述复制和重新生成交互。
- 标签复制和重新生成交互。
- 候选不会自动覆盖当前内容。
- 临近操作位置的成功、失败和依赖状态反馈。

共享的是组件和行为，不是 Prompt 内容或生成结果。

### 3.3 内容生成与视觉应用解耦

“图文方案”包含全部图文规则：

- 标题
- 图片内容
- 正文描述
- 标签
- 视觉主题

“应用主题风格”只读取当前图文方案中的视觉模块：

- 封面
- 布局
- 风格
- 配色
- 元素

应用主题不得改写标题、图片文案、正文描述或标签。

如果当前图文方案的视觉模块已经解析并缓存 Theme Token，应用主题只进行本地重新渲染。

如果视觉模块已经修改、导入或从未解析，应用主题允许调用独立的“主题解析”请求，将视觉 Prompt 转换为受支持的 Theme Token。该请求不得携带或生成标题、图片文案、正文描述及标签。

“重新生成图片组”读取完整图文方案，并使正文描述和标签进入“基于上一版图片内容”状态。

## 4. 信息架构

页面继续保持两个核心工作区：

- `01 素材创作`
- `02 小红书笔记`

`01` 增加输出模式：

- 长文笔记
- 图文笔记

`02` 根据当前模式展示对应工作流，不增加第三个主面板。

切换模式时：

- 保留同一份输入素材。
- 分别保留长文和图文的未提交草稿。
- 不自动发起模型调用。
- 顶部当前 Prompt 名称切换到对应模式的独立方案。
- 历史记录载入时自动恢复正确模式。
- 正在进行的旧模式请求不得覆盖新模式界面状态。

## 5. 发布流程

| 步骤 | 长文笔记 | 图文笔记 |
|---|---|---|
| 01 | 长文标题 | 图文标题 |
| 02 | 长文正文 | 图片内容 |
| 03 | 小红书一键排版 | 应用主题风格 |
| 04 | 正文描述 | 正文描述 |
| 05 | 标签 | 标签 |
| 06 | 预览并发布 | 预览与下载 |

### 5.1 图文标题

- 首次生成包含一个当前标题。
- 首次生成成功后自动生成三个标题候选。
- 支持复制当前标题或候选标题。
- 支持重新生成三个候选。
- 采用候选后同步更新封面标题并重新渲染。
- 采用候选不得重新生成图片正文、正文描述或标签。
- 候选不会自动覆盖当前标题。

### 5.2 图片内容

- 默认生成6至10页。
- 最多18页。
- 第一页默认为封面。
- 图片组至少包含一张封面和一张内容页。
- 支持编辑每页文字内容。
- 支持重新生成整组图片内容。
- 重新生成前保留当前图片组，生成成功后才替换。
- 重新生成失败时继续保留旧图片组。
- 图片内容变化后，旧正文描述和标签显示依赖过期提醒。
- 首版不支持单页局部重新生成。
- 页面只验证技术结构，不判断内容质量。

### 5.3 主题风格

- 显示当前图文方案名称，如“商务简约”。
- 支持应用当前方案中的视觉模块。
- 支持从工作流直接进入当前图文方案设置。
- 图文方案修改后，已生成笔记不会自动变化。
- 用户主动点击“应用主题”后才更新预览。
- 应用主题不得改变图片页数或任何文字内容。
- Theme Token 未变化时不重复渲染全部页面。
- 主题解析失败时保留当前主题，并显示可恢复错误。
- 主题解析可以调用模型，但必须与内容生成请求隔离。

### 5.4 正文描述

- 对应长文流程中的“04 正文描述”。
- 支持复制和重新生成。
- 基于当前图片内容生成。
- 图片内容变化后标记为基于上一版内容。
- 重新生成或用户明确确认当前描述后解除过期提示。
- 应用视觉主题不会使正文描述过期。

### 5.5 标签

- 与长文标签保持相同预览和复制方式。
- 支持重新生成。
- 基于当前图片内容生成。
- 图片内容变化后标记为基于上一版内容。
- 应用视觉主题不会使标签过期。
- 没有可信趋势数据时只能显示“基于正文生成”，不得声称实时热门。

## 6. Prompt 与存储目录

受版本管理的默认 Prompt：

```text
prompts/
├── longform/
│   └── default.md
└── image-note/
    └── default.md
```

本地自定义方案：

```text
.local-data/
└── prompts/
    ├── longform.json
    └── image-note.json
```

下载文件名：

```text
xhs-longform-prompt--系统默认.md
xhs-longform-prompt--方案名称.md
xhs-image-note-prompt--系统默认.md
xhs-image-note-prompt--商务简约.md
```

两个 Prompt Store 分别维护自己的：

- 当前方案
- 自定义方案
- 写入队列
- Schema
- 模块定义
- 默认模板
- 导入导出
- 更新时间

## 7. 长文 Prompt 合同

文件：

```text
prompts/longform/default.md
```

固定模块顺序：

```text
GLOBAL
TITLE
BODY
SUMMARY
TAGS
OUTPUT
SOURCE
```

可编辑：

- GLOBAL
- TITLE
- BODY
- SUMMARY
- TAGS

系统保护：

- OUTPUT
- SOURCE
- Prompt 类型和版本
- 模块类型、数量、名称和顺序

现有固定输出标题和 `xiaohongshuPublish.js` 解析合同不得改变。

## 8. 图文 Prompt 合同

文件：

```text
prompts/image-note/default.md
```

固定模块顺序：

```text
GLOBAL
TITLE
IMAGES
COVER
LAYOUT
STYLE
COLOR
ELEMENTS
DESCRIPTION
TAGS
OUTPUT
SOURCE
```

模块职责：

| 模块 | 职责 |
|---|---|
| GLOBAL | 事实边界、目标读者和图文总体规则 |
| TITLE | 当前标题及标题候选规则 |
| IMAGES | 分页、图片数量、每页内容和信息密度 |
| COVER | 封面标题、副标题和封面结构 |
| LAYOUT | 网格、对齐、层级和留白 |
| STYLE | 商务简约、知识杂志等视觉语言 |
| COLOR | 背景、正文、强调色和配色关系 |
| ELEMENTS | 总字数、阅读时间、页码、来源及装饰元素 |
| DESCRIPTION | 正文描述规则 |
| TAGS | 标签规则 |
| OUTPUT | 固定结构化输出协议 |
| SOURCE | 固定素材注入位置 |

可编辑：

- GLOBAL
- TITLE
- IMAGES
- COVER
- LAYOUT
- STYLE
- COLOR
- ELEMENTS
- DESCRIPTION
- TAGS

系统保护：

- OUTPUT
- SOURCE
- Prompt 类型和版本
- 模块类型、数量、名称和顺序
- 图片数量、格式、大小及分辨率技术限制

“视觉模块”特指：

- COVER
- LAYOUT
- STYLE
- COLOR
- ELEMENTS

主题解析只能使用这些视觉模块，不得读取 TITLE、IMAGES、DESCRIPTION 或 TAGS。

## 9. Markdown 模板结构保护

每份 Prompt 顶部必须包含类型和版本。

长文：

```text
<!-- PROMPT_TYPE:longform -->
<!-- PROMPT_SCHEMA_VERSION:1 -->
```

图文：

```text
<!-- PROMPT_TYPE:image-note -->
<!-- PROMPT_SCHEMA_VERSION:1 -->
```

导入验证必须保证：

- 类型标识存在且唯一。
- Schema 版本受支持。
- 模块完整且无重复。
- 模块顺序没有改变。
- OUTPUT 与同类型系统默认完全一致。
- SOURCE 标记完整且唯一。
- 图文模板不能导入长文分类。
- 长文模板不能导入图文分类。
- 文件最大200 KiB。
- 验证失败时保留原文件和当前选择。

页面只允许修改可编辑模块标记之间的内容。

系统默认模板只读。用户必须先创建副本才能修改并保存。

## 10. 图文生成输出合同

图文 Prompt 输出严格 JSON，不输出 Markdown 围栏或解释。

```json
{
  "schemaVersion": 1,
  "noteType": "image-note",
  "title": "当前标题",
  "pages": [
    {
      "id": "page-01",
      "index": 1,
      "kind": "cover",
      "heading": "封面标题",
      "subheading": "封面副标题",
      "body": [],
      "highlight": null
    }
  ],
  "description": "正文描述",
  "tags": ["#标签1", "#标签2"],
  "themeTokens": {
    "canvas": {
      "width": 1080,
      "height": 1440
    },
    "colors": {
      "background": "#FFFFFF",
      "text": "#15181D",
      "accent": "#EF4B43"
    },
    "layout": "editorial",
    "showWordCount": true,
    "showReadingTime": true,
    "showPageNumber": true
  }
}
```

技术验证包括：

- JSON 可解析。
- `schemaVersion` 与 `noteType` 正确。
- 必需字段存在。
- 页面数组非空且不超过18项。
- 页面 ID 唯一。
- 页面索引连续。
- 第一页为封面。
- `kind` 属于系统白名单。
- Theme Token 属于系统支持范围。
- 颜色值和画布数值合法。
- 标签字段为字符串数组。
- 输出不包含未知顶层字段。

页面不得根据字数、标题吸引力或表达风格判定内容通过或失败。

## 11. 图片渲染策略

首版链路：

```text
Prompt生成结构化内容
→ 解析并验证JSON
→ React固定尺寸卡片渲染
→ 浏览器本地栅格化
→ PNG/JPEG/WebP下载
```

不让图片模型直接生成中文排版。

原因：

- 保证中文文字准确。
- 页码、字数和阅读时间可以确定性计算。
- 同一组件负责预览和导出。
- 主题可以在不改写内容的情况下重新应用。
- 历史记录无需保存大体积图片。

自由文本视觉 Prompt 最终必须解析为系统支持的 Theme Token。

不能映射的视觉描述：

- 使用当前主题的安全默认值。
- 明确列出没有生效的配置。
- 不得静默生成未知 CSS、HTML 或脚本。
- 不得把模型返回内容直接插入页面样式。

总字数、阅读时间、当前页码和总页数由程序计算，不接受模型直接提供的统计值。

## 12. 图文预览

图文工作区包括：

- 图片缩略图列表。
- 当前大图。
- 当前页数，例如 `03 / 09`。
- 上一页和下一页。
- 键盘左右方向键切换。
- 缩略图点击切换。
- 沉浸预览。
- `适应窗口`与`100%`。
- 当前图下载。
- 图片多选。
- 下载选中图片。
- 下载全部图片。

预览和导出必须使用同一个 `ImageCardRenderer`。

整页继续禁止滚动；缩略图、画布和属性区域各自在内部滚动。

预览缩放只影响显示，不得影响最终导出尺寸。

编辑内容后：

- 当前图片立即重新渲染。
- 其他图片不重复渲染。
- 正文描述和标签进入过期状态。
- 只修改视觉属性时不产生内容依赖过期。

## 13. 图片下载

默认输出：

- 1080×1440。
- 3:4。
- PNG。
- 文件名包含标题和两位页码。

示例：

```text
图文标题-01-封面.png
图文标题-02.png
```

下载方式：

- 当前图片直接下载。
- 选中图片逐张直接下载。
- 全部图片逐张直接下载。
- 不生成 ZIP。
- 不生成 `发布文案.txt`。

批量直接下载要求：

- 一次用户点击触发一个下载批次。
- 按页面顺序逐张发起下载。
- 页面显示 `已发起 3 / 9 张` 等进度。
- 防止重复点击启动多个相同批次。
- 用户可以取消尚未发起的下载。
- 浏览器可能要求允许多个文件下载，界面必须提前说明。
- 浏览器阻止多个下载时，不得报告“全部下载成功”。
- 被阻止后保留选中状态，并提供“重试下载”及单张下载入口。

由于浏览器不能可靠确认文件是否已写入用户磁盘，产品状态使用：

- 正在准备
- 已发起下载
- 下载被阻止
- 导出失败

不得使用无法证实的“已保存到本地”。

导出前验证：

- 最多18张。
- 单张最大32MB。
- 只允许 PNG、JPG、JPEG、WebP。
- 不输出 GIF 或 Live Photo。
- 默认分辨率不低于720×960。
- 支持宽高比0.75至2.0，即3:4至2:1。
- 内容溢出时阻止下载并定位问题页。
- 超过32MB时允许降低编码质量，但必须通知用户。
- 降低质量后仍超过限制时阻止对应图片下载。
- 一张图片失败不得阻止其他合法图片单独下载。

## 14. Prompt Store 与 API

共享 Prompt Store 代码只负责：

- 读取默认模板。
- 解析固定模块。
- 方案 CRUD。
- 原子写入。
- 导入导出。
- 当前方案选择。
- 类型与版本验证。

两种 Prompt 分别实例化：

```text
longformPromptStore
imageNotePromptStore
```

每个 Store 独立拥有：

- Default Path
- Local Data Path
- Prompt Type
- Module Definitions
- Editable Modules
- Protected Modules
- Selected ID
- Write Queue
- Export Prefix

不得使用一个 `selectedId` 同时控制两种 Prompt。

Prompt 管理 API：

```text
GET  /api/prompts/longform
POST /api/prompts/longform
GET  /api/prompts/image-note
POST /api/prompts/image-note
```

支持动作：

```text
save
select
delete
export
import
```

兼容要求：

- 原 `/api/prompts` 临时映射到长文 Prompt。
- 新前端只调用带类型的接口。
- 导出文件名由服务端返回。
- 一种 Prompt 加载失败不得影响另一种 Prompt 接口。

整稿生成：

```text
POST /api/generate
```

请求：

```json
{
  "noteType": "image-note",
  "input": "...",
  "sourceMode": "x-content"
}
```

兼容现有客户端：

- 缺少 `noteType` 时按 `longform` 处理。
- 未知 `noteType` 返回明确错误。

局部生成：

```text
POST /api/generate-section
```

支持组合：

| noteType | section |
|---|---|
| longform | title |
| longform | body |
| longform | description |
| longform | tags |
| image-note | title |
| image-note | images |
| image-note | description |
| image-note | tags |

服务端必须同时验证 `noteType` 和 `section`。

主题解析：

```text
POST /api/image-note/resolve-theme
```

请求只包含：

- 图文方案视觉模块快照。
- 当前画布技术约束。
- 已有 Theme Token，可选。

请求不得包含：

- 原始素材。
- 图片正文。
- 标题。
- 正文描述。
- 标签。

返回：

```json
{
  "themeTokens": {},
  "unsupportedRules": []
}
```

## 15. 历史、迁移与恢复

### 15.1 历史记录

所有新历史记录包含笔记类型和 Prompt 快照：

```json
{
  "noteType": "image-note",
  "promptSnapshot": {
    "type": "image-note",
    "id": "profile-id",
    "name": "商务简约",
    "updatedAt": "...",
    "modules": {}
  }
}
```

图文历史保存：

- 结构化页面内容。
- 标题。
- 正文描述。
- 标签。
- Prompt 快照。
- 已解析 Theme Token。
- 图片尺寸和格式设置。
- 当前版本。
- 正文描述和标签依赖状态。

历史记录不得保存：

- PNG、JPEG 或 WebP Base64。
- ZIP 文件。
- 下载缓存。
- 模型完整原始响应。

载入图文历史后，根据结构化内容和 Theme Token 重新渲染图片。

旧历史记录缺少 `noteType` 时按 `longform` 读取，不强制重写旧文件。

### 15.2 本地方案迁移

旧路径：

```text
Long-form-post-prompt.md
.local-data/prompts.json
```

新路径：

```text
prompts/longform/default.md
.local-data/prompts/longform.json
```

迁移要求：

1. 默认 Prompt 通过 Git 移动保留历史。
2. 首次读取长文方案时检查新路径。
3. 新文件不存在且旧文件存在时执行迁移。
4. 迁移前验证旧文件。
5. 使用临时文件和原子重命名写入新路径。
6. 保留方案 ID、名称、时间和当前选择。
7. 迁移成功后不再写旧文件。
8. 首版不主动删除旧文件。
9. 迁移必须幂等。
10. 失败时继续使用旧数据并返回明确提示。

图文方案从独立默认状态开始，不复制长文方案。

## 16. 错误、安全与恢复

必须覆盖：

- 一种 Prompt 加载失败时，另一种模式仍可使用。
- 默认 Prompt 缺少模块时阻止对应模式生成。
- 自定义方案损坏时保留原文件。
- 导入错误类型时说明目标分类。
- 模式切换时，旧请求不得写入新模式状态。
- 响应返回后核对 `noteType` 和工作流 ID。
- 图文生成失败不得影响长文草稿。
- 单张渲染失败不得清空其他页面。
- 批量下载失败时保留预览和选择状态。
- 图片内容重新生成后正确标记依赖过期。
- 主题解析失败时继续显示旧主题。
- Prompt 中的用户素材继续作为不可信数据注入。
- 原始素材、Prompt 输入正文和模型完整响应不得写入日志。
- Theme Token 必须经过白名单清洗，不能直接执行模型返回的样式代码。

## 17. 无障碍与交互要求

- 模式切换、Prompt 分类和模块标签使用正确语义。
- 所有图标按钮具有 `aria-label` 和悬停提示。
- 移动端操作目标至少44px。
- 缩略图显示当前项、选中项和键盘焦点。
- 图片多选不能只依赖颜色表达。
- 生成、渲染、压缩和下载状态通过可读文本通知。
- 方向键翻页不能拦截文本编辑器内的方向键。
- 尊重 `prefers-reduced-motion`。
- 删除方案继续使用二次确认。
- 浏览器多文件下载权限提醒必须可被辅助技术读取。
- 不得仅凭静态代码或截图声明无障碍合规。

## 18. 验收标准

功能完成必须同时满足：

1. 两份默认 Prompt 位于新目录且结构固定。
2. 两种自定义方案独立存储、独立选择。
3. 修改任一模式的 Prompt 不影响另一模式。
4. 旧长文方案和历史数据无损兼容。
5. 图文标题、图片、描述和标签全部由图文 Prompt 控制。
6. 标题、描述和标签在两种模式中使用一致交互。
7. 应用主题不改变任何内容。
8. 自由视觉 Prompt 只能解析为白名单 Theme Token。
9. 图片重新生成正确更新描述和标签依赖状态。
10. 最多18张及官方文件限制生效。
11. 预览和下载使用同一渲染组件。
12. 当前、选中和全部图片均可直接下载，不生成 ZIP。
13. 多文件下载被浏览器阻止时提供明确恢复路径。
14. 历史不保存成品图片或完整模型响应。
15. 载入历史后能够确定性恢复图文预览。
16. 长文固定输出协议和现有六步发布流程无回归。
17. 一种模式失败不得使另一种模式不可用。
18. 定向测试、完整测试、生产构建和静态差异检查通过。

浏览器交互、移动端布局、多文件下载权限、真实下载文件和人工视觉效果必须在实现后单独验收，不能由单元测试或构建结果替代。

# 附录 A：文件影响范围

## A.1 移动或新增

```text
prompts/longform/default.md
prompts/image-note/default.md
promptDefinitions.mjs
src/imageNoteGeneration.js
src/imageNoteSchema.js
src/imageNotePublish.js
src/imageNoteExport.js
src/ImageNoteWorkflow.jsx
src/ImageCardRenderer.jsx
src/styles/image-note.css
tests/imageNotePrompt.test.js
tests/imageNoteGeneration.test.js
tests/imageNoteExport.test.js
```

## A.2 必须修改

```text
promptStore.mjs
server.mjs
historyStore.mjs
scripts/dev.mjs
src/App.jsx
src/ApiSettingsDialog.jsx
src/PublishWorkflow.jsx
src/HistoryDialog.jsx
src/MarkdownPreview.jsx
src/prototypeDraft.js
src/sectionGeneration.js
src/styles.css
src/styles/settings.css
src/styles/publish-workflow.css
src/styles/responsive.css
tests/promptStore.test.js
tests/promptGeneration.test.js
tests/sectionGeneration.test.js
tests/historyStore.test.js
tests/workflowDraft.test.js
README.md
.codexrules
memory-bank/productContext.md
memory-bank/techContext.md
memory-bank/activeContext.md
memory-bank/progress.md
```

## A.3 保持长文职责，不混入图文逻辑

```text
src/xiaohongshuPublish.js
src/xiaohongshuText.js
src/markdownExport.js
```

这些文件原则上不修改，但必须执行现有长文回归测试。

## A.4 预计无需修改

```text
providers.mjs
.env.example
.gitignore
docs/development/validation.md
```

如果后续加入图片生成模型，`providers.mjs`、API设置、安全测试和 `.env.example` 必须另立需求，不包含在本 Spec 首版范围。

## A.5 文档一致性

实施时必须清除以下旧合同：

- 仓库根目录的 `Long-form-post-prompt.md` 权威路径。
- `.local-data/prompts.json` 作为唯一 Prompt Store 的表述。
- “图文标题、正文描述和标签复用长文内容规则”的表述。
- “产品不支持普通图文笔记”的旧定位。
- 下载 ZIP 或生成 `发布文案.txt` 的旧方案。

# 附录 B：测试矩阵

## B.1 Prompt Store

- 两种 Prompt 模块分别验证。
- 两个当前方案互不影响。
- 两种写队列互不阻塞。
- 错误类型导入被拒绝。
- 保护模块不能修改。
- 模块缺失、重复或乱序被拒绝。
- Schema 版本错误被拒绝。
- 导出文件名正确。
- 旧长文方案迁移成功且幂等。
- 迁移失败时旧方案仍可读取。

## B.2 整稿与局部生成

- 长文只使用长文 Prompt。
- 图文只使用图文 Prompt。
- 同名模块不得跨模式泄漏。
- 图文 JSON 输出解析正确。
- 不可信素材继续作为 JSON 字符串注入。
- 标题候选数量协议保持。
- 图片组重新生成只返回一组结构化图片内容。
- 描述和标签使用当前模式的独立模块。
- 未知 `noteType` 或非法 section 组合被拒绝。

## B.3 主题解析与渲染

- 主题解析请求不包含内容素材。
- 非白名单 Theme Token 被清理。
- 未支持视觉规则进入 `unsupportedRules`。
- 应用主题不改变标题、页数或图片文案。
- 相同 Theme Token 不重复渲染。
- 标题变化同步更新封面。
- 内容溢出能够定位具体页面。
- 预览与导出使用相同渲染数据。

## B.4 历史

- 旧记录按长文恢复。
- 图文记录恢复结构化页面。
- Prompt 删除后历史仍可使用快照恢复。
- 历史不包含图片 Base64。
- 历史不包含模型完整响应。
- 模式、版本和依赖状态正确恢复。
- 主题修改后仍能恢复历史主题。

## B.5 UI与下载

- 模式切换不丢失另一模式草稿。
- 旧模式响应不能覆盖新模式。
- 设置页两种 Prompt 分别 CRUD。
- 应用主题不调用内容生成。
- 图片重新生成使描述和标签过期。
- 视觉修改不会使描述和标签过期。
- 当前、选中和全部下载按页码顺序发起。
- 不创建 ZIP 或 `发布文案.txt`。
- 第18张允许，第19张被拒绝。
- 浏览器阻止多文件下载时显示恢复提示。
- 重试不会重复下载已经排除的页面。
- 长文现有六步流程保持不变。

## B.6 验证层级

代码完成后执行：

1. Prompt Store 定向测试。
2. 长文 Prompt 生成回归测试。
3. 图文 Prompt 与 JSON 合同测试。
4. 历史与迁移测试。
5. 图片渲染和导出测试。
6. 完整 `npm run check`。
7. `git diff --check`。
8. 浏览器交互验收。
9. 移动端布局验收。
10. 多文件下载权限验收。
11. 真实图片尺寸、格式、大小和清晰度验收。
12. 人工主题视觉一致性验收。

# 附录 C：实施阶段与发布顺序

## C.1 阶段一：长文 Prompt 无行为迁移

范围：

- 移动长文默认 Prompt。
- 参数化 Prompt Store。
- 迁移长文本地方案。
- 更新长文 Prompt API。
- 保持现有长文行为不变。

阶段验收：

- 旧方案无损迁移。
- 长文生成、局部生成、导入导出和历史全部通过。
- UI外观与长文流程没有行为变化。

## C.2 阶段二：独立图文 Prompt

范围：

- 新增图文默认 Prompt。
- 新增独立 Store 和 API。
- 设置页支持两种 Prompt。
- 增加类型和结构验证。

阶段验收：

- 两种 Prompt 完全隔离。
- 可以独立创建、选择、导入、导出和删除图文方案。
- 图文 Prompt 尚未接入生成时不得影响长文。

## C.3 阶段三：图文内容生成

范围：

- 增加图文 JSON 合同。
- 增加整稿与局部生成。
- 增加图片内容编辑。
- 增加依赖状态。
- 扩展历史结构。

阶段验收：

- 可生成标题、图片页、正文描述和标签。
- 可重新生成标题、图片组、描述和标签。
- 历史可以保存和恢复结构化图文内容。
- 尚未完成图片下载时不得把结构化预览报告为成品图片功能完成。

## C.4 阶段四：主题、预览与下载

范围：

- 增加主题解析。
- 增加 Theme Token 白名单。
- 增加图片渲染器。
- 增加小红书式预览。
- 增加当前、选中和全部直接下载。
- 增加官方文件限制检查。

阶段验收：

- 应用主题不改变内容。
- 预览与下载一致。
- 多文件下载权限和失败恢复可用。
- 真实导出文件通过尺寸、格式、大小和清晰度检查。

## C.5 阶段五：同步与完整验收

范围：

- 更新 README。
- 更新 `.codexrules`。
- 同步项目 Memory Bank。
- 执行完整自动验证。
- 执行浏览器、移动端、下载和人工视觉验收。

发布条件：

- 主 Spec 的18项验收标准全部满足。
- 不存在已知数据迁移风险。
- 不存在长文回归。
- 未验证项目被明确列出，不能包装为已通过。
