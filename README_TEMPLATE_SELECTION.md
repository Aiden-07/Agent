# Template Selection Component

This module provides interactive, accessible template selection cards with visual feedback.

## Features
- **Selection State**: Visual indication (border, ring, background) for selected items.
- **Accessibility**: Full keyboard support (Tab, Enter, Space) and ARIA attributes.
- **Efficient Updates**: Updates classes directly without full re-renders.

## Usage

### 1. Include CSS Variables
Include `css/template-selection.css` or define these variables:
```css
:root {
    --color-selected-bg: #eff6ff;
    --color-selected-border: #2563eb;
}
```

### 2. Render List
Use `renderTemplateList(type, items)` in `js/knowledge.js`. This function now automatically generates interactive cards.

### 3. Handle Selection
Selection is handled automatically by `handleTemplateClick`.
- **State**: Accessed via `window.selectedTemplateId`.
- **Callback**: Define `window.onTemplateSelect = function(event) { ... }` to listen for changes.
  - `event.element`: The DOM element selected.
  - `event.selected`: Boolean status.

## Classes
- `.template-card`: The container element.
- `.is-selected` (conceptually): Applied via Tailwind utility classes (`border-blue-600`, `ring-2`, etc.).
