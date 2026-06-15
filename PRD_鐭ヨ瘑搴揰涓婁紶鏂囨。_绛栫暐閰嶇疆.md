# PRD（仅功能需求）：新建知识库 / 上传文档 / 策略配置

版本：v1.1  
范围：新建知识库（div）、上传文档（button）、策略配置（div）  

---

## 1. 新建知识库（div：`#kb-create-page`）

### 1.1 Step1：基础信息 + 检索设置

#### ● 知识库名称（`#create-kb-name`）
- 规则
  - 必填；长度 1~50
  - 超过长度截断或提示（推荐：提示并阻止下一步）
  - 为空时：显示 `#create-kb-name-error`，阻止进入下一步

#### ● 知识库描述（`#create-kb-desc`）
- 规则
  - 必填；长度 1~200
  - 为空时：显示 `#create-kb-desc-error`，阻止进入下一步

#### ● Embedding 模型（`#create-kb-parser`）
- 规则
  - 必填（必须有选中值，若 UI 有默认值则视为已满足）

#### ● 新增“检索设置”（容器：`#create-kb-retrieval-config`）
需要支持以下可配置项，并在点击“下一步”前完成校验。

##### 1）Rerank 模型（下拉选择）
- 规则
  - 必填：必须选择一个具体模型（例如：`rerank-1`/`rerank-2`），不提供“不启用”选项
  - 在“初步检索 TopK +（可选）相似度阈值过滤”之后，对候选进行重排，最终排序以 Rerank 结果为准

##### 2）权重设置（`w`，建议范围 0~1，步进 0.1）
- 语义
  - `w = 0`：仅关键字检索（Keyword/BM25 等稀疏检索）
  - `w = 1`：仅向量检索（Vector/Dense Retrieval）
  - `0 < w < 1`：关键字检索 + 向量检索的混合检索（Hybrid Retrieval）

- 推荐融合公式（研发实现建议）
  - **前置条件**：keywordScore / vectorScore 需归一化到同一量纲（例如 0~1）
  - `hybridScore = (1 - w) * keywordScore + w * vectorScore`
  - 若启用 Rerank：用 Rerank 对候选重排（可理解为“排序阶段以 rerankScore 为准”），hybridScore 仅用于召回与入围

- 区间解释（便于产品/测试理解）
  - `w ∈ [0, 0.3]`：**偏向关键字检索**（更依赖关键词命中）
  - `w ∈ (0.3, 0.7]`：**融合模式**（关键字 + 向量均参与）
  - `w ∈ (0.7, 1]`：**偏向向量检索**（更依赖语义相似）

- 举例
  - `w = 0`：仅关键字检索（不使用向量相似度）
  - `w = 0.3`：`hybridScore = 0.7*keywordScore + 0.3*vectorScore`（关键字主导）
  - `w = 0.5`：`hybridScore = 0.5*keywordScore + 0.5*vectorScore`（均衡）
  - `w = 0.9`：`hybridScore = 0.1*keywordScore + 0.9*vectorScore`（向量主导）

##### 3）初步检索 Tok / TopK（候选数量）
> 说明：你提到“Tok”，此处按“候选数量”定义（也可直接命名为 TopK）。
- 规则
  - 必填，整数
  - 推荐范围：`10 ~ 500`
  - 含义：初步检索阶段（关键字/向量/混合）先召回 TopK 条候选，再进入（可选）相似度阈值过滤与最终排序（Rerank 或 hybridScore）

##### 4）相似度阈值（Similarity Threshold）
- 规则
  - 取值范围：`0 ~ 1`（或与你们向量库一致的范围）
  - 当阈值 > 0：
    - 若 `w = 0`（仅关键字）：**忽略该阈值**（或视为 0）
    - 若 `w > 0`：过滤掉 `vectorScore < threshold` 的候选（keyword-only 候选若无 vectorScore，默认视为 0 并被过滤）
    - 过滤后进入最终排序（Rerank 或 hybridScore）与 TopN 截断
  - 当阈值 = 0：不做阈值过滤（全量候选进入下一步）

##### 5）最终召回 TopN
- 规则
  - 必填，整数
  - 约束：`1 <= TopN <= TopK`
  - 含义：最终返回给问答/检索模块的条数
  - 若经过阈值过滤后不足 TopN：返回实际剩余条数（不补齐）

##### 6）校验汇总（点击下一步）
- 若任一项非法：toast 提示具体原因并阻止下一步（示例：`相似度阈值需在 0~1`、`TopN 不能大于 TopK`）
- 推荐默认值（便于首屏可用）
  - Rerank：默认选中第一个可用模型（例如：`rerank-1`）
  - w=1
  - TopK=50
  - threshold=0
  - TopN=10

### 1.2 Step2：上传文件

#### ● 上传入口（`#create-kb-upload-dropzone` + `#create-kb-upload-input`）
- 规则
  - 支持点击选择 + 拖拽上传
  - 支持多文件上传
  - 最大文件数量：20（前端拦截 + 后端兜底）

#### ● 支持文件格式（与数据类型卡片一致）
- 文本文档数据：`.doc、.docx、.ppt、.pptx、.md、.txt、.pdf`
- 表格数据：`.xlsx、.xls`
- 图片数据：`.png、.jpg、.jpeg、.bmp`

#### ● 上传校验规则
- 超过 20 个：提示“最多上传 20 个文件”，超出部分不加入列表
- 不支持格式：提示“不支持的文件格式：xxx”，该文件不加入列表
- （建议）单文件大小限制：例如 50MB；超限提示并拒绝加入列表

### 1.3 Step3：索引设置

#### ● 切片设置（示例：通用切片）
- 分段标识符：可为空
  - 为空含义：按“最大长度”强制切分
- 分段最大长度：100~4000（步进 100）
- 切片重叠长度：0~500（步进 50），且必须 `<= 分段最大长度`

#### ● 预处理（复选框）
- 替换连续空格/换行/制表符：默认开启
- 删除 URL/邮箱：默认关闭
- 关联文件名：默认开启
- 关联标题及子标题：默认关闭
- 按照层级切片：默认关闭

#### ● 知识增强（旧 Step3）
- 基于切块生成问题/摘要/关键字：可选

---

## 2. 上传文档（button：`#btn-upload-doc` → `openDocUploadWizard()`）

### 2.1 打开/关闭规则
- 点击按钮打开向导 modal：`#doc-upload-wizard`
- 关闭方式
  - ESC 关闭
  - 点击遮罩关闭
  - 浏览器返回键关闭（打开时写入 history state：`__modal='doc-upload-wizard'`）
- 关闭后恢复
  - body overflow 状态恢复
  - 恢复打开前滚动位置与焦点（snapshot restore）

### 2.2 向导步骤（2 步）

#### ● Step1：选择/上传文件
- 规则
  - 文件数量/格式限制与“新建知识库 Step2”一致

#### ● Step2：设置文档处理策略（切片模式等）
- 规则
  - 默认切片模式：`length`
  - 用户切换模式后应触发实时预览/校验（若有）

### 2.3 完成规则
- Step1 点击“下一步”进入 Step2
- Step2 点击“完成”：
  - 关闭向导
  - toast：`文档上传完成`

---

## 3. 策略配置（div：`views/strategy-config.html`）

### 3.1 数据类型卡片（text/table/image）

#### ● 文本文档数据（text）
- 规则
  - 支持文件格式文案展示：`.doc、.docx、.ppt、.pptx、.md、.txt、.pdf`
  - 文案不主动换行，仅超过卡片宽度自动换行

#### ● 表格数据（table）
- 规则
  - 支持文件格式文案展示：`.xlsx、.xls`

#### ● 图片数据（image）
- 规则
  - 支持文件格式文案展示：`.png、.jpg、.jpeg、.bmp`

### 3.2 文件处理策略配置

#### ● 切片策略（chunking）
- 规则
  - 当页面存在切片策略选项时必须选择，否则保存提示“请选择切片策略”
  - 切片策略提示 info 浮窗（hover）必须可见且不被裁剪

#### ● 知识增强（enhancement）
- 规则
  - 仅展示母标题选项（不展开子选项）
  - 每个标题后有 info 图标，hover 显示浮窗（fixed 全局 tooltip，避免 overflow-hidden 裁剪）
  - 当前增强项：问题生成、关键字生成、摘要生成

### 3.3 模板：保存/修改/同步/删除

#### ● 保存为自定义模板
- 规则
  - 模板名：1~50 字符
  - 禁止特殊字符：`[!@#$%^&*(),.?":{}|<>]`
  - 保存后模板加入列表首位并刷新

#### ● 进入“模板修改页面”（编辑配置）
- 规则
  - 设置 `currentEditingTemplateId = 模板id`
  - 隐藏策略配置页底部“确认（saveStrategyConfig）”按钮，仅保留模板修改流程按钮

#### ● 保存模板修改：同步策略（二选一）

##### A. 自动同步模式（auto）
- 规则
  - 不新建模板
  - 覆盖更新原模板 config（模板名不变）
  - 影响文件数仅统计绑定该模板的文件数（不改 doc 中绑定名）

##### B. 选择性同步模式（selective）
- 规则
  - 触发自动新建模板版本（原名 + `1.0/2.0/3.0...`）
    - baseName = 原模板名去掉末尾 `N.0`（若存在）
    - nextVer = 同 baseName 的 `N.0` 最大值 + 1
    - newName = `${baseName} ${nextVer}.0`
  - 仅对用户勾选的文件切换绑定名到 newName
    - `doc.parserName == oldTemplate.name` → `doc.parserName = newName`
    - `doc.sliceSettingName == oldTemplate.name` → `doc.sliceSettingName = newName`

#### ● 删除模板（二次确认弹窗）
- 规则
  - 使用自定义弹窗，不使用系统 confirm
  - 提示文案中“索引将被统一移除”高亮
  - 展示绑定该模板文件列表（若无真实绑定，展示默认示例条目，标签统一显示“绑定”）
  - 确认删除后：
    - 删除模板
    - 解绑文件：`parserName/sliceSettingName` 置为 `未设置`
    - toast 提示已移除的绑定索引数量
