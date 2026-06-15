# 切片设置页“取消/保存”按钮交付报告

## 1. 位置与布局（CSS 参数）
- 容器位置：`#batch-slice-settings-page` 内部底部固定区域（非浮层），紧跟设置内容滚动区之后。
- 容器结构：
  - 外层：`div.px-6.py-4.border-t.border-gray-100.bg-gray-50`
  - 对齐：`div.flex.justify-end`
  - 按钮排布：`div.flex.items-center.justify-end.flex-nowrap` + `style="gap: 8px 16px;"`
- 关键布局参数：
  - 水平间距：`gap` 的列间距 16px
  - 垂直间距：`gap` 的行间距 8px（当前为单行显示）
  - 与最近内容的最小间距：由上方内容区 `px-6 py-6` + 本区 `py-4` + `border-t` 保障（px+）

## 2. 坐标/尺寸测量（运行脚本输出）
来源：`node scripts/measure_slice_settings_buttons.js`

### 390×844 视口
- 取消：`top=757, left=195, width=62, height=38`
- 保存：`top=758, left=273, width=60, height=36`
- 计算间距：水平 `16px`，垂直 `0px`

### 320×700 视口
- 取消：`top=671, left=175, width=62, height=38`
- 保存：`top=672, left=253, width=60, height=36`
- 计算间距：水平 `16px`，垂直 `0px`

## 3. 间距截图（自动生成）
Playwright 在执行 `npm run test:e2e` 时生成：

- 390px 视口（示例：Chromium）
  - `test-results/slice-settings-actions-切片设置页“取消-保存”按钮可见与间距-chromium/slice-settings-actions-390.png`
- 320px 视口（示例：Chromium）
  - `test-results/slice-settings-actions-切片设置页按钮在-320px-宽度下不遮挡关键内容-chromium/slice-settings-actions-320.png`

（WebKit / Firefox / 移动项目同目录下也生成对应截图。）

## 4. 键盘/无障碍走查
- Tab 顺序：新增按钮设置 `tabindex="-1"`，不会进入既有 Tab 导航序列（不改变现有焦点管理）。
- 焦点指示器：按钮保留 `focus-visible:ring-*` 样式，但由于不参与 Tab 顺序，不影响现有焦点指示。
- ARIA：
  - 取消：`aria-label="取消"`
  - 保存：`aria-label="保存"`

## 5. 跨浏览器与移动端视觉回归
- 执行命令：`npm run test:e2e`
- 覆盖项目：
  - 桌面：`chromium`（Chrome/Edge 同内核）、`firefox`、`webkit`（Safari 内核）
  - 移动：`webkit-iphone`（iOS Safari 近似）、`chromium-android`（Android Chrome 近似）
- 结果：测试通过（移动端跳过 ESC/Tab 顺序用例）。

