# 开发指南

## UI 规范

### 列表页操作列 (Action Column)

所有列表页面的操作列（Actions）应遵循以下规范：

1. **表头**：操作列的表头应为空，不显示 "操作" 文字。
   ```html
   <th class="px-6 py-4 text-right"></th>
   ```

2. **操作按钮**：
   - 统一使用 "..." (Ellipsis) 图标按钮。
   - 点击按钮触发下拉菜单。
   - 按钮样式：
     ```html
     <button onclick="window.openXxxActions(event, id)" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
         <i class="fa-solid fa-ellipsis"></i>
     </button>
     ```

3. **下拉菜单 (Action Menu)**：
   - 使用 `js/utils.js` 中的 `window.showActionMenu` 函数。
   - 菜单项配置结构：
     ```javascript
     window.showActionMenu(event, [
         {
             label: '编辑',
             icon: 'fa-solid fa-pen',
             onClick: () => { ... }
         },
         {
             label: '删除',
             icon: 'fa-solid fa-trash',
             className: 'text-red-600 hover:bg-red-50', // 危险操作样式
             iconClass: 'text-red-500',
             onClick: () => { ... }
         }
     ]);
     ```

### 单元测试

前端单元测试位于 `tests/` 目录下。
- 运行测试：在浏览器中打开 `tests/test_runner.html`。
- 添加测试：修改 `tests/test_runner.html` 添加新的测试用例。
