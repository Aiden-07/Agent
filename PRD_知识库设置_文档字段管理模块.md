# PRD：知识库设置 - 文档字段管理模块（精简版）

版本：v1.1（精简）  
页面：知识库「设置/编辑」页 → 文档字段表格区（`#kb-doc-fields-body`）  

---

## 1. 目标与范围

### 目标
在知识库编辑页提供“文档字段”最小可用管理能力，满足字段展示与基础维护。

### 范围（本期保留）
1. 字段按分组展示（仅 **系统分组 sys**、**未分组 g0** 两组）
2. 非系统字段支持拖拽排序、拖拽到分组（sys 禁止作为目标）
3. 非系统字段支持“是否必填”开关
4. 非系统字段支持编辑、删除
5. 配置持久化（LocalStorage，按 kbId 隔离）

### 范围（本期不做）
- 自定义分组的新增/重命名/删除（不提供分组管理弹窗）
- 字段新增（如果页面已有入口可保留，但不在本 PRD 范围内描述）

---

## 2. 关键规则（不能改）

### 系统字段（`system=true`）
- 固定属于 `sys` 分组
- 固定必填（`required=true`）
- 不可拖拽（`draggable=false`）
- 不可编辑/删除
- 必填开关禁用

### 未分组（`g0`）
- 作为默认容器：所有非系统字段的兜底分组
- 允许接收拖拽字段

---

## 3. UI 与交互

### 3.1 表格结构
表头固定为：
- 字段名 / 类型 / 是否必填 / 操作

行类型：
1) 分组头行（Group Header）
- 标识：`tr[data-group-header="true"][data-group-id="{groupId}"]`
- 展示：分组名 + 数量
- 右侧提示：
  - sys：`系统字段固定不可移动`
  - g0：`可拖拽字段到此分组`

2) 字段行（Field Row）
- 标识：`tr[data-field-id="{fieldId}"][data-group-id="{groupId}"]`
- 拖拽抓手图标仅作视觉提示（`fa-grip-vertical`）
- `draggable = !field.system`

### 3.2 必填开关
开关元素：
- `button[role="switch"][aria-checked="true/false"]`

规则：
- 系统字段：disabled + 置灰
- 非系统字段：点击触发 `toggleDocFieldRequired(fieldId)`

### 3.3 操作列
- 非系统字段：
  - 编辑：`openEditDocFieldModalById(fieldId)`
  - 删除：`deleteDocFieldById(fieldId)`
- 系统字段：显示 `不可编辑`

---

## 4. 数据结构与持久化

### 4.1 数据结构
字段（DocField）最小字段集：
```ts
type DocField = {
  id: string
  name: string
  type: string
  system: boolean
  required: boolean
  groupId: 'sys' | 'g0'
  order: number // 分组内排序
}
```

分组（Group）固定两条：
```ts
[{ id:'sys', name:'系统分组', fixed:true, order:0 },
 { id:'g0',  name:'未分组',   fixed:true, order:1 }]
```

### 4.2 LocalStorage
- Key：`kb_doc_field_settings_v1_{kbId}`
- Value：
```json
{ "groups":[...], "fields":[...] }
```

---

## 5. 核心逻辑（必须保留）

### 5.1 规范化（normalize）
每次渲染前必须执行：
1) 确保分组存在 sys/g0（缺失则补齐）
2) 字段兜底：
   - 缺 id/name/type/system/required/groupId/order 时补默认
3) 强制规则：
   - system=true → groupId='sys' 且 required=true
   - 非系统字段 groupId 非法或为 sys → 归入 g0
4) order 归一：
   - 同 group 内按 order 排序后重排为 0..n-1

### 5.2 渲染（renderDocFields）
按分组顺序渲染：
- 先插入分组头行
- 再按 order 插入该组字段行
- 每次渲染后绑定一次 DnD（仅绑定一次，避免重复）

### 5.3 必填切换（toggleDocFieldRequired）
输入：fieldId
1) 找到字段；system=true 直接 return
2) required 取反
3) persist → render

### 5.4 拖拽排序/分组（DnD）
事件绑定容器：`#kb-doc-fields-body`

#### 落点规则
1) drop 到分组头行：
- 移动到该分组末尾（`order=999999` 后 normalize）
- 若目标 groupId==='sys'：禁止（return）

2) drop 到字段行：
- 根据鼠标落点在目标行上半/下半决定插入前/后
- 若目标字段属于 sys 分组：禁止（return）

每次 drop 成功后：
- persist → render

### 5.5 删除字段（deleteDocFieldById）
输入：fieldId
- system=true 禁止
- 二次确认：`确定要删除字段 "{name}" 吗？`
- 确认后：删除 → normalize → persist → render

---

## 6. 验收标准

1) 系统分组与未分组正常展示，数量统计正确  
2) 系统字段：不可拖拽、不可编辑/删除、必填开关不可点  
3) 非系统字段：可拖拽排序；可拖拽到“未分组”头行（移动到末尾）  
4) 非系统字段：必填开关可切换且刷新后保持（LocalStorage 生效）  
5) 删除字段：弹确认，确认后字段消失且计数更新  

