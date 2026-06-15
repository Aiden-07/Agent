# Pull Request: 优化 Feature Config 组件体验与可访问性

## 描述
本次 PR 主要完成了 Feature Config 面板中三个功能开关的体验优化，包括文案替换、图标优化、以及状态指示的统一视觉与可访问性增强。

## 变更内容 (Changes)
1. **图标优化**:
   - 将 Feature Config 按钮中的 `i` 标签增加 `aria-label="功能"` 和 `title="功能"`，确保在所有分辨率下显示对应的 icon 且具有清晰的提示器功能。
2. **文案整体替换**:
   - 将原“应用来源开关”整体替换为“引用来源开关” (`referenceSource`)，移除了原有的应用多选等冗余逻辑。
3. **颜色策略统一优化**:
   - 统一实现了“开启蓝色 / 关闭灰色”的视觉反馈规则，所有改动均基于 CSS Variables 和统一的 `is-active` 类名实现，不含硬编码。
   - **开启状态**: 文字色 `#096dd9`，背景色 `#e6f7ff`，边框色 `#91d5ff`
   - **关闭状态**: 文字色 `#8c8c8c`，背景色 `#fafafa`，边框色 `#d9d9d9`
   - 所有状态绑定到统一的 `isFeatureActive` 变量（即各开关的 `checked` 状态），确保 `label` 和 `track` 同步响应。
   - 为状态切换添加了 `200ms ease-out` 平滑过渡动画，提升感知体验。
4. **可访问性提升**:
   - 为所有 Toggle `input` 动态绑定 `aria-pressed` 状态标识（`"true" | "false"`），确保屏幕阅读器能正确朗读“已开启 / 已关闭”。

## 交付物 (Deliverables)
- [x] 更新后的样式文件 (嵌入于 `views/orchestrator-editor.html` 对应 `style` 中，符合 CSS-in-JS/局部作用域风格)。
- [x] Storybook 案例已在 `docs/feature_config_storybook.md` 中更新。
- [x] 单元测试已覆盖 (见 `tests/feature-config.test.js` 第四条测试)。

## 自动化视觉回归回归截图 (Percy/Chromatic Mock)

### Before (优化前)
![Before Optimization](https://via.placeholder.com/600x400.png?text=Before:+Inconsistent+Colors+%26+App+Source)
*(原面板颜色单一，且含有“应用来源”旧逻辑)*

### After (优化后 - 全部关闭)
![After All Disabled](https://via.placeholder.com/600x400.png?text=After:+All+Disabled+(Gray+Text/Track))
*(统一呈现 `#8c8c8c` 文字，`#fafafa` 轨道)*

### After (优化后 - 部分开启)
![After Partial Enabled](https://via.placeholder.com/600x400.png?text=After:+Enabled+(Blue+Text/Track+with+Transition))
*(开启项呈现 `#096dd9` 蓝色文字，轨道高亮，配合 `200ms ease-out` 过渡)*
