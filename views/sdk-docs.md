# Agent SDK 开发者文档

## 简介
Agent SDK 是一个轻量级的前端集成方案，允许开发者将智能体快速嵌入到任何 Web 应用中。它提供了一个可拖拽的悬浮球组件和完整的对话交互界面。

## 快速开始

### 1. 引入资源
将 SDK 脚本引入到你的 HTML 页面中。建议放在 `</body>` 标签之前。

```html
<!-- 引入 FontAwesome (如果尚未引入) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- 引入 Agent SDK -->
<script src="path/to/js/agent-sdk.js"></script>
```

### 2. 初始化
在页面加载完成后，创建 `AgentSDK` 实例。

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const agent = new AgentSDK({
        agentId: 'YOUR_AGENT_ID',
        name: '智能助手',
        avatar: 'fa-solid fa-robot', // 支持 FontAwesome 图标类名
        primaryColor: '#2563EB', // 主题色
        welcomeMsg: '您好，请问有什么可以帮您？'
    });
});
```

## 配置选项 (Config)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentId` | string | required | 智能体的唯一标识符 |
| `name` | string | '智能助手' | 聊天窗口显示的名称 |
| `avatar` | string | 'fa-solid fa-robot' | 悬浮球图标 (FontAwesome 类名) |
| `welcomeMsg` | string | '你好...' | 初始欢迎语 |
| `primaryColor` | string | '#2563EB' | 组件主题颜色 (Hex) |
| `zIndex` | number | 9999 | 组件的层级 |
| `position` | object | `{bottom: '20px', right: '20px'}` | 初始位置配置 |

## 交互特性

1. **悬浮球**: 默认显示在右下角，支持鼠标/触摸拖拽。
2. **自动吸附**: 拖拽至屏幕边缘 50px 范围内时，会自动吸附到边缘。
3. **状态保持**: 用户点击关闭按钮后，组件会记住关闭状态，刷新页面不会再次出现（除非调用 `.show()` 方法）。
4. **响应式**: 适配移动端设备，聊天窗口自动调整大小。

## API 方法

### `agent.toggleChat(forceState?: boolean)`
切换聊天窗口的显示/隐藏状态。
- `forceState`: `true` 强制打开，`false` 强制关闭。

### `agent.close()`
关闭并隐藏悬浮球组件。此操作会被持久化记录。

### `agent.show()`
显示悬浮球组件。此操作会清除之前的关闭记录。

## TypeScript 支持
SDK 提供了完整的 TypeScript 类型定义文件 `agent-sdk.d.ts`，开发时可直接引用以获得代码提示。

---
**注意**: 此 SDK 目前处于开发者预览阶段。
