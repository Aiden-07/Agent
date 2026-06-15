// Orchestrator Editor Logic

let currentOrchId = null;
let isOrchDirty = false;

// Component picker state (for dragging "应用组件" onto canvas)
let orchCompPickerState = {
    isOpen: false,
    tab: 'agent', // agent | orchestrator
    search: '',
    selectedId: null,
    dropPos: { x: 0, y: 0 } // relative to canvas
};

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
            const nodeType = el.dataset.nodeType || 'node';
            const nodeLabel = (el.querySelector('span')?.textContent || '').trim();
            e.dataTransfer.setData('application/x-orch-node-type', nodeType);
            e.dataTransfer.setData('application/x-orch-node-label', nodeLabel);
            // fallback
            e.dataTransfer.setData('text/plain', nodeType);
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

            const nodeType = e.dataTransfer.getData('application/x-orch-node-type') || e.dataTransfer.getData('text/plain');
            const rect = canvas.getBoundingClientRect();
            const dropX = e.clientX - rect.left;
            const dropY = e.clientY - rect.top;

            // Dragging "应用组件" into canvas -> open picker modal
            if (nodeType === 'app-component') {
                openOrchComponentPicker({ x: dropX, y: dropY }, 'agent');
                return;
            }

            // Dragging "Skill" into canvas -> open picker modal (skill tab)
            if (nodeType === 'skill') {
                openOrchComponentPicker({ x: dropX, y: dropY }, 'skill');
                return;
            }

            // Dragging "对话交互" into canvas -> add dialog node
            if (nodeType === 'dialog-interaction') {
                addDialogInteractionNodeToCanvas({ x: dropX, y: dropY });
                return;
            }

            alert('节点添加功能暂未开放');
        });
    }
}

// ==================== Canvas Nodes (Lightweight) ====================
const ORCH_NODE_STORAGE_KEY = 'vagent_orch_canvas_nodes_v1';
let orchCanvasNodes = {};

function loadOrchCanvasNodes() {
    try {
        const raw = localStorage.getItem(ORCH_NODE_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                orchCanvasNodes = parsed;
            }
        }
    } catch (e) {
        // ignore
    }
}

function saveOrchCanvasNodes() {
    try {
        localStorage.setItem(ORCH_NODE_STORAGE_KEY, JSON.stringify(orchCanvasNodes));
    } catch (e) {
        // ignore
    }
}

function ensureOrchCanvasNodesLoaded() {
    if (!orchCanvasNodes || typeof orchCanvasNodes !== 'object') orchCanvasNodes = {};
    if (Object.keys(orchCanvasNodes).length === 0) loadOrchCanvasNodes();
}

function newOrchNodeId(prefix = 'NODE') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getOrchNodeById(id) {
    ensureOrchCanvasNodesLoaded();
    return orchCanvasNodes[id] || null;
}

function upsertOrchNode(node) {
    ensureOrchCanvasNodesLoaded();
    orchCanvasNodes[node.id] = node;
    saveOrchCanvasNodes();
}

function addDialogInteractionNodeToCanvas(pos) {
    const canvas = document.getElementById('orch-canvas');
    if (!canvas) return;

    const id = newOrchNodeId('DIALOG');
    const nodeData = {
        id,
        type: 'dialog-interaction',
        name: '对话交互',
        config: {
            model: 'gpt-4o-mini',
            inputs: [],
            question: '',
            answerType: 'options', // direct | options
            optionsMode: 'fixed', // fixed | dynamic
            options: [
                { key: 'A', content: '' },
                { key: 'B', content: '' }
            ]
        }
    };
    upsertOrchNode(nodeData);

    const node = document.createElement('button');
    node.type = 'button';
    node.dataset.orchNodeId = id;
    node.dataset.orchNodeType = 'dialog-interaction';
    node.className = 'absolute w-44 bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col gap-2 hover:border-blue-500 hover:shadow-md transition-shadow cursor-pointer text-left';
    node.style.left = `${Math.max(12, pos.x - 88)}px`;
    node.style.top = `${Math.max(70, pos.y - 20)}px`;
    node.style.zIndex = '30';

    node.innerHTML = `
        <div class="flex items-center gap-2 border-b border-gray-100 pb-2">
            <div class="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                <i class="fa-solid fa-circle-question" aria-hidden="true"></i>
            </div>
            <span class="text-sm font-medium text-gray-800 truncate">对话交互</span>
        </div>
        <div class="text-xs text-gray-400 truncate">未配置</div>
    `;
    node.onclick = () => window.openNodeSettings('dialog-interaction', { nodeId: id });
    canvas.appendChild(node);
}

function openOrchComponentPicker(dropPos, defaultTab = 'agent') {
    const modal = document.getElementById('orch-component-picker-modal');
    if (!modal) {
        alert('未找到组件选择弹窗（orch-component-picker-modal）');
        return;
    }

    orchCompPickerState = {
        ...orchCompPickerState,
        isOpen: true,
        tab: defaultTab,
        search: '',
        selectedId: null,
        dropPos: dropPos
    };

    const search = document.getElementById('orch-comp-search');
    if (search) search.value = '';

    switchOrchComponentTab(defaultTab);

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    updateOrchComponentConfirmState();
    renderOrchComponentList();
}

window.closeOrchComponentPicker = function() {
    const modal = document.getElementById('orch-component-picker-modal');
    if (!modal) return;

    orchCompPickerState.isOpen = false;
    orchCompPickerState.selectedId = null;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.switchOrchComponentTab = function(tab) {
    orchCompPickerState.tab = tab;
    orchCompPickerState.selectedId = null;

    const tabAgent = document.getElementById('orch-comp-tab-agent');
    const tabOrch = document.getElementById('orch-comp-tab-orchestrator');
    const tabPlugin = document.getElementById('orch-comp-tab-plugin');
    const tabSkill = document.getElementById('orch-comp-tab-skill');
    const title = document.getElementById('orch-comp-picker-title');
    const addBtnText = document.getElementById('orch-comp-add-btn-text');

    if (tabAgent) {
        tabAgent.className = tab === 'agent'
            ? 'px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-600 font-medium'
            : 'px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-50';
    }
    if (tabOrch) {
        tabOrch.className = tab === 'orchestrator'
            ? 'px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-600 font-medium'
            : 'px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-50';
    }
    if (tabPlugin) {
        tabPlugin.className = tab === 'plugin'
            ? 'px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-600 font-medium'
            : 'px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-50';
    }
    if (tabSkill) {
        tabSkill.className = tab === 'skill'
            ? 'px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-600 font-medium'
            : 'px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-50';
    }
    if (addBtnText) {
        addBtnText.textContent = tab === 'agent'
            ? '添加智能体组件'
            : (tab === 'orchestrator' ? '添加工作流组件' : (tab === 'plugin' ? '添加插件' : '添加Skill'));
    }
    if (title) {
        title.textContent = tab === 'skill' ? '选择 Skill' : '选择应用组件';
    }

    updateOrchComponentConfirmState();
    renderOrchComponentList();
}

function getOrchSelectableComponents() {
    // Prefer global components data if exists
    const all = (typeof window.getComponentsData === 'function')
        ? window.getComponentsData()
        : (Array.isArray(window.componentsData) ? window.componentsData : []);
    const tabType = orchCompPickerState.tab;
    const q = (document.getElementById('orch-comp-search')?.value || '').trim().toLowerCase();

    // Fallback mock if nothing exists
    const fallback = [
        { id: 'CMP-AGENT-001', name: '客服助手组件', type: 'agent', description: '用于客服问答的智能体组件' },
        { id: 'CMP-AGENT-002', name: '知识检索组件', type: 'agent', description: 'RAG 检索与召回组件' },
        { id: 'CMP-WF-001', name: '数据清洗工作流', type: 'orchestrator', description: '数据清洗与结构化流程' },
        { id: 'CMP-WF-002', name: '多轮对话工作流', type: 'orchestrator', description: '多轮对话编排流程' },
        { id: 'SKL-001', name: '文档生成 Skill', type: 'skill', description: '根据输入内容生成文档结构与正文' },
        { id: 'SKL-002', name: 'PPT 生成 Skill', type: 'skill', description: '根据大纲生成 PPT 页面与要点' }
    ];

    const source = all.length > 0 ? all : fallback;

    return source
        .filter(x => x.type === tabType)
        .filter(x => {
            if (!q) return true;
            return (x.name || '').toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q);
        });
}

window.renderOrchComponentList = function() {
    const list = document.getElementById('orch-comp-list');
    const empty = document.getElementById('orch-comp-empty');
    if (!list || !empty) return;

    const comps = getOrchSelectableComponents();
    list.innerHTML = '';

    if (comps.length === 0) {
        empty.classList.remove('hidden');
        list.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');

    comps.forEach(c => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = [
            'text-left p-4 rounded-xl border transition-shadow',
            orchCompPickerState.selectedId === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        ].join(' ');
        item.onclick = () => {
            orchCompPickerState.selectedId = c.id;
            updateOrchComponentConfirmState();
            renderOrchComponentList();
        };

        item.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="font-medium text-gray-900 truncate">${escapeHtml(c.name || '-')}</div>
                    <div class="text-xs text-gray-400 mt-1 line-clamp-2">${escapeHtml(c.description || '')}</div>
                </div>
                <div class="mt-0.5 w-4 h-4 rounded-full border ${orchCompPickerState.selectedId === c.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'} flex items-center justify-center">
                    ${orchCompPickerState.selectedId === c.id ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function updateOrchComponentConfirmState() {
    const btn = document.getElementById('orch-comp-confirm');
    if (!btn) return;
    btn.disabled = !orchCompPickerState.selectedId;
}

window.confirmOrchComponentPicker = function() {
    const selectedId = orchCompPickerState.selectedId;
    if (!selectedId) return;

    const comps = getOrchSelectableComponents();
    const selected = comps.find(c => c.id === selectedId);
    if (!selected) {
        alert('未找到所选组件');
        return;
    }

    addOrchComponentNodeToCanvas(selected, orchCompPickerState.dropPos);
    window.closeOrchComponentPicker();
}

window.goToComponentsCreate = function(type) {
    // Persist intent across view switch
    try {
        sessionStorage.setItem('pendingCreateComponentType', type || 'agent');
    } catch (e) {
        // ignore
    }

    // Navigate to Components view
    if (typeof window.switchView === 'function') {
        window.switchView('components');
        return;
    }
    window.location.hash = '#/components';
}

window.goToComponentsCreateFromPicker = function() {
    const type = orchCompPickerState?.tab || 'agent';
    window.goToComponentsCreate(type);
}

function addOrchComponentNodeToCanvas(component, pos) {
    const canvas = document.getElementById('orch-canvas');
    if (!canvas) return;

    const node = document.createElement('div');
    node.className = 'absolute w-44 bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col gap-2 hover:border-blue-500 hover:shadow-md transition-shadow cursor-pointer';
    node.style.left = `${Math.max(12, pos.x - 88)}px`;
    node.style.top = `${Math.max(70, pos.y - 20)}px`;
    node.style.zIndex = '30';

    const iconMeta = (() => {
        if (orchCompPickerState.tab === 'agent') return { icon: 'fa-robot', cls: 'bg-purple-100 text-purple-600' };
        if (orchCompPickerState.tab === 'orchestrator') return { icon: 'fa-layer-group', cls: 'bg-blue-100 text-blue-600' };
        return { icon: 'fa-plug', cls: 'bg-green-100 text-green-600' };
    })();

    node.innerHTML = `
        <div class="flex items-center gap-2 border-b border-gray-100 pb-2">
            <div class="w-6 h-6 rounded ${iconMeta.cls} flex items-center justify-center text-xs">
                <i class="fa-solid ${iconMeta.icon}"></i>
            </div>
            <span class="text-sm font-medium text-gray-800 truncate">${escapeHtml(component.name || '应用组件')}</span>
        </div>
        <div class="text-xs text-gray-400 truncate">${escapeHtml(component.id || '')}</div>
    `;

    canvas.appendChild(node);
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ==================== Dialog Interaction Config ====================
window.updateDialogModel = function(nodeId, value) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    node.config.model = value;
    node.config.updatedAt = new Date().toLocaleString();
    upsertOrchNode(node);
}

window.updateDialogQuestion = function(nodeId, value) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    node.config.question = value;
    node.config.updatedAt = new Date().toLocaleString();
    upsertOrchNode(node);
}

window.setDialogAnswerType = function(nodeId, type) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    node.config.answerType = type;
    upsertOrchNode(node);
    // re-render drawer content to reflect visibility
    window.openNodeSettings('dialog-interaction', { nodeId });
}

window.setDialogOptionsMode = function(nodeId, mode) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    node.config.optionsMode = mode;
    upsertOrchNode(node);
    window.openNodeSettings('dialog-interaction', { nodeId });
}

window.addDialogOption = function(nodeId) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    if (!Array.isArray(node.config.options)) node.config.options = [];
    const nextKey = String.fromCharCode(65 + node.config.options.length);
    node.config.options.push({ key: nextKey, content: '' });
    upsertOrchNode(node);
    window.openNodeSettings('dialog-interaction', { nodeId });
}

window.removeDialogOption = function(nodeId, idx) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    if (!Array.isArray(node.config.options)) return;
    node.config.options.splice(idx, 1);
    upsertOrchNode(node);
    window.openNodeSettings('dialog-interaction', { nodeId });
}

window.updateDialogOptionKey = function(nodeId, idx, value) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    if (!Array.isArray(node.config.options)) return;
    if (!node.config.options[idx]) return;
    node.config.options[idx].key = value;
    upsertOrchNode(node);
}

window.updateDialogOptionContent = function(nodeId, idx, value) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    if (!Array.isArray(node.config.options)) return;
    if (!node.config.options[idx]) return;
    node.config.options[idx].content = value;
    upsertOrchNode(node);
}

window.addDialogInput = function(nodeId) {
    alert('输入参数配置：演示页面暂未实现');
}

window.saveDialogInteraction = function(nodeId) {
    const node = getOrchNodeById(nodeId);
    if (!node) return;
    if (!(node.config?.question || '').trim()) {
        alert('提问内容不能为空');
        return;
    }
    const canvasNode = document.querySelector(`[data-orch-node-id="${nodeId}"]`);
    if (canvasNode) {
        const subtitle = canvasNode.querySelector('.text-xs.text-gray-400');
        if (subtitle) subtitle.textContent = node.config?.question ? '已配置' : '未配置';
    }
    window.closeNodeSettings();
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
window.openNodeSettings = function(type, ctx = null) {
    const drawer = document.getElementById('node-settings-drawer');
    const content = document.getElementById('drawer-content');
    const title = document.getElementById('drawer-title');
    
    if (!drawer || !content || !title) return;
    
    // Set Title
    const titleMap = {
        'input': '开始输入设置',
        'knowledge': '知识库检索设置',
        'llm': '大模型处理设置',
        'dialog-interaction': '对话交互设置',
        'optimize': '结果优化设置',
        'output': '最终输出设置'
    };
    title.textContent = titleMap[type] || '节点设置';
    
    // Render Content
    content.innerHTML = getNodeSettingsHTML(type, ctx);
    
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

function getNodeSettingsHTML(type, ctx = null) {
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
    } else if (type === 'dialog-interaction') {
        const nodeId = ctx?.nodeId || '';
        const node = nodeId ? getOrchNodeById(nodeId) : null;
        const config = node?.config || {};
        const answerType = config.answerType || 'options';
        const optionsMode = (!config.optionsMode || config.optionsMode === 'dynamic') ? 'fixed' : config.optionsMode;
        const options = Array.isArray(config.options) ? config.options : [];
        const model = (!config.model || config.model === 'doubao-2.0-lite') ? 'gpt-4o-mini' : config.model;
        const question = config.question || '';

        const renderOptionRows = () => {
            if (options.length === 0) {
                return `<div class="text-sm text-gray-400 py-6 text-center">暂无选项</div>`;
            }
            return options.map((opt, idx) => `
                <div class="grid grid-cols-[64px,1fr,32px] gap-2 items-center py-2">
                    <input value="${escapeHtml(opt.key || '')}" aria-label="选项" oninput="updateDialogOptionKey('${nodeId}', ${idx}, this.value)" class="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value="${escapeHtml(opt.content || '')}" aria-label="内容" oninput="updateDialogOptionContent('${nodeId}', ${idx}, this.value)" class="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="可以使用{{变量名}}引入输入参数中的变量" />
                    <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600" onclick="removeDialogOption('${nodeId}', ${idx})" title="删除" aria-label="删除选项">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                </div>
            `).join('');
        };

        return `
            <div class="space-y-5">
                <!-- 模型 -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-gray-700">模型</div>
                        <button class="text-gray-400 hover:text-gray-600" onclick="alert('模型配置：演示页面暂未实现')" title="配置" aria-label="模型配置">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                    <select aria-label="模型" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="updateDialogModel('${nodeId}', this.value)">
                        <option value="gpt-4o-mini" ${model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o mini</option>
                        <option value="claude-3-7-sonnet" ${model === 'claude-3-7-sonnet' ? 'selected' : ''}>Claude 3.7 Sonnet</option>
                    </select>
                </div>

                <!-- 输入 -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="text-sm font-medium text-gray-700">输入</div>
                            <i class="fa-solid fa-circle-info text-gray-300 text-xs" aria-hidden="true" title="输入参数用于引入变量"></i>
                        </div>
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" onclick="addDialogInput('${nodeId}')" title="新增输入" aria-label="新增输入参数">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <div id="dialog-inputs" class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-400 text-sm">
                        参数为空
                    </div>
                </div>

                <!-- 提问内容 -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="text-sm font-medium text-gray-700">提问内容</div>
                        <i class="fa-solid fa-circle-info text-gray-300 text-xs" aria-hidden="true" title="可使用{{变量名}}引入输入参数中的变量"></i>
                    </div>
                    <textarea aria-label="提问内容" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24" placeholder="请输入提问内容…" oninput="updateDialogQuestion('${nodeId}', this.value)">${escapeHtml(question)}</textarea>
                </div>

                <!-- 回答类型 -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="text-sm font-medium text-gray-700 mb-3">请选择回答类型</div>
                    <div class="space-y-2">
                        <label class="flex items-center gap-2 p-2 rounded-lg border ${answerType === 'direct' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} cursor-pointer">
                            <input type="radio" name="dialog-answer-type" ${answerType === 'direct' ? 'checked' : ''} onclick="setDialogAnswerType('${nodeId}', 'direct')">
                            <span class="text-sm text-gray-700">直接回答</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 rounded-lg border ${answerType === 'options' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} cursor-pointer">
                            <input type="radio" name="dialog-answer-type" ${answerType === 'options' ? 'checked' : ''} onclick="setDialogAnswerType('${nodeId}', 'options')">
                            <span class="text-sm text-gray-700">选项回答</span>
                        </label>
                    </div>

                    <div id="dialog-options-panel" class="${answerType === 'options' ? '' : 'hidden'} mt-4 border-t border-gray-100 pt-4">
                        <div class="text-sm font-medium text-gray-700 mb-3">设置选项内容</div>
                        <div class="inline-flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                            <button class="px-3 py-1.5 text-sm rounded-md bg-white shadow-sm text-gray-900" onclick="setDialogOptionsMode('${nodeId}', 'fixed')">固定内容</button>
                        </div>

                        <div class="mt-3">
                            <div class="grid grid-cols-[64px,1fr,32px] gap-2 text-xs text-gray-400 pb-2">
                                <div>选项</div>
                                <div>内容</div>
                                <div></div>
                            </div>
                            <div id="dialog-options-rows" class="border border-gray-200 rounded-lg px-3">
                                ${renderOptionRows()}
                                <button class="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium border-t border-gray-100" onclick="addDialogOption('${nodeId}')">
                                    <i class="fa-solid fa-plus mr-1"></i> 新增选项
                                </button>
                            </div>

                            <div class="mt-3 text-xs text-gray-500">
                                <div class="font-medium text-gray-700 mb-1">其他</div>
                                此选项对用户不可见，当用户回复无关内容时，走此分支
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 输出（展示） -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="text-sm font-medium text-gray-700 mb-3">输出</div>
                    <div class="space-y-2 text-sm text-gray-700">
                        <div class="flex items-center justify-between">
                            <div class="font-mono">optionId</div>
                            <div class="text-xs text-gray-400">String</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="font-mono">optionContent</div>
                            <div class="text-xs text-gray-400">String</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="font-mono">QUESTION_DATA</div>
                            <div class="text-xs text-gray-400">Object</div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-2">
                    <button class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg" onclick="closeNodeSettings()">取消</button>
                    <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg" onclick="saveDialogInteraction('${nodeId}')">保存</button>
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

// ==================== Feature Config Logic ====================

let featureConfig = {
    contextMemory: { enabled: false, rounds: 3 },
    recommendQuestions: { enabled: false, mode: 'llm', fixedQuestions: [] },
    referenceSource: { enabled: false }
};

function loadFeatureConfig() {
    try {
        const saved = localStorage.getItem('featureConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            featureConfig = { ...featureConfig, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load feature config', e);
    }
    renderFeatureConfigUI();
}

function saveFeatureConfig() {
    localStorage.setItem('featureConfig', JSON.stringify(featureConfig));
}

function reportFeatureToggle(name, value) {
    console.log(`[Buried Point] event: feature_toggle_${name}, value:`, value);
    if (window.reportEvent) {
        window.reportEvent(`feature_toggle_${name}`, { value });
    }
}

window.toggleFeatureConfigMenu = function(event) {
    if (event) {
        event.stopPropagation();
    }
    const menu = document.getElementById('feature-config-menu');
    if (!menu) return;
    
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        // Open
        menu.classList.remove('hidden');
        loadFeatureConfig(); // Sync UI with config
        // Trigger reflow to apply animation
        void menu.offsetWidth;
        menu.classList.remove('opacity-0', 'scale-95');
        menu.classList.add('opacity-100', 'scale-100');
        
        // Add click outside listener
        document.addEventListener('click', closeFeatureConfigMenuOutside);
    } else {
        closeFeatureConfigMenu();
    }
};

function closeFeatureConfigMenuOutside(e) {
    const container = document.getElementById('feature-config-container');
    if (container && !container.contains(e.target)) {
        closeFeatureConfigMenu();
    }
}

function closeFeatureConfigMenu() {
    const menu = document.getElementById('feature-config-menu');
    if (!menu) return;
    
    menu.classList.remove('opacity-100', 'scale-100');
    menu.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        menu.classList.add('hidden');
    }, 200); // 200ms transition
    
    document.removeEventListener('click', closeFeatureConfigMenuOutside);
}

window.handleFeatureToggle = function(name) {
    let toggleEl;
    let configKey = '';
    
    if (name === 'context-memory' || name === 'contextMemory') {
        toggleEl = document.getElementById('feature-context-memory-toggle');
        configKey = 'contextMemory';
        featureConfig.contextMemory.enabled = toggleEl.checked;
        const settingsEl = document.getElementById('feature-context-memory-settings');
        if (settingsEl) settingsEl.classList.toggle('hidden', !toggleEl.checked);
    } else if (name === 'recommend-questions' || name === 'recommendQuestions') {
        toggleEl = document.getElementById('feature-recommend-questions-toggle');
        configKey = 'recommendQuestions';
        featureConfig.recommendQuestions.enabled = toggleEl.checked;
        const settingsEl = document.getElementById('feature-recommend-questions-settings');
        if (settingsEl) settingsEl.classList.toggle('hidden', !toggleEl.checked);
    } else if (name === 'reference-source' || name === 'appSource' || name === 'referenceSource') {
        toggleEl = document.getElementById('feature-reference-source-toggle') || document.getElementById('feature-app-source-toggle');
        configKey = 'referenceSource';
        featureConfig.referenceSource.enabled = toggleEl.checked;
        const settingsEl = document.getElementById('feature-reference-source-settings') || document.getElementById('feature-app-source-settings');
        if (settingsEl) settingsEl.classList.toggle('hidden', !toggleEl.checked);
    }
    
    // UI color strategy optimization: update aria-pressed and track styling
    if (toggleEl) {
        toggleEl.setAttribute('aria-pressed', toggleEl.checked ? 'true' : 'false');
        
        // Update associated track and label styles using the boolean variable
        const isFeatureActive = toggleEl.checked;
        const trackId = toggleEl.id.replace('-toggle', '-track');
        const labelId = toggleEl.id.replace('-toggle', '-label');
        
        const trackEl = document.getElementById(trackId);
        if (trackEl) {
            trackEl.classList.toggle('is-active', isFeatureActive);
        }
        
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
            labelEl.classList.toggle('is-active', isFeatureActive);
        }
    }
    
    saveFeatureConfig();
    reportFeatureToggle(configKey, toggleEl ? toggleEl.checked : false);
};

window.handleFeatureConfigSave = function(name) {
    if (name === 'contextMemory') {
        let rounds = parseInt(document.getElementById('feature-context-memory-rounds').value);
        if (isNaN(rounds) || rounds < 1) rounds = 1;
        if (rounds > 10) rounds = 10;
        document.getElementById('feature-context-memory-rounds').value = rounds;
        featureConfig.contextMemory.rounds = rounds;
    } else if (name === 'recommendQuestions') {
        const modeEl = document.querySelector('input[name="recommendMode"]:checked');
        if (modeEl) {
            const mode = modeEl.value;
            featureConfig.recommendQuestions.mode = mode;
            document.getElementById('feature-fixed-questions-container').classList.toggle('hidden', mode !== 'fixed');
        }
    }
    
    saveFeatureConfig();
};

window.addFixedQuestion = function() {
    if (featureConfig.recommendQuestions.fixedQuestions.length >= 4) {
        alert('最多只能添加4条固定问题');
        return;
    }
    featureConfig.recommendQuestions.fixedQuestions.push('');
    renderFixedQuestions();
    saveFeatureConfig();
};

window.removeFixedQuestion = function(index) {
    featureConfig.recommendQuestions.fixedQuestions.splice(index, 1);
    renderFixedQuestions();
    saveFeatureConfig();
};

window.updateFixedQuestion = function(index, value) {
    featureConfig.recommendQuestions.fixedQuestions[index] = value;
    saveFeatureConfig();
};

function renderFixedQuestions() {
    const list = document.getElementById('feature-fixed-questions-list');
    if (!list) return;
    list.innerHTML = '';
    
    featureConfig.recommendQuestions.fixedQuestions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 mb-1 p-1 bg-white border border-gray-100 rounded shadow-sm fixed-question-item';
        item.dataset.index = index;
        
        item.innerHTML = `
            <i class="fa-solid fa-grip-vertical text-gray-400 cursor-grab hover:text-gray-600 text-xs px-1"></i>
            <input type="text" value="${q.replace(/"/g, '&quot;')}" class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500" onblur="updateFixedQuestion(${index}, this.value)" placeholder="输入推荐问题...">
            <button type="button" class="text-gray-400 hover:text-red-500 text-xs px-1" onclick="removeFixedQuestion(${index})">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        list.appendChild(item);
    });
    
    // Init Sortable
    if (window.Sortable) {
        new Sortable(list, {
            animation: 150,
            handle: '.fa-grip-vertical',
            onEnd: function (evt) {
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;
                const item = featureConfig.recommendQuestions.fixedQuestions.splice(oldIndex, 1)[0];
                featureConfig.recommendQuestions.fixedQuestions.splice(newIndex, 0, item);
                saveFeatureConfig();
                renderFixedQuestions(); // re-render to update indices
            }
        });
    }
}



function renderFeatureConfigUI() {
    // Context Memory
    const cmToggle = document.getElementById('feature-context-memory-toggle');
    if (cmToggle) {
        cmToggle.checked = featureConfig.contextMemory.enabled;
        document.getElementById('feature-context-memory-settings').classList.toggle('hidden', !featureConfig.contextMemory.enabled);
        document.getElementById('feature-context-memory-rounds').value = featureConfig.contextMemory.rounds;
    }
    
    // Recommend Questions
    const rqToggle = document.getElementById('feature-recommend-questions-toggle');
    if (rqToggle) {
        rqToggle.checked = featureConfig.recommendQuestions.enabled;
        document.getElementById('feature-recommend-questions-settings').classList.toggle('hidden', !featureConfig.recommendQuestions.enabled);
        const modeRadios = document.getElementsByName('recommendMode');
        modeRadios.forEach(r => {
            if (r.value === featureConfig.recommendQuestions.mode) {
                r.checked = true;
            }
        });
        document.getElementById('feature-fixed-questions-container').classList.toggle('hidden', featureConfig.recommendQuestions.mode !== 'fixed');
        renderFixedQuestions();
    }
    
    // Reference Source
    const rsToggle = document.getElementById('feature-reference-source-toggle');
    if (rsToggle) {
        rsToggle.checked = featureConfig.referenceSource ? featureConfig.referenceSource.enabled : false;
    }
    
    // Update track and label colors
    ['context-memory', 'recommend-questions', 'reference-source'].forEach(name => {
        const toggleEl = document.getElementById(`feature-${name}-toggle`);
        if (toggleEl) {
            const isFeatureActive = toggleEl.checked;
            toggleEl.setAttribute('aria-pressed', isFeatureActive ? 'true' : 'false');
            
            const trackEl = document.getElementById(`feature-${name}-track`);
            if (trackEl) trackEl.classList.toggle('is-active', isFeatureActive);
            
            const labelEl = document.getElementById(`feature-${name}-label`);
            if (labelEl) labelEl.classList.toggle('is-active', isFeatureActive);
        }
    });
}

// Auto-load config on DOMContentLoaded or view-loaded
document.addEventListener('DOMContentLoaded', loadFeatureConfig);

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator-editor') {
        window.initOrchestratorEditor(e.detail.params);
        loadFeatureConfig();
    }
});
