# Feature Config 组件 Storybook 文档

## 1. 组件概述 (Overview)
`FeatureConfig` 是一个用于管理高级功能开关和配置的下拉面板组件，主要应用于编排器或智能体编辑界面。它包含上下文记忆、推荐问题和应用来源三个核心配置项，并支持状态的本地持久化和埋点上报。

## 2. 交互演示 (Interactive Demo)
在 Storybook 界面中，可以通过点击齿轮（⚙️ 功能）图标来展开或收起该面板。

### 状态 (States)
- **默认状态 (Default)**: 面板收起，所有开关处于关闭状态，配置面板隐藏。
- **展开状态 (Expanded)**: 面板展开，伴随 200ms 的平滑过渡动画 (`ease-in-out`)。
- **开启上下文记忆 (Context Memory Enabled)**: 显示“最大记忆轮数”输入框，支持 1-10 轮的数值输入，失焦自动保存。
- **开启推荐问题 (Recommend Questions Enabled)**: 显示“LLM推荐”和“固定问题”单选切换。选择“固定问题”时，显示可拖拽排序的输入列表（最多支持4条）。
- **开启引用来源 (Reference Source Enabled)**: 开启后在回答底部展示来源标识。

## 3. 视觉反馈与无障碍 (Visual Feedback & Accessibility)
- **统一颜色策略**:
  - **开启状态**: 文字色 `#096dd9`，背景色 `#e6f7ff`，边框色 `#91d5ff`。
  - **关闭状态**: 文字色 `#8c8c8c`，背景色 `#fafafa`，边框色 `#d9d9d9`。
- **平滑过渡**: 所有颜色切换均带有 `200ms ease-out` 过渡动画。
- **无障碍访问 (A11y)**:
  - Toggle 开关动态绑定 `aria-pressed` 属性（"true" 或 "false"），配合屏幕阅读器朗读“已开启 / 已关闭”。
  - 支持点击面板外部自动关闭。

## 4. 数据结构 (Data Structure)
组件的状态存储在 `localStorage` 的 `featureConfig` 键中，结构如下：
```json
{
  "contextMemory": {
    "enabled": false,
    "rounds": 3
  },
  "recommendQuestions": {
    "enabled": false,
    "mode": "llm",
    "fixedQuestions": []
  },
  "referenceSource": {
    "enabled": false
  }
}
```
