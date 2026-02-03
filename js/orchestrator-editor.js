// Orchestrator Editor Logic

let currentOrchId = null;
let isOrchDirty = false;

window.initOrchestratorEditor = function(params) {
    console.log('Initializing Orchestrator Editor...', params);
    
    if (params && params.id) {
        currentOrchId = params.id;
        loadOrchestratorData(params.id);
    } else {
        console.error('No orchestrator ID provided');
        alert('错误：未指定工作流ID');
        window.goBackFromOrchestrator();
        return;
    }
    
    setupEditorInteractions();
}

function loadOrchestratorData(id) {
    // Ensure data is loaded (if refreshed on this page)
    if (!window.orchestratorData || window.orchestratorData.length === 0) {
        // Fallback: Try to generate mock data or load from storage
        // For now, we just generate a dummy one if missing to prevent crash
        window.orchestratorData = [{
            id: id,
            name: '未命名工作流',
            status: 'draft'
        }];
    }
    
    const orch = window.orchestratorData.find(o => o.id === id);
    if (orch) {
        const nameInput = document.getElementById('orch-editor-name');
        if (nameInput) nameInput.value = orch.name;
        updateSaveStatus('已同步');
    }
}

function setupEditorInteractions() {
    // Name Input Auto-save
    const nameInput = document.getElementById('orch-editor-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            isOrchDirty = true;
            updateSaveStatus('保存中...');
            
            // Debounce save
            clearTimeout(window.orchSaveTimer);
            window.orchSaveTimer = setTimeout(() => {
                saveOrchestratorName(nameInput.value);
            }, 1000);
        });
    }
    
    // Draggable Interactions (Visual Only)
    const draggables = document.querySelectorAll('.draggable-node');
    draggables.forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'node');
            e.dataTransfer.effectAllowed = 'copy';
            el.classList.add('opacity-50');
        });
        
        el.addEventListener('dragend', () => {
            el.classList.remove('opacity-50');
        });
    });
    
    const canvas = document.getElementById('orch-canvas');
    if (canvas) {
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvas.classList.add('bg-blue-50/50');
        });
        
        canvas.addEventListener('dragleave', () => {
            canvas.classList.remove('bg-blue-50/50');
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('bg-blue-50/50');
            alert('节点添加功能暂未开放');
        });
    }
}

function saveOrchestratorName(newName) {
    if (!currentOrchId) return;
    
    const orch = window.orchestratorData.find(o => o.id === currentOrchId);
    if (orch) {
        orch.name = newName;
        orch.updatedAt = new Date().toLocaleString();
        updateSaveStatus('已保存');
        isOrchDirty = false;
    }
}

function updateSaveStatus(status) {
    const el = document.getElementById('orch-save-status');
    if (el) el.textContent = status;
}

window.goBackFromOrchestrator = function() {
    if (isOrchDirty) {
        saveOrchestratorName(document.getElementById('orch-editor-name').value);
    }
    // Show "Saved" toast conceptually
    // alert('已自动保存更改');
    
    if (typeof window.switchView === 'function') {
        window.switchView('orchestrator');
    } else {
        window.location.hash = '#/orchestrator';
    }
}

window.publishOrchestrator = function() {
    const btn = document.querySelector('button[onclick="publishOrchestrator()"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 发布中...';
    
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 已发布';
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');
        
        // Update Data
        const orch = window.orchestratorData.find(o => o.id === currentOrchId);
        if (orch) {
            orch.status = 'active';
        }
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            btn.classList.remove('bg-green-600', 'hover:bg-green-700');
        }, 2000);
        
        alert('工作流已成功发布！');
    }, 1500);
}

// Node Settings Drawer Logic
window.openNodeSettings = function(type) {
    const drawer = document.getElementById('node-settings-drawer');
    const content = document.getElementById('drawer-content');
    const title = document.getElementById('drawer-title');
    
    if (!drawer || !content || !title) return;
    
    // Set Title
    const titleMap = {
        'input': '开始输入设置',
        'knowledge': '知识库检索设置',
        'llm': '大模型处理设置',
        'optimize': '结果优化设置',
        'output': '最终输出设置'
    };
    title.textContent = titleMap[type] || '节点设置';
    
    // Render Content
    content.innerHTML = getNodeSettingsHTML(type);
    
    // Open Drawer
    drawer.classList.remove('translate-x-full');
}

window.closeNodeSettings = function() {
    const drawer = document.getElementById('node-settings-drawer');
    if (drawer) {
        drawer.classList.add('translate-x-full');
    }
}

window.saveNodeSettings = function() {
    // Mock save
    const btn = document.querySelector('button[onclick="saveNodeSettings()"]');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        window.closeNodeSettings();
        // Show toast ideally
        console.log('Node settings saved');
    }, 500);
}

window.toggleKnowledgeFilters = function() {
    const scope = document.getElementById('knowledge-scope');
    const filters = document.getElementById('knowledge-filters');
    if (scope && filters) {
        if (scope.value === 'specific') {
            filters.classList.remove('hidden');
        } else {
            filters.classList.add('hidden');
        }
    }
}

const FIELD_OPTIONS = [
    { label: '标题', value: 'title', type: 'text' },
    { label: '类型', value: 'type', type: 'text' },
    { label: '创建人', value: 'creator', type: 'text' },
    { label: '创建时间', value: 'create_time', type: 'date' },
    { label: '状态', value: 'status', type: 'text' },
    { label: '职责', value: 'duty', type: 'text' },
    { label: '职级', value: 'rank', type: 'number' }
];

const OPERATOR_OPTIONS = {
    text: [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'neq' },
        { label: '包含', value: 'contains' },
        { label: '不包含', value: 'not_contains' },
        { label: '为空', value: 'empty' },
        { label: '不为空', value: 'not_empty' }
    ],
    number: [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'neq' },
        { label: '包含', value: 'contains' },
        { label: '不包含', value: 'not_contains' },
        { label: '大于', value: 'gt' },
        { label: '小于', value: 'lt' },
        { label: '大于等于', value: 'gte' },
        { label: '小于等于', value: 'lte' },
        { label: '为空', value: 'empty' },
        { label: '不为空', value: 'not_empty' }
    ],
    date: [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'neq' },
        { label: '早于', value: 'lt' },
        { label: '晚于', value: 'gt' },
        { label: '为空', value: 'empty' },
        { label: '不为空', value: 'not_empty' }
    ]
};

function updateOperators(select) {
    const row = select.parentElement;
    const opSelect = row.querySelector('.operator-select');
    const fieldType = select.options[select.selectedIndex].dataset.type || 'text';
    
    const ops = OPERATOR_OPTIONS[fieldType] || OPERATOR_OPTIONS.text;
    opSelect.innerHTML = ops.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function getConditionRowHTML(defaultField = 'rank', defaultOp = 'eq', defaultValue = '总监') {
    const fieldOptions = FIELD_OPTIONS.map(f => `<option value="${f.value}" data-type="${f.type}" ${f.value === defaultField ? 'selected' : ''}>${f.label}</option>`).join('');
    
    // Determine initial operators based on default field
    const defaultFieldObj = FIELD_OPTIONS.find(f => f.value === defaultField) || FIELD_OPTIONS[0];
    const initialOps = OPERATOR_OPTIONS[defaultFieldObj.type] || OPERATOR_OPTIONS.text;
    const opOptions = initialOps.map(o => `<option value="${o.value}" ${o.value === defaultOp ? 'selected' : ''}>${o.label}</option>`).join('');
    
    return `
        <select onchange="updateOperators(this)" class="w-24 border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-500">
            ${fieldOptions}
        </select>
        <select class="operator-select w-24 border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-500">
            ${opOptions}
        </select>
        <div class="flex-1 relative group/input">
            <input type="text" class="w-full border border-gray-300 rounded px-2 py-1 text-sm pr-7 focus:outline-none focus:border-blue-500" placeholder="值" value="${defaultValue}">
            <button onclick="showVariableMenu(this)" class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 p-1 rounded transition-colors" title="插入变量">
                <i class="fa-solid fa-code"></i>
            </button>
        </div>
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 p-1"><i class="fa-solid fa-trash"></i></button>
    `;
}

window.addCondition = function() {
    const container = document.getElementById('filter-conditions-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center';
    div.innerHTML = getConditionRowHTML('duty', 'eq', '');
    container.appendChild(div);
}

// Variable Menu Logic
window.showVariableMenu = function(btn) {
    // Remove existing menu if any
    const existing = document.getElementById('var-menu-dropdown');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'var-menu-dropdown';
    menu.className = 'fixed bg-white border border-gray-200 shadow-xl rounded-lg z-50 w-48 overflow-hidden text-sm';
    
    // Position
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = (rect.right - 192) + 'px'; // Align right edge

    const vars = [
        { name: '用户姓名', val: '{{user.name}}' },
        { name: '用户职责', val: '{{user.duty}}' },
        { name: '用户职级', val: '{{user.rank}}' }
    ];

    let html = '<div class="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-100">插入变量: 用户信息</div>';
    vars.forEach(v => {
        html += `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-700 hover:text-blue-700 flex justify-between items-center group" onclick="insertVariable('${v.val}')">
            <span>${v.name}</span>
            <code class="text-xs text-gray-400 group-hover:text-blue-500 bg-gray-100 px-1 rounded">${v.val}</code>
        </div>`;
    });

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Click outside to close
    setTimeout(() => {
        document.addEventListener('click', closeMenuHandler);
    }, 0);

    // Store reference to input
    window.currentVarInput = btn.previousElementSibling;
}

function closeMenuHandler(e) {
    const menu = document.getElementById('var-menu-dropdown');
    if (menu && !menu.contains(e.target) && !e.target.closest('button[onclick*="showVariableMenu"]')) {
        menu.remove();
        document.removeEventListener('click', closeMenuHandler);
    }
}

window.insertVariable = function(val) {
    if (window.currentVarInput) {
        const input = window.currentVarInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + val + text.substring(end);
        // Dispatch input event
        input.dispatchEvent(new Event('input'));
        input.focus();
    }
    const menu = document.getElementById('var-menu-dropdown');
    if (menu) menu.remove();
    document.removeEventListener('click', closeMenuHandler);
}

function getNodeSettingsHTML(type) {
    if (type === 'knowledge') {
        return `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">节点名称</label>
                    <input type="text" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" value="检索知识库">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">检索范围</label>
                    <select id="knowledge-scope" onchange="toggleKnowledgeFilters()" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="all">全部知识</option>
                        <option value="specific">指定知识</option>
                    </select>
                </div>

                <div id="knowledge-filters" class="hidden border border-gray-200 rounded-md p-3 bg-gray-50">
                    <div class="flex items-center justify-between mb-3">
                        <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide">过滤条件</label>
                        <div class="flex items-center gap-2 text-xs bg-white rounded-md border border-gray-200 p-0.5">
                            <label class="cursor-pointer">
                                <input type="radio" name="condition-logic" class="peer sr-only" checked>
                                <span class="px-2 py-0.5 rounded text-gray-500 peer-checked:bg-blue-100 peer-checked:text-blue-600 transition-colors">且 (AND)</span>
                            </label>
                            <label class="cursor-pointer">
                                <input type="radio" name="condition-logic" class="peer sr-only">
                                <span class="px-2 py-0.5 rounded text-gray-500 peer-checked:bg-blue-100 peer-checked:text-blue-600 transition-colors">或 (OR)</span>
                            </label>
                        </div>
                    </div>
                    
                    <div id="filter-conditions-container" class="space-y-2">
                        <div class="flex gap-2 items-center">
                            ${getConditionRowHTML('rank', 'eq', '总监')}
                        </div>
                    </div>
                    
                    <button onclick="addCondition()" class="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                        <i class="fa-solid fa-plus"></i> 添加条件
                    </button>
                </div>
            </div>
        `;
    } else if (type === 'llm') {
        return `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">模型选择</label>
                    <select class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5">GPT-3.5 Turbo</option>
                        <option value="claude-3">Claude 3 Opus</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">系统提示词 (System Prompt)</label>
                    <textarea class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 h-32" placeholder="输入系统提示词..."></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">温度 (Temperature)</label>
                    <div class="flex items-center gap-2">
                        <input type="range" min="0" max="1" step="0.1" value="0.7" class="flex-1">
                        <span class="text-sm text-gray-500">0.7</span>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'input') {
         return `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">输入参数定义</label>
                    <div class="bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                        <code>{ "query": "string" }</code>
                    </div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="text-center py-8 text-gray-500 text-sm">
                暂无配置项
            </div>
        `;
    }
}

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator-editor') {
        window.initOrchestratorEditor(e.detail.params);
    }
});
