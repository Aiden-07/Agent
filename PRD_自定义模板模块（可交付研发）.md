# PRD（功能需求）：自定义模板模块（可交付研发）

版本：v1.0  
范围：策略配置页中的“自定义模板”相关能力（保存为模板、编辑模板名称、编辑模板配置、保存模板修改（同步策略）、删除模板）  
对应页面/区域：`策略配置（模板）`、`模板列表`、`保存模板修改弹窗`  

---

## 1. 模块目标

1) 将当前策略配置保存为“自定义模板”，用于复用。  
2) 支持模板名称的就地编辑。  
3) 支持模板配置编辑，并在保存时按同步策略更新绑定文件。  
4) 支持模板删除，并明确告知解绑/移除索引影响。  

---

## 2. 数据结构与绑定关系（研发必须遵循）

### 2.1 模板数据结构（前端存储形态）
模板存储在：`window.TEMPLATE_DATA.custom[]`  
每个模板包含（字段可扩展，但以下字段必须有）：
- `id`：字符串（唯一）
- `name`：字符串（展示名称，唯一性建议：同一列表内不强制唯一，但版本化会生成不同 name）
- `icon`：图标类名（默认 `fa-file-lines`）
- `config`：对象（模板策略配置）
- `history`：数组（可选；用于记录版本变更/覆盖更新的历史）

### 2.2 文件（文档）与模板的绑定字段
文档列表数据存储在：
- `window.KNOWLEDGE_DOCS`（优先）或
- `mockDocs`（演示/回退）

绑定规则：
- 文档通过“模板名称”进行绑定（注意：不是模板 id）
  - `doc.parserName === template.name` 视为绑定
  - `doc.sliceSettingName === template.name` 视为绑定

解绑规则：
- 删除模板后，所有绑定该模板名的文档：
  - `parserName` / `sliceSettingName` 置为 `未设置`

---

## 3. 功能 1：确认并保存至模板（按钮：`#btn-save-as-template`）

### 3.1 入口与交互
- 点击按钮 `确认并保存至模版`（`#btn-save-as-template`）调用：`window.openSaveTemplateModal()`
- 弹窗内容：
  - 模板名称输入框
  - 取消 / 确认保存按钮

### 3.2 保存规则
- 模板名称校验：
  - 长度：1~50
  - 禁止特殊字符：`[!@#$%^&*(),.?":{}|<>]`
  - 为空/非法时：阻止保存并提示（toast 或输入框错误态均可）
- 保存成功：
  - 生成新模板对象并 `unshift` 到 `window.TEMPLATE_DATA.custom` 首位
  - `template.config` 取当前策略配置快照（见 3.3）
  - 刷新模板列表（`renderTemplateColumns()`）
  - toast：`保存成功`

### 3.3 当前策略配置快照（必须包含）
保存为模板时，至少需要保存以下配置（示例字段名，可按现有实现落地，但必须等价）：
- 数据类型：text/table/image
- 解析策略：OCR/表头设置/图片解析方式等
- 切片策略：自定义/按章节/按页/整文件（含参数：最大长度、重叠长度、标题级数等）
- 知识增强：问题生成/关键字/摘要（含开关状态）

---

## 4. 功能 2：编辑模板名称（按钮：`#btn-edit-{templateId}`）

### 4.1 入口
- 模板卡片 hover 操作区：点击“编辑名称”按钮（示例：`#btn-edit-c177...`）调用：`toggleEditTemplate(templateId, prefix)`

### 4.2 编辑规则
- 进入编辑态：
  - 名称显示区切换为输入框
  - 输入框初始值为原模板名
  - 提供“保存/取消”（或回车保存、ESC 取消）
- 保存校验与保存规则：
  - 名称校验与 3.2 一致（长度、特殊字符）
  - 保存成功后：
    - 更新 `window.TEMPLATE_DATA.custom` 中对应模板的 `name`
    - **重要：同时更新绑定文档**
      - 若 `doc.parserName === oldName` → 更新为 `newName`
      - 若 `doc.sliceSettingName === oldName` → 更新为 `newName`
    - 刷新模板列表与文档列表

### 4.3 边界规则
- 名称未变化：直接退出编辑态，不触发刷新也可（建议仍刷新一次以确保 UI 一致）

---

## 5. 功能 3：编辑模板配置（按钮：模板卡片“编辑配置”）

### 5.1 入口
- 模板卡片 hover 操作区：点击“编辑配置”按钮调用：`window.editTemplateConfig(templateId, prefix)`

### 5.2 进入模板编辑模式的状态规则（必须）
- 设置全局状态：`window.currentEditingTemplateId = templateId`
- 页面切换到策略配置区域，并回填模板 config 到表单（解析/切片/增强等）
- 隐藏普通策略保存按钮：
  - 隐藏策略配置页底部“确认（saveStrategyConfig）”按钮（避免与模板保存冲突）
  - 保留“保存模板修改”按钮（进入同步弹窗）

### 5.3 退出模板编辑模式
当“保存模板修改”流程完成或取消退出时：
- `window.currentEditingTemplateId = null`
- 恢复普通策略保存按钮的显示状态

---

## 6. 功能 4：保存模板修改（弹窗 div：同步策略 + 受影响文件列表）

> 对应弹窗包含：参数变更预览（`#template-diff-container`）、同步更新策略（radio）、受影响文件列表（`#affected-files-section`）

### 6.1 入口
模板编辑模式下，点击“保存模板修改”按钮 → 打开“保存模板修改弹窗”

### 6.2 参数变更预览（div：`#template-diff-container`）
- 规则：
  - 对比“原模板 config”与“当前编辑态 config”
  - 若无变化：显示 `未检测到任何参数修改。`
  - 若有变化：用可读方式展示变更（字段级）
    - 示例：`切片策略：自定义 → 按章节`
    - 示例：`最大长度：1024 → 1500`

### 6.3 同步更新策略（radio）
提供两种模式（互斥）：
1) 自动同步模式：`input[name="syncStrategy"][value="auto"]`
2) 选择性同步模式：`input[name="syncStrategy"][value="selective"]`

切换逻辑：
- 选择性同步 → 显示“受影响文件列表区域”（`#affected-files-section`）
- 自动同步 → 隐藏“受影响文件列表区域”

### 6.4 自动同步模式（auto）规则（不生成新模板）
当用户选择“自动同步模式”并确认保存：
- 不新建模板版本
- 直接覆盖更新原模板：
  - `template.config = newConfig`
  - 追加 `template.history` 记录（oldConfig/newConfig/timestamp）
- 同步范围：
  - 所有绑定该模板名的文件都视为“已同步更新”
  - **不需要修改 doc 的绑定名**（模板名不变）
- toast：
  - `保存成功，已同步更新 X 个文件`

### 6.5 选择性同步模式（selective）规则（生成新模板版本）
当用户选择“选择性同步模式”并确认保存：

#### 6.5.1 版本化命名规则（必须）
- baseName = 原模板名去掉末尾版本后缀（形如：`空格 + 整数 + .0`）
- nextVer = 当前自定义模板列表中同 baseName 的最大版本号 + 1
- newName = `${baseName} ${nextVer}.0`

示例：
- 原模板：`销售话术` → 新模板：`销售话术 1.0`
- 原模板：`销售话术 2.0` → 新模板：`销售话术 3.0`

#### 6.5.2 生成新模板规则（必须）
- 创建新模板：
  - `id = 'c' + Date.now()`（或同等唯一规则）
  - `name = newName`
  - `config = newConfig`
  - `history[0]` 记录 baseTemplateId/baseTemplateName/oldConfig/newConfig/timestamp
- 插入模板列表首位（`unshift`）

#### 6.5.3 选择文件同步规则（必须）
受影响文件列表中：
- 每行有 checkbox（`.sync-file-cb`）
- “全选”复选框（`#sync-select-all`）：
  - 勾选 → 勾选所有 `.sync-file-cb`
  - 取消 → 取消所有 `.sync-file-cb`

点击确认保存后，只对“勾选的文件”执行绑定切换：
- 若 `doc.parserName === oldTemplate.name` → `doc.parserName = newName`
- 若 `doc.sliceSettingName === oldTemplate.name` → `doc.sliceSettingName = newName`

toast：
- `已生成新模板「${newName}」，并同步更新 X 个文件`

---

## 7. 功能 5：删除模板（按钮：模板卡片“删除模板”）

### 7.1 入口
点击模板卡片 hover 操作区“删除模板” → `window.handleDeleteTemplate(templateId)`

### 7.2 二次确认弹窗（必须为自定义弹窗）
弹窗文案必须为：
> `确定要删除该模板吗？此操作无法撤销，删除后绑定该模板的文件索引将被统一移除，请谨慎操作。`

其中 **“索引将被统一移除”** 必须高亮显示（红色/浅红底）。

弹窗必须展示：
- 模板名称
- 绑定文件列表（若无真实绑定，展示默认示例 3 条；标签统一显示“绑定”）

### 7.3 删除后的解绑规则（必须）
确认删除后：
1) 从 `window.TEMPLATE_DATA.custom` 移除该模板  
2) 遍历所有文档：
   - `parserName === template.name` → 置为 `未设置`
   - `sliceSettingName === template.name` → 置为 `未设置`
3) 刷新模板列表与文档列表
4) toast：`模板删除成功，已移除 X 条绑定索引`

---

## 8. 验收标准（测试可直接照此验证）

1) 点击“确认并保存至模版”可创建新模板；名称非法会拦截并提示。  
2) 模板名称编辑保存后，模板列表显示更新，且原绑定文档的模板名同步更新。  
3) 模板编辑配置后打开“保存模板修改弹窗”，能看到参数变更预览。  
4) 自动同步模式：不创建新模板；原模板被覆盖更新；提示同步文件数。  
5) 选择性同步模式：必须创建新模板 `baseName N.0`；仅勾选文件绑定名切换到新模板名。  
6) 删除模板弹窗文案正确且高亮；展示绑定文件列表；删除后模板消失且文档解绑为“未设置”。  

