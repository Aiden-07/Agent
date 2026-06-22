# Codex 修改记录

> 用途：记录本地原型每次由 Codex 做过的修改，方便后续在其他窗口或其他 AI 工具里快速了解上下文。
> 规则：后续每次修改代码或原型文件后，都在这里追加一条记录，包含时间、需求、修改文件、关键说明、验证情况。

## 2026-06-03

### 工作流知识库过滤条件操作符联动

- 需求：知识库过滤条件里，字段仍然是实际字段；操作符需要根据字段背后的字段类型联动，而不是把字段下拉直接改成“文本/数字/日期”等字段类型字样。
- 修改文件：
  - `Agent_应用/Agent_搴旂敤/js/orchestrator-editor.js`
  - `Agent_应用/Agent_搴旂敤/index.html`
- 关键说明：
  - 保留真实字段下拉，例如标题、类型、创建人、创建时间、状态、职责、职级。
  - 按字段类型限制操作符：
    - 文本/多行文本：等于、不等于、包含。
    - 数字：等于、大于、小于、介于。
    - 日期：等于、早于、晚于、介于、最近N天。
    - 单选：等于、属于任一。
    - 多选：包含任一。
  - `类型`、`状态` 暂按单选字段处理；`职级` 按数字字段处理；`创建时间` 按日期字段处理。
  - 兼容旧操作符：日期旧的 `lt/gt` 会归一为 `before/after`。
  - `orchestrator-editor.js` 版本号更新到 `v=1.2.4`。
- 验证情况：按用户要求未进行浏览器验证。

### 流程约定

- 需求：后续每次修改都要记录下来，便于其他窗口了解上下文。
- 处理：新增本文件 `Codex修改记录.md`，后续修改完成后持续追加记录。

### 知识库过滤条件值输入框变量选择模拟交互

- 需求：用户指的是过滤条件卡片中值输入框底部的“输入 / 插入变量”区域，需要点击后模拟展示可插入的前置变量/上游输出变量。
- 修改文件：
  - `Agent_应用/Agent_搴旂敤/views/orchestrator-editor.html`
  - `Agent_应用/Agent_搴旂敤/js/orchestrator-editor.js`
  - `Agent_应用/Agent_搴旂敤/index.html`
- 关键说明：
  - 撤回了误加到画布底部的状态栏模拟交互，保留原有“测试”按钮静态表现。
  - 在知识库过滤条件值输入框下方，将“插入变量”改为“插入前置变量”交互入口。
  - 点击后展示分组变量菜单：
    - 开始输入：`{{start.query}}`、`{{start.userId}}`、`{{start.sessionId}}`
    - 知识库1输出：`{{knowledge1.chunk_list}}`、`{{knowledge1.chunk_list[0].doc_name}}`、`{{knowledge1.chunk_list[0].score}}`
    - 大模型1输出：`{{llm1.answer}}`、`{{llm1.reasoning}}`
    - 系统变量：`{{user.department}}`、`{{user.rank}}`
  - 点击变量后会插入到当前条件值 textarea。
  - `orchestrator-editor.js` 版本号更新到 `v=1.2.5`。
- 验证情况：按用户此前要求未进行浏览器验证。

### 撤回过滤条件前置变量弹层

- 需求：退回上一步，过滤条件值输入框保持没有“前置变量”模拟弹层的样子。
- 修改文件：
  - `Agent_应用/Agent_搴旂敤/js/orchestrator-editor.js`
  - `Agent_应用/Agent_搴旂敤/index.html`
- 关键说明：
  - 撤回“插入前置变量”的分组变量选择器。
  - 恢复为普通的“输入 / 插入变量”样式。
  - 变量列表恢复为简单工作流变量：`{{start.query}}`、`{{start.userId}}`、`{{user.department}}`、`{{user.rank}}`。
  - `orchestrator-editor.js` 版本号更新到 `v=1.2.6`。
- 验证情况：按用户此前要求未进行浏览器验证。

### 知识库设置与工作流知识库节点数据打通

- 需求：知识库设置页配置的知识库，需要在工作流编辑的知识库节点中读取到；并且知识库设置里的文档自定义字段，需要同步到知识库节点过滤条件字段中。
- 修改文件：
  - `Agent_应用/Agent_搴旂敤/js/utils.js`
  - `Agent_应用/Agent_搴旂敤/js/knowledge.js`
  - `Agent_应用/Agent_搴旂敤/js/knowledge-settings.js`
  - `Agent_应用/Agent_搴旂敤/js/orchestrator-editor.js`
  - `Agent_应用/Agent_搴旂敤/index.html`
- 关键说明：
  - 新增共享本地知识库存储 `vagent_knowledge_bases_v1`，统一给知识库列表、知识库设置页、工作流知识库节点使用。
  - 复用并标准化文档字段存储 `kb_doc_field_settings_v1_${知识库ID}`，工作流过滤字段直接从该知识库字段设置读取。
  - 知识库列表页首次生成 mock 知识库后会写入共享存储；新建/删除知识库也会同步共享存储。
  - 知识库设置页保存时会保存名称、描述、标签、Embedding 模型、检索参数，并避免旧保存逻辑引用不存在的 Prompt 控件导致报错。
  - 工作流知识库节点的「选择知识库」读取共享知识库；过滤条件字段按当前知识库字段动态展示，操作符按字段类型联动。
  - 新增 `knowledge-bases-updated`、`knowledge-fields-updated` 事件联动，已打开的知识库节点可刷新知识库/字段变化。
  - 静态资源版本号更新：`utils.js?v=1.0.3`、`knowledge.js?v=1.4.7`、`knowledge-settings.js?v=1.1.9`、`orchestrator-editor.js?v=1.2.7`。
- 验证情况：已通过 `node --check` 语法检查；未进行浏览器交互验证。
