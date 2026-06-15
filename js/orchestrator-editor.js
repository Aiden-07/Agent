// Orchestrator Editor Logic

let currentOrchId = null;
let isOrchDirty = false;
let databaseQueryMoreMenuOpen = false;
let inlineHintTooltipEl = null;
let inlineHintTooltipTarget = null;
let inlineHintTooltipSetup = false;
let orchCanvasInteractionSetup = false;
let activeNodeSettingsNodeId = null;
let orchCanvasViewport = {
    scale: 1,
    panX: 0,
    panY: 0
};
let orchCanvasPanState = {
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
};

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
    
    renderKnowledgeNodeSummary();
    resetOrchCanvasViewport();
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
    setupInlineHintTooltips();
    setupOrchCanvasInteractions();

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
    
    const canvas = getOrchCanvasStage();
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
            const world = getOrchCanvasWorldPoint(e.clientX, e.clientY, rect);
            const dropX = world.x;
            const dropY = world.y;

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

            if (nodeType === 'database-query') {
                addDatabaseQueryNodeToCanvas({ x: dropX, y: dropY });
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
    const canvas = getOrchCanvasContent();
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

function createDefaultDatabaseQueryConfig() {
    return {
        nodeName: '数据库查询',
        description: '执行只读 SQL 查询并输出结构化结果',
        datasourceId: '',
        sqlMode: 'inline',
        sql: `SELECT region, SUM(pay_amount) AS total_amount
FROM orders
GROUP BY region
ORDER BY total_amount DESC
LIMIT 10;`,
        variableRef: '{{llm1.output.sql}}',
        limit: 100,
        timeout: 30,
        maxRetries: 0,
        outputFormat: 'table',
        includeFields: true,
        recordLog: true,
        inputParams: [],
        lastRun: null
    };
}

function normalizeDatabaseQueryInputParams(inputParams = []) {
    return (Array.isArray(inputParams) ? inputParams : [])
        .map((item, index) => ({
            id: item.id || `param_${index + 1}`,
            name: item.name || `param_${index + 1}`,
            type: item.type || 'String',
            source: item.source || '{{start.query}}',
            required: item.required !== false
        }))
        .filter(item => item.name);
}

function createDatabaseQueryInputParam(index = 1) {
    return {
        id: `param_${Date.now()}_${index}`,
        name: `param_${index}`,
        type: 'String',
        source: '{{start.query}}',
        required: true
    };
}

function addDatabaseQueryNodeToCanvas(pos) {
    const canvas = getOrchCanvasContent();
    if (!canvas) return;

    const id = newOrchNodeId('DBQ');
    const nodeData = {
        id,
        type: 'database-query',
        name: '数据库查询',
        config: createDefaultDatabaseQueryConfig()
    };
    upsertOrchNode(nodeData);

    const node = document.createElement('button');
    node.type = 'button';
    node.dataset.orchNodeId = id;
    node.dataset.orchNodeType = 'database-query';
    node.className = 'absolute w-44 bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col gap-2 hover:border-blue-500 hover:shadow-md transition-shadow cursor-pointer text-left';
    node.style.left = `${Math.max(12, pos.x - 88)}px`;
    node.style.top = `${Math.max(70, pos.y - 20)}px`;
    node.style.zIndex = '30';

    node.innerHTML = getDatabaseQueryCanvasNodeHTML(nodeData);
    node.onclick = () => window.openNodeSettings('database-query', { nodeId: id });
    canvas.appendChild(node);
}

function getDatabaseQueryCanvasNodeHTML(nodeData) {
    const config = nodeData?.config || {};
    const status = config.lastRun?.status;
    const subtitle = status === 'success'
        ? `${config.lastRun.row_count || 0} 行 · ${config.lastRun.execution_time || ''}`
        : status === 'failed'
            ? '执行失败'
            : (config.datasourceId ? '已选择数据源' : '未配置数据源');
    const statusClass = status === 'success'
        ? 'text-green-600'
        : status === 'failed'
            ? 'text-red-600'
            : 'text-gray-400';
    return `
        <div class="flex items-center gap-2 border-b border-gray-100 pb-2">
            <div class="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                <i class="fa-solid fa-database" aria-hidden="true"></i>
            </div>
            <span class="text-sm font-medium text-gray-800 truncate">${escapeHtml(config.nodeName || '数据库查询')}</span>
        </div>
        <div class="text-xs ${statusClass} truncate">${escapeHtml(subtitle)}</div>
    `;
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
    const canvas = getOrchCanvasContent();
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

function getInlineHintHTML(message) {
    const text = escapeHtml(message);
    return `
        <button type="button" class="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-help" tabindex="0" aria-label="${text}" data-inline-hint="${text}">
            <i class="fa-solid fa-circle-exclamation text-[13px]" aria-hidden="true"></i>
        </button>
    `;
}

function getOrchCanvasStage() {
    return document.getElementById('orch-canvas-stage') || document.getElementById('orch-canvas');
}

function getOrchCanvasContent() {
    return document.getElementById('orch-canvas-content') || getOrchCanvasStage();
}

function syncOrchCanvasViewport() {
    const content = getOrchCanvasContent();
    if (!content) return;
    content.style.transformOrigin = '0 0';
    content.style.transform = `translate(${orchCanvasViewport.panX}px, ${orchCanvasViewport.panY}px) scale(${orchCanvasViewport.scale})`;
}

function getOrchCanvasWorldPoint(clientX, clientY, stageRect = null) {
    const stage = getOrchCanvasStage();
    if (!stage) return { x: clientX, y: clientY };
    const rect = stageRect || stage.getBoundingClientRect();
    return {
        x: (clientX - rect.left - orchCanvasViewport.panX) / orchCanvasViewport.scale,
        y: (clientY - rect.top - orchCanvasViewport.panY) / orchCanvasViewport.scale
    };
}

function zoomOrchCanvasAt(clientX, clientY, factor) {
    const stage = getOrchCanvasStage();
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const nextScale = Math.max(0.45, Math.min(2.4, orchCanvasViewport.scale * factor));
    const world = getOrchCanvasWorldPoint(clientX, clientY, rect);

    orchCanvasViewport.scale = nextScale;
    orchCanvasViewport.panX = clientX - rect.left - (world.x * nextScale);
    orchCanvasViewport.panY = clientY - rect.top - (world.y * nextScale);

    syncOrchCanvasViewport();
}

function zoomOrchCanvasByFactor(factor, anchorX = null, anchorY = null) {
    const stage = getOrchCanvasStage();
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const centerX = anchorX ?? (rect.left + rect.width / 2);
    const centerY = anchorY ?? (rect.top + rect.height / 2);
    zoomOrchCanvasAt(centerX, centerY, factor);
}

function resetOrchCanvasViewport() {
    orchCanvasViewport.scale = 1;
    orchCanvasViewport.panX = 0;
    orchCanvasViewport.panY = 0;
    syncOrchCanvasViewport();
}

function setupOrchCanvasInteractions() {
    if (orchCanvasInteractionSetup) return;
    orchCanvasInteractionSetup = true;

    document.addEventListener('wheel', (event) => {
        if (!(event.target instanceof Element)) return;
        const stage = event.target.closest('#orch-canvas-stage');
        if (!stage) return;
        if (event.target.closest('#node-settings-drawer')) return;
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
        }
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
        zoomOrchCanvasAt(event.clientX, event.clientY, zoomFactor);
    }, { passive: false });

    document.addEventListener('mousedown', (event) => {
        if (event.button !== 1) return;
        if (!(event.target instanceof Element)) return;
        const stage = event.target.closest('#orch-canvas-stage');
        if (!stage) return;
        const isInteractive = event.target.closest('#node-settings-drawer, .feature-config-menu, #dsl-dropdown-menu, #feature-config-menu');
        if (isInteractive) return;
        event.preventDefault();
        orchCanvasPanState = {
            active: true,
            startX: event.clientX,
            startY: event.clientY,
            startPanX: orchCanvasViewport.panX,
            startPanY: orchCanvasViewport.panY
        };
        stage.classList.add('cursor-grabbing');
    });

    document.addEventListener('mousemove', (event) => {
        if (!orchCanvasPanState.active) return;
        const stageEl = getOrchCanvasStage();
        if (!stageEl) return;
        const dx = event.clientX - orchCanvasPanState.startX;
        const dy = event.clientY - orchCanvasPanState.startY;
        orchCanvasViewport.panX = orchCanvasPanState.startPanX + dx;
        orchCanvasViewport.panY = orchCanvasPanState.startPanY + dy;
        syncOrchCanvasViewport();
    });

    document.addEventListener('mouseup', () => {
        if (!orchCanvasPanState.active) return;
        orchCanvasPanState.active = false;
        const stageEl = getOrchCanvasStage();
        stageEl?.classList.remove('cursor-grabbing');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Delete' && event.key !== 'Backspace') return;
        if (isTypingContext(document.activeElement)) return;
        const target = getCurrentDeletableOrchNodeTarget();
        if (!target) return;
        event.preventDefault();
        deleteOrchNodeTarget(target);
    });

    document.addEventListener('view-loaded', () => {
        syncOrchCanvasViewport();
    });

    syncOrchCanvasViewport();
}

function isTypingContext(element) {
    if (!element || !(element instanceof Element)) return false;
    if (element.isContentEditable) return true;
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function getCurrentDeletableOrchNodeTarget() {
    const active = document.activeElement;
    if (active instanceof Element) {
        const focusedNode = active.closest('[data-orch-node-id], [data-orch-static-node-type]');
        if (focusedNode) return focusedNode;
    }
    if (activeNodeSettingsNodeId) {
        return document.querySelector(`[data-orch-node-id="${CSS.escape(activeNodeSettingsNodeId)}"]`);
    }
    if (activeNodeSettingsType) {
        return document.querySelector(`[data-orch-static-node-type="${CSS.escape(activeNodeSettingsType)}"]`);
    }
    return null;
}

function removeOrchCanvasNodeById(nodeId) {
    ensureOrchCanvasNodesLoaded();
    if (!nodeId) return false;
    if (orchCanvasNodes[nodeId]) {
        delete orchCanvasNodes[nodeId];
        saveOrchCanvasNodes();
    }
    document.querySelector(`[data-orch-node-id="${CSS.escape(nodeId)}"]`)?.remove();
    return true;
}

function deleteOrchNodeTarget(target) {
    if (!target) return false;

    const nodeId = target.dataset.orchNodeId || '';
    if (nodeId) {
        const node = getOrchNodeById(nodeId);
        const label = node?.config?.nodeName || node?.name || target.querySelector('.text-sm')?.textContent || '该节点';
        if (!confirm(`确认删除“${label}”节点？`)) return false;
        removeOrchCanvasNodeById(nodeId);
        if (activeNodeSettingsNodeId === nodeId) {
            window.closeNodeSettings();
        }
        return true;
    }

    const staticType = target.dataset.orchStaticNodeType || '';
    if (staticType) {
        const staticLabels = {
            input: '开始输入',
            knowledge: '检索知识库',
            llm: '大模型处理',
            optimize: '结果优化',
            output: '最终输出'
        };
        if (!confirm(`确认删除“${staticLabels[staticType] || '该节点'}”节点？`)) return false;
        target.remove();
        if (activeNodeSettingsType === staticType) {
            window.closeNodeSettings();
        }
        return true;
    }

    return false;
}

function ensureInlineHintTooltip() {
    if (inlineHintTooltipEl && document.body.contains(inlineHintTooltipEl)) {
        return inlineHintTooltipEl;
    }

    let tooltip = document.getElementById('global-inline-hint-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-inline-hint-tooltip';
        tooltip.className = 'fixed z-[9999] hidden rounded-md bg-gray-900 px-3 py-2 text-left text-xs leading-5 text-white shadow-lg pointer-events-none';
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.transform = 'translate(-50%, 0)';
        tooltip.style.maxWidth = '280px';
        tooltip.style.willChange = 'left, top';
        document.body.appendChild(tooltip);
    }

    inlineHintTooltipEl = tooltip;
    return tooltip;
}

function positionInlineHintTooltip(target) {
    const tooltip = ensureInlineHintTooltip();
    if (!tooltip || !target) return;

    const text = target.getAttribute('data-inline-hint') || target.getAttribute('aria-label') || '';
    if (!text) return;

    const rect = target.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const maxWidth = Math.max(160, Math.min(280, window.innerWidth - margin * 2));

    tooltip.textContent = text;
    tooltip.style.maxWidth = `${maxWidth}px`;
    tooltip.style.display = 'block';
    tooltip.classList.remove('hidden');
    tooltip.style.visibility = 'hidden';

    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    let centerX = rect.left + (rect.width / 2);
    centerX = Math.max(margin + (width / 2), Math.min(window.innerWidth - margin - (width / 2), centerX));

    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
        top = rect.top - height - gap;
    }
    top = Math.max(margin, top);

    tooltip.style.left = `${centerX}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';
}

function showInlineHintTooltip(target) {
    if (!target) return;
    inlineHintTooltipTarget = target;
    positionInlineHintTooltip(target);
}

function hideInlineHintTooltip() {
    inlineHintTooltipTarget = null;
    if (inlineHintTooltipEl) {
        inlineHintTooltipEl.classList.add('hidden');
        inlineHintTooltipEl.style.visibility = 'hidden';
    }
}

function setupInlineHintTooltips() {
    if (inlineHintTooltipSetup) return;
    inlineHintTooltipSetup = true;

    const findHintTarget = (node) => node instanceof Element ? node.closest('[data-inline-hint]') : null;

    document.addEventListener('pointerover', (event) => {
        const target = findHintTarget(event.target);
        if (!target) return;
        if (inlineHintTooltipTarget !== target) {
            showInlineHintTooltip(target);
        }
    }, true);

    document.addEventListener('pointerout', (event) => {
        const target = findHintTarget(event.target);
        if (!target) return;
        const relatedTarget = findHintTarget(event.relatedTarget);
        if (relatedTarget === target) return;
        if (inlineHintTooltipTarget === target) {
            hideInlineHintTooltip();
        }
    }, true);

    document.addEventListener('focusin', (event) => {
        const target = findHintTarget(event.target);
        if (!target) return;
        showInlineHintTooltip(target);
    });

    document.addEventListener('focusout', (event) => {
        const target = findHintTarget(event.target);
        if (!target) return;
        if (inlineHintTooltipTarget === target) {
            hideInlineHintTooltip();
        }
    });

    window.addEventListener('scroll', () => {
        if (inlineHintTooltipTarget) {
            positionInlineHintTooltip(inlineHintTooltipTarget);
        }
    }, true);

    window.addEventListener('resize', () => {
        if (inlineHintTooltipTarget) {
            positionInlineHintTooltip(inlineHintTooltipTarget);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideInlineHintTooltip();
        }
    });
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

// ==================== Database Query Config ====================
function getDatabaseQueryNode(nodeId) {
    const node = getOrchNodeById(nodeId);
    if (!node) return null;
    if (!node.config) node.config = createDefaultDatabaseQueryConfig();
    const legacySqlMode = node.config.sqlMode;
    node.config = { ...createDefaultDatabaseQueryConfig(), ...node.config };
    if (legacySqlMode === 'variable') {
        node.config.sql = node.config.variableRef || node.config.sql || '{{llm1.output.sql}}';
    }
    node.config.sqlMode = 'inline';
    node.config.inputParams = normalizeDatabaseQueryInputParams(node.config.inputParams);
    return node;
}

function persistDatabaseQueryNode(node) {
    if (!node) return;
    node.name = node.config?.nodeName || '数据库查询';
    upsertOrchNode(node);
    const canvasNode = document.querySelector(`[data-orch-node-id="${node.id}"]`);
    if (canvasNode) {
        canvasNode.innerHTML = getDatabaseQueryCanvasNodeHTML(node);
    }
}

window.updateDatabaseQuerySetting = function(nodeId, key, value) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    if (['limit', 'timeout', 'maxRetries'].includes(key)) {
        const min = key === 'maxRetries' ? 0 : 1;
        const max = key === 'limit'
            ? (window.VAgentDataSourceStore?.MAX_ROW_LIMIT || 1000)
            : key === 'maxRetries'
                ? 5
                : 120;
        const fallback = key === 'limit' ? 100 : key === 'maxRetries' ? 0 : 30;
        let num = Number(value);
        if (!Number.isFinite(num)) num = fallback;
        node.config[key] = Math.max(min, Math.min(max, num));
    } else if (['includeFields', 'recordLog'].includes(key)) {
        node.config[key] = !!value;
    } else {
        node.config[key] = value;
    }
    node.config.updatedAt = new Date().toLocaleString();
    persistDatabaseQueryNode(node);
};

window.addDatabaseQueryInput = function(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    const inputs = normalizeDatabaseQueryInputParams(node.config.inputParams);
    inputs.push(createDatabaseQueryInputParam(inputs.length + 1));
    node.config.inputParams = inputs;
    node.config.updatedAt = new Date().toLocaleString();
    persistDatabaseQueryNode(node);
    window.openNodeSettings('database-query', { nodeId });
};

window.updateDatabaseQueryInput = function(nodeId, inputId, key, value) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    node.config.inputParams = normalizeDatabaseQueryInputParams(node.config.inputParams).map(item => {
        if (item.id !== inputId) return item;
        if (key === 'required') return { ...item, required: !!value };
        if (key === 'name') {
            const normalizedName = String(value || '').trim().replace(/[^\w.]/g, '_');
            return { ...item, name: normalizedName || item.name };
        }
        return { ...item, [key]: value };
    });
    node.config.updatedAt = new Date().toLocaleString();
    persistDatabaseQueryNode(node);
};

window.removeDatabaseQueryInput = function(nodeId, inputId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    node.config.inputParams = normalizeDatabaseQueryInputParams(node.config.inputParams).filter(item => item.id !== inputId);
    node.config.updatedAt = new Date().toLocaleString();
    persistDatabaseQueryNode(node);
    window.openNodeSettings('database-query', { nodeId });
};

window.setDatabaseQuerySqlMode = function(nodeId, mode) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    if (mode === 'variable') {
        node.config.sql = node.config.variableRef || '{{llm1.output.sql}}';
    }
    node.config.sqlMode = 'inline';
    node.config.lastRun = null;
    persistDatabaseQueryNode(node);
    window.openNodeSettings('database-query', { nodeId });
};

window.refreshDatabaseQueryDatasource = function(nodeId, value) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    node.config.datasourceId = value;
    node.config.lastRun = null;
    persistDatabaseQueryNode(node);
    window.openNodeSettings('database-query', { nodeId });
};

window.insertDatabaseSqlVariable = function(nodeId, variableValue) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    const textarea = document.getElementById(`database-query-sql-${nodeId}`);
    if (textarea) {
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || textarea.value.length;
        textarea.value = `${textarea.value.slice(0, start)}${variableValue}${textarea.value.slice(end)}`;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variableValue.length;
        node.config.sql = textarea.value;
    }
    persistDatabaseQueryNode(node);
};

function getDatabaseQueryValidation(node) {
    if (!window.VAgentDataSourceStore) {
        return { valid: false, errorType: 'STORE_MISSING', message: '数据源能力未加载。' };
    }
    if (!node.config.datasourceId) {
        return { valid: false, errorType: 'DATASOURCE_REQUIRED', message: '请选择数据源。' };
    }
    const datasource = window.VAgentDataSourceStore.getDataSourceById(node.config.datasourceId);
    if (!datasource) {
        return { valid: false, errorType: 'DATASOURCE_NOT_FOUND', message: '数据源不存在，请重新选择。' };
    }
    if (datasource.status === 'disabled') {
        return { valid: false, errorType: 'DATASOURCE_DISABLED', message: '当前数据源已停用，无法执行查询。' };
    }
    if (datasource.status === 'failed') {
        return { valid: false, errorType: 'DATASOURCE_CONNECTION_FAILED', message: '当前数据源不可用，请更换数据源或联系管理员处理。' };
    }
    const resolved = window.VAgentDataSourceStore.resolveSqlInput
        ? window.VAgentDataSourceStore.resolveSqlInput(node.config.sql)
        : { valid: true, sql: node.config.sql };
    if (!resolved.valid) {
        return resolved;
    }
    return window.VAgentDataSourceStore.validateSql(resolved.sql);

    if (node.config.sqlMode === 'variable') {
        const sql = window.VAgentDataSourceStore.resolveVariableSql(node.config.variableRef);
        if (!sql) {
            return { valid: false, errorType: 'UPSTREAM_SQL_EMPTY', message: 'SQL 来源变量为空，请检查上游节点输出。' };
        }
        return window.VAgentDataSourceStore.validateSql(sql);
    }
    return window.VAgentDataSourceStore.validateSql(node.config.sql);
}

window.validateDatabaseQueryNode = function(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    const result = getDatabaseQueryValidation(node);
    const target = document.getElementById(`database-query-validation-${nodeId}`);
    if (!target) return;
    target.classList.remove('hidden', 'border-green-100', 'bg-green-50', 'text-green-700', 'border-red-100', 'bg-red-50', 'text-red-700');
    if (result.valid) {
        target.classList.add('border-green-100', 'bg-green-50', 'text-green-700');
        target.innerHTML = '<i class="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>SQL 安全校验通过。';
    } else {
        target.classList.add('border-red-100', 'bg-red-50', 'text-red-700');
        target.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>${escapeHtml(result.message)}`;
    }
};

window.runDatabaseQueryNode = function(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node || !window.VAgentDataSourceStore) return;
    const result = window.VAgentDataSourceStore.executeMockQuery({
        workflowId: currentOrchId || 'WF-DEMO',
        nodeId,
        datasourceId: node.config.datasourceId,
        sqlMode: 'inline',
        sql: node.config.sql,
        variableRef: node.config.variableRef,
        limit: node.config.limit,
        timeout: node.config.timeout,
        maxRetries: node.config.maxRetries
    });
    node.config.lastRun = result;
    persistDatabaseQueryNode(node);
    window.openNodeSettings('database-query', { nodeId });
};

window.toggleDatabaseQueryMoreMenu = function() {
    databaseQueryMoreMenuOpen = !databaseQueryMoreMenuOpen;
    const menu = document.getElementById('database-query-more-menu');
    if (menu) menu.classList.toggle('hidden', !databaseQueryMoreMenuOpen);
};

window.copyDatabaseQueryNode = function(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    const canvasNode = document.querySelector(`[data-orch-node-id="${nodeId}"]`);
    const id = newOrchNodeId('DBQ');
    const copied = {
        ...cloneJson(node),
        id,
        name: `${node.name || '数据库查询'} 副本`,
        config: {
            ...cloneJson(node.config),
            nodeName: `${node.config?.nodeName || '数据库查询'} 副本`,
            lastRun: null
        }
    };
    upsertOrchNode(copied);
    if (canvasNode) {
        const rectLeft = parseInt(canvasNode.style.left || '120', 10);
        const rectTop = parseInt(canvasNode.style.top || '120', 10);
        const next = document.createElement('button');
        next.type = 'button';
        next.dataset.orchNodeId = id;
        next.dataset.orchNodeType = 'database-query';
        next.className = canvasNode.className;
        next.style.left = `${rectLeft + 32}px`;
        next.style.top = `${rectTop + 32}px`;
        next.style.zIndex = '30';
        next.innerHTML = getDatabaseQueryCanvasNodeHTML(copied);
        next.onclick = () => window.openNodeSettings('database-query', { nodeId: id });
        canvasNode.parentElement?.appendChild(next);
    }
    databaseQueryMoreMenuOpen = false;
    window.openNodeSettings('database-query', { nodeId: id });
};

window.deleteDatabaseQueryNode = function(nodeId) {
    if (!confirm('确认删除该数据库查询节点？')) return;
    removeOrchCanvasNodeById(nodeId);
    databaseQueryMoreMenuOpen = false;
    window.closeNodeSettings();
};

window.deleteCurrentOpenedNode = function() {
    const target = getCurrentDeletableOrchNodeTarget();
    if (!target) return;
    deleteOrchNodeTarget(target);
};

window.saveDatabaseQueryNode = function(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    if (!node) return;
    const result = getDatabaseQueryValidation(node);
    if (!result.valid) {
        window.validateDatabaseQueryNode(nodeId);
        return;
    }
    persistDatabaseQueryNode(node);
    window.closeNodeSettings();
};

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

    const knowledgeSettings = activeNodeSettingsType === 'knowledge' && knowledgeNodeDraft
        ? normalizeKnowledgeSettings(knowledgeNodeDraft)
        : loadKnowledgeNodeSettings();
    const knowledgeIssues = getKnowledgeSettingsIssues(knowledgeSettings);
    if (knowledgeIssues.length) {
        if (activeNodeSettingsType === 'knowledge') {
            activeKnowledgeFilterGroupId = getFirstKnowledgeIssueGroupId(knowledgeSettings) || activeKnowledgeFilterGroupId;
            knowledgeNodeDraft = cloneJson(knowledgeSettings);
            renderKnowledgeSettingsContent();
        }
        reportKnowledgeSettingsIssues(knowledgeIssues, '发布');
        return;
    }
    
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
const ORCH_KNOWLEDGE_SETTINGS_KEY = 'vagent_orch_knowledge_node_settings_v2';
let activeNodeSettingsType = null;
let knowledgeNodeDraft = null;
let activeKnowledgeFilterGroupId = null;
let knowledgeBasePickerOpen = false;
let knowledgeBasePickerSelection = new Set();
let knowledgeBasePickerSearch = '';
let knowledgeVariableMenuIndex = null;

const KNOWLEDGE_BASE_FALLBACKS = [
    { id: 'kb-test', name: '测试专用', description: '用于内部测试与效果验证' },
    { id: 'kb-bryant-slice', name: 'Bryant切片知识库1', description: '切片检索知识库' },
    { id: 'kb-service', name: '客服问答知识库', description: '常见问题与标准答复' },
    { id: 'kb-policy', name: '规章制度库', description: '企业制度、规范与流程文件' }
];

const WORKFLOW_VARIABLE_OPTIONS = [
    { name: '开始节点.query', value: '{{start.query}}' },
    { name: '开始节点.userId', value: '{{start.userId}}' },
    { name: '用户信息.department', value: '{{user.department}}' },
    { name: '用户信息.rank', value: '{{user.rank}}' }
];

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function getKnowledgeSettingsStorageId() {
    return currentOrchId || 'default';
}

function getAvailableKnowledgeBases() {
    let source = [];

    if (window.VAgentKnowledgeStore) {
        source = window.VAgentKnowledgeStore.loadKnowledgeBases();
    }
    if (!source.length && typeof knowledgeData !== 'undefined' && Array.isArray(knowledgeData) && knowledgeData.length > 0) {
        source = knowledgeData;
    }
    if (!source.length && Array.isArray(window.knowledgeData) && window.knowledgeData.length > 0) {
        source = window.knowledgeData;
    }
    if (!source.length) {
        source = KNOWLEDGE_BASE_FALLBACKS;
    }

    return source.map((item, index) => ({
        id: String(item.id || `kb-${index + 1}`),
        name: item.name || item.title || `知识库 ${index + 1}`,
        description: item.description || item.desc || '知识库',
        enabled: item.enabled !== false && item.isEnabled !== false && String(item.status || '').toLowerCase() !== 'disabled',
        isEnabled: item.enabled !== false && item.isEnabled !== false && String(item.status || '').toLowerCase() !== 'disabled',
        status: item.enabled === false || item.isEnabled === false || String(item.status || '').toLowerCase() === 'disabled' ? 'disabled' : (item.status || 'active')
    }));
}

function isKnowledgeBaseUsable(kb) {
    if (!kb) return false;
    const status = String(kb.status || '').toLowerCase();
    return kb.enabled !== false && kb.isEnabled !== false && !['disabled', 'inactive', 'stopped'].includes(status);
}

function findKnowledgeFieldMeta(field, kbId = null) {
    const fields = getKnowledgeFieldOptions(kbId);
    const matched = fields.find(item => item.value === field);
    if (matched || kbId) return matched || null;
    return FIELD_OPTIONS.find(item => item.value === field) || null;
}

function getKnowledgeConditionIssues(condition, kbId = null) {
    const issues = [];
    if (!condition) return issues;
    const fieldMeta = findKnowledgeFieldMeta(condition.field, kbId);
    if (!fieldMeta) {
        const fieldLabel = condition.fieldLabel || condition.field || '原字段';
        issues.push(`字段已删除：${fieldLabel}，请重新选择字段或删除该条件`);
        return issues;
    }
    const operators = getKnowledgeOperatorOptions(condition.field, kbId);
    if (condition.operator && !operators.some(item => item.value === condition.operator)) {
        issues.push('操作符不适用，请重新选择操作符');
    }
    return issues;
}

function getKnowledgeGroupIssues(kb, group) {
    const issues = [];
    if (!isKnowledgeBaseUsable(kb)) {
        issues.push('知识库已停用，请重新启用或更换知识库');
    }
    if (group?.enabled && Array.isArray(group.conditions)) {
        group.conditions.forEach(condition => {
            issues.push(...getKnowledgeConditionIssues(condition, kb?.id));
        });
    }
    return Array.from(new Set(issues));
}

function getKnowledgeSettingsIssues(settings) {
    const issues = [];
    const config = settings || loadKnowledgeNodeSettings();
    (config.knowledgeBases || []).forEach(kb => {
        const group = config.filterGroups?.[kb.id];
        issues.push(...getKnowledgeGroupIssues(kb, group));
    });
    return Array.from(new Set(issues));
}

function getFirstKnowledgeIssueGroupId(settings) {
    const config = settings || loadKnowledgeNodeSettings();
    const target = (config.knowledgeBases || []).find(kb => {
        const group = config.filterGroups?.[kb.id];
        return getKnowledgeGroupIssues(kb, group).length > 0;
    });
    return target?.id || null;
}

function reportKnowledgeSettingsIssues(issues, action = '执行') {
    const message = `知识库过滤配置存在异常，无法${action}。请重新选择字段/操作符，或删除异常条件。`;
    updateSaveStatus('配置异常');
    if (typeof window.showToast === 'function') {
        window.showToast(message, 'error');
    } else {
        alert(`${message}\n${issues.join('\n')}`);
    }
}

function createDefaultKnowledgeSettings() {
    const knowledgeBases = getAvailableKnowledgeBases().slice(0, 2);
    const filterGroups = {};
    knowledgeBases.forEach(kb => {
        filterGroups[kb.id] = {
            enabled: false,
            logic: 'and',
            conditions: []
        };
    });

    return {
        nodeName: '知识库1',
        description: '',
        input: '内置变量 /query',
        knowledgeBases,
        topK: 5,
        similarityThreshold: 0.88,
        filterEnabled: false,
        filterGroups
    };
}

function normalizeKnowledgeCondition(condition = {}, kbId = null) {
    const defaultField = getKnowledgeFieldOptions(kbId)[0]?.value || FIELD_OPTIONS[0].value;
    const field = condition.field || defaultField;
    const fieldMeta = findKnowledgeFieldMeta(field, kbId);
    const operators = fieldMeta ? getKnowledgeOperatorOptions(field, kbId) : OPERATOR_OPTIONS.text;
    const operator = condition.operator || operators[0].value;

    return {
        field,
        operator,
        fieldLabel: fieldMeta?.label || condition.fieldLabel || field,
        valueType: condition.valueType === 'variable' ? 'variable' : 'fixed',
        value: condition.value || ''
    };
}

function normalizeKnowledgeSettings(settings = {}) {
    const fallback = createDefaultKnowledgeSettings();
    const availableKnowledgeBases = getAvailableKnowledgeBases();
    const availableMap = new Map(availableKnowledgeBases.map(kb => [kb.id, kb]));
    const knowledgeBases = Array.isArray(settings.knowledgeBases)
        ? settings.knowledgeBases.map((item, index) => ({
            id: String(item.id || `kb-${index + 1}`),
            name: item.name || item.title || `知识库 ${index + 1}`,
            description: item.description || item.desc || '知识库'
        }))
            .map(kb => availableMap.get(kb.id) || kb)
            .filter(kb => availableMap.size === 0 || availableMap.has(kb.id))
        : fallback.knowledgeBases;
    const savedGroups = settings.filterGroups || {};
    const filterGroups = {};

    knowledgeBases.forEach(kb => {
        const group = savedGroups[kb.id] || {};
        filterGroups[kb.id] = {
            enabled: !!group.enabled,
            logic: group.logic === 'or' ? 'or' : 'and',
            conditions: Array.isArray(group.conditions)
                ? group.conditions.map(condition => normalizeKnowledgeCondition(condition, kb.id))
                : []
        };
    });

    return {
        nodeName: settings.nodeName || fallback.nodeName,
        description: settings.description || '',
        input: settings.input || fallback.input,
        knowledgeBases,
        topK: Number(settings.topK) || fallback.topK,
        similarityThreshold: Number(settings.similarityThreshold) || fallback.similarityThreshold,
        filterEnabled: !!settings.filterEnabled,
        filterGroups
    };
}

function loadKnowledgeNodeSettings() {
    try {
        const raw = localStorage.getItem(ORCH_KNOWLEDGE_SETTINGS_KEY);
        const store = raw ? JSON.parse(raw) : {};
        return normalizeKnowledgeSettings(store[getKnowledgeSettingsStorageId()] || {});
    } catch (e) {
        return createDefaultKnowledgeSettings();
    }
}

function persistKnowledgeNodeSettings(settings) {
    try {
        const raw = localStorage.getItem(ORCH_KNOWLEDGE_SETTINGS_KEY);
        const store = raw ? JSON.parse(raw) : {};
        store[getKnowledgeSettingsStorageId()] = normalizeKnowledgeSettings(settings);
        localStorage.setItem(ORCH_KNOWLEDGE_SETTINGS_KEY, JSON.stringify(store));
    } catch (e) {
        console.error('Failed to persist knowledge node settings', e);
    }
}

function renderKnowledgeNodeSummary(settings = null) {
    const config = settings || loadKnowledgeNodeSettings();
    const title = document.getElementById('knowledge-node-title');
    const summary = document.getElementById('knowledge-node-summary');
    if (title) title.textContent = config.nodeName || '检索知识库';
    if (summary) {
        const issues = getKnowledgeSettingsIssues(config);
        const count = config.knowledgeBases.length;
        const enabledCount = Object.values(config.filterGroups).filter(group => group.enabled).length;
        summary.classList.toggle('text-red-500', issues.length > 0);
        summary.classList.toggle('text-gray-400', issues.length === 0);
        summary.textContent = issues.length > 0
            ? `配置异常 · ${issues.length} 项需处理`
            : count === 0
            ? '未配置知识库'
            : `${count} 个知识库${config.filterEnabled && enabledCount > 0 ? ` · ${enabledCount} 组过滤` : ''}`;
    }
}

function ensureKnowledgeNodeDraft() {
    if (!knowledgeNodeDraft) {
        knowledgeNodeDraft = cloneJson(loadKnowledgeNodeSettings());
    }
    return knowledgeNodeDraft;
}

function renderKnowledgeSettingsContent() {
    const content = document.getElementById('drawer-content');
    if (!content) return;
    content.innerHTML = activeKnowledgeFilterGroupId
        ? getKnowledgeFilterGroupSettingsHTML(activeKnowledgeFilterGroupId)
        : getKnowledgeNodeSettingsHTML();
}

function refreshKnowledgeNodeDraftFromSharedData() {
    if (!knowledgeNodeDraft) return;
    knowledgeNodeDraft = normalizeKnowledgeSettings(knowledgeNodeDraft);
    if (activeKnowledgeFilterGroupId && !knowledgeNodeDraft.filterGroups[activeKnowledgeFilterGroupId]) {
        activeKnowledgeFilterGroupId = null;
    }
    renderKnowledgeNodeSummary(knowledgeNodeDraft);
    if (activeNodeSettingsType === 'knowledge') {
        renderKnowledgeSettingsContent();
    }
}

window.openNodeSettings = function(type, ctx = null) {
    const drawer = document.getElementById('node-settings-drawer');
    const content = document.getElementById('drawer-content');
    const title = document.getElementById('drawer-title');
    const actions = document.getElementById('drawer-actions');
    
    if (!drawer || !content || !title) return;
    
    activeNodeSettingsType = type;
    if (type === 'knowledge') {
        knowledgeNodeDraft = cloneJson(loadKnowledgeNodeSettings());
        activeKnowledgeFilterGroupId = null;
        closeKnowledgeBasePickerModal();
        knowledgeVariableMenuIndex = null;
        activeNodeSettingsNodeId = null;
    }

    // Set Title
    const titleMap = {
        'input': '开始输入设置',
        'knowledge': '知识库1',
        'llm': '大模型处理设置',
        'dialog-interaction': '对话交互设置',
        'database-query': '数据库查询设置',
        'optimize': '结果优化设置',
        'output': '最终输出设置'
    };
    if (type === 'knowledge') {
        title.innerHTML = `
            <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-500 mr-2">
                <i class="fa-solid fa-book text-xs" aria-hidden="true"></i>
            </span>
            <span>${escapeHtml(knowledgeNodeDraft?.nodeName || titleMap[type])}</span>
        `;
        title.className = 'font-medium text-gray-800 flex items-center';
    } else if (type === 'database-query') {
        const dbNode = ctx?.nodeId ? getDatabaseQueryNode(ctx.nodeId) : null;
        const dbNodeId = ctx?.nodeId || '';
        activeNodeSettingsNodeId = dbNodeId || null;
        databaseQueryMoreMenuOpen = false;
        title.innerHTML = `
            <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-500 mr-2">
                <i class="fa-solid fa-database text-xs" aria-hidden="true"></i>
            </span>
            <label for="database-query-title-${escapeHtml(dbNodeId)}" class="sr-only">节点名称</label>
            <input id="database-query-title-${escapeHtml(dbNodeId)}" type="text" value="${escapeHtml(dbNode?.config?.nodeName || '数据库查询')}" oninput="updateDatabaseQuerySetting('${escapeHtml(dbNodeId)}', 'nodeName', this.value)" class="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-base font-medium text-gray-800 focus:outline-none focus:ring-0 focus:bg-white/70" placeholder="数据库查询">
            ${getInlineHintHTML('节点只负责执行 SQL，不做自然语言理解。')}
        `;
        title.className = 'font-medium text-gray-800 flex flex-1 min-w-0 items-center';
    } else {
        activeNodeSettingsNodeId = null;
        title.textContent = titleMap[type] || '节点设置';
        title.className = 'font-medium text-gray-800';
    }

    if (type === 'dialog-interaction') {
        activeNodeSettingsNodeId = ctx?.nodeId || null;
    }

    if (actions) {
        if (type === 'knowledge') {
            actions.innerHTML = `
                <button type="button" onclick="testKnowledgeNodeSettings()" class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="测试运行" aria-label="测试运行">
                    <i class="fa-regular fa-circle-play text-sm" aria-hidden="true"></i>
                </button>
                <div class="h-5 border-l border-gray-200"></div>
                <button type="button" onclick="closeNodeSettings()" class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="关闭" aria-label="关闭">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            `;
        } else if (type === 'database-query') {
            const dbNodeId = ctx?.nodeId || '';
            actions.innerHTML = `
                <button type="button" onclick="runDatabaseQueryNode('${escapeHtml(dbNodeId)}')" class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="测试运行" aria-label="测试运行">
                    <i class="fa-regular fa-circle-play text-sm" aria-hidden="true"></i>
                </button>
                <div class="relative">
                    <button type="button" onclick="toggleDatabaseQueryMoreMenu()" class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="更多" aria-label="更多操作">
                        <i class="fa-solid fa-ellipsis text-sm" aria-hidden="true"></i>
                    </button>
                    <div id="database-query-more-menu" class="hidden absolute right-0 top-9 z-40 w-44 rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-xl">
                        <button type="button" onclick="saveDatabaseQueryNode('${escapeHtml(dbNodeId)}')" class="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50">
                            <i class="fa-regular fa-floppy-disk w-4 text-gray-400" aria-hidden="true"></i>保存
                        </button>
                        <button type="button" onclick="document.getElementById('database-query-title-${escapeHtml(dbNodeId)}')?.focus(); toggleDatabaseQueryMoreMenu()" class="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50">
                            <i class="fa-regular fa-pen-to-square w-4 text-gray-400" aria-hidden="true"></i>重命名
                        </button>
                        <button type="button" onclick="copyDatabaseQueryNode('${escapeHtml(dbNodeId)}')" class="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50">
                            <i class="fa-regular fa-copy w-4 text-gray-400" aria-hidden="true"></i>复制
                        </button>
                        <div class="my-1 border-t border-gray-100"></div>
                        <button type="button" onclick="deleteDatabaseQueryNode('${escapeHtml(dbNodeId)}')" class="flex w-full items-center gap-2 px-3 py-2 text-left text-red-500 hover:bg-red-50">
                            <i class="fa-regular fa-trash-can w-4" aria-hidden="true"></i>删除
                        </button>
                        <div class="mx-3 mt-1 border-t border-gray-100 pt-2 text-xs text-gray-400">
                            <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono">${escapeHtml(dbNodeId || 'DBQ')}</span>
                        </div>
                    </div>
                </div>
                <div class="h-5 border-l border-gray-200"></div>
                <button type="button" onclick="closeNodeSettings()" class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="关闭" aria-label="关闭">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            `;
        } else {
            actions.innerHTML = `
                <button onclick="closeNodeSettings()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
        }
    }
    
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
    activeNodeSettingsType = null;
    activeNodeSettingsNodeId = null;
    knowledgeNodeDraft = null;
    activeKnowledgeFilterGroupId = null;
    databaseQueryMoreMenuOpen = false;
    closeKnowledgeBasePickerModal();
    knowledgeVariableMenuIndex = null;
}

window.saveNodeSettings = function() {
    if (activeNodeSettingsType === 'knowledge') {
        window.saveKnowledgeNodeSettings();
        return;
    }

    // Mock save
    const btn = document.querySelector('button[onclick="saveNodeSettings()"]');
    if (!btn) {
        window.closeNodeSettings();
        return;
    }
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        window.closeNodeSettings();
        // Show toast ideally
        console.log('Node settings saved');
    }, 500);
}

window.saveKnowledgeNodeSettings = function() {
    const draft = normalizeKnowledgeSettings(ensureKnowledgeNodeDraft());
    const issues = getKnowledgeSettingsIssues(draft);
    if (issues.length) {
        activeKnowledgeFilterGroupId = getFirstKnowledgeIssueGroupId(draft) || activeKnowledgeFilterGroupId;
        knowledgeNodeDraft = cloneJson(draft);
        renderKnowledgeSettingsContent();
        reportKnowledgeSettingsIssues(issues, '保存');
        return;
    }
    const btn = document.getElementById('save-knowledge-node-settings');
    knowledgeNodeDraft = cloneJson(draft);
    persistKnowledgeNodeSettings(draft);
    renderKnowledgeNodeSummary(draft);
    updateSaveStatus('已保存');

    if (!btn) {
        window.closeNodeSettings();
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中';
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.closeNodeSettings();
    }, 300);
}

window.testKnowledgeNodeSettings = function() {
    const draft = normalizeKnowledgeSettings(ensureKnowledgeNodeDraft());
    const issues = getKnowledgeSettingsIssues(draft);
    if (issues.length) {
        activeKnowledgeFilterGroupId = getFirstKnowledgeIssueGroupId(draft) || activeKnowledgeFilterGroupId;
        knowledgeNodeDraft = cloneJson(draft);
        renderKnowledgeSettingsContent();
        reportKnowledgeSettingsIssues(issues, '测试');
        return;
    }
    updateSaveStatus('测试通过');
    if (typeof window.showToast === 'function') {
        window.showToast('知识库节点配置校验通过', 'success');
    } else {
        alert('知识库节点配置校验通过');
    }
}

window.updateKnowledgeSetting = function(field, value) {
    const draft = ensureKnowledgeNodeDraft();
    if (field === 'topK') {
        draft.topK = Number(value) || 1;
        const range = document.getElementById('knowledge-topk');
        const number = document.getElementById('knowledge-topk-number');
        if (range && String(range.value) !== String(draft.topK)) range.value = String(draft.topK);
        if (number && String(number.value) !== String(draft.topK)) number.value = String(draft.topK);
        return;
    }
    if (field === 'similarityThreshold') {
        draft.similarityThreshold = Number(value) || 0;
        const range = document.getElementById('knowledge-threshold');
        const number = document.getElementById('knowledge-threshold-number');
        if (range && String(range.value) !== String(draft.similarityThreshold)) range.value = String(draft.similarityThreshold);
        if (number && String(number.value) !== draft.similarityThreshold.toFixed(2)) number.value = draft.similarityThreshold.toFixed(2);
        return;
    }
    draft[field] = value;
}

window.openKnowledgeBasePicker = function() {
    const draft = ensureKnowledgeNodeDraft();
    knowledgeBasePickerOpen = true;
    knowledgeBasePickerSelection = new Set(draft.knowledgeBases.map(item => item.id));
    knowledgeBasePickerSearch = '';
    renderKnowledgeBasePickerModal();
}

window.closeKnowledgeBasePicker = function() {
    closeKnowledgeBasePickerModal();
}

function closeKnowledgeBasePickerModal() {
    knowledgeBasePickerOpen = false;
    knowledgeBasePickerSelection = new Set();
    knowledgeBasePickerSearch = '';
    const modal = document.getElementById('knowledge-base-picker-modal');
    if (modal) modal.remove();
}

window.filterKnowledgeBasePicker = function(value) {
    knowledgeBasePickerSearch = value || '';
    renderKnowledgeBasePickerModal();
}

window.toggleKnowledgeBasePickerSelection = function(id) {
    const kb = getAvailableKnowledgeBases().find(item => item.id === id);
    if (!isKnowledgeBaseUsable(kb)) return;
    if (knowledgeBasePickerSelection.has(id)) {
        knowledgeBasePickerSelection.delete(id);
    } else {
        knowledgeBasePickerSelection.add(id);
    }
    renderKnowledgeBasePickerModal();
}

window.confirmKnowledgeBasePicker = function() {
    const draft = ensureKnowledgeNodeDraft();
    const availableKnowledgeBases = getAvailableKnowledgeBases();
    const nextKnowledgeBases = availableKnowledgeBases.filter(item => knowledgeBasePickerSelection.has(item.id) && isKnowledgeBaseUsable(item));
    const nextFilterGroups = {};

    nextKnowledgeBases.forEach(kb => {
        nextFilterGroups[kb.id] = draft.filterGroups[kb.id] || {
            enabled: false,
            logic: 'and',
            conditions: []
        };
    });

    draft.knowledgeBases = nextKnowledgeBases.map(cloneJson);
    draft.filterGroups = nextFilterGroups;
    closeKnowledgeBasePickerModal();
    renderKnowledgeSettingsContent();
}

window.goToKnowledgeBaseCreationFromPicker = function() {
    closeKnowledgeBasePickerModal();
    if (typeof window.switchView === 'function') {
        window.switchView('knowledge');
        return;
    }
    window.location.hash = '#/knowledge';
}

window.removeKnowledgeBaseFromNode = function(id) {
    const draft = ensureKnowledgeNodeDraft();
    draft.knowledgeBases = draft.knowledgeBases.filter(item => item.id !== id);
    delete draft.filterGroups[id];
    if (activeKnowledgeFilterGroupId === id) activeKnowledgeFilterGroupId = null;
    renderKnowledgeSettingsContent();
}

window.setKnowledgeFilterEnabled = function(enabled) {
    ensureKnowledgeNodeDraft().filterEnabled = !!enabled;
    renderKnowledgeSettingsContent();
}

window.openKnowledgeFilterGroup = function(id) {
    const draft = ensureKnowledgeNodeDraft();
    if (!draft.filterGroups[id]) return;
    activeKnowledgeFilterGroupId = id;
    knowledgeVariableMenuIndex = null;
    renderKnowledgeSettingsContent();
}

window.closeKnowledgeFilterGroup = function() {
    activeKnowledgeFilterGroupId = null;
    knowledgeVariableMenuIndex = null;
    renderKnowledgeSettingsContent();
}

window.setKnowledgeFilterGroupEnabled = function(id, enabled) {
    const draft = ensureKnowledgeNodeDraft();
    if (!draft.filterGroups[id]) return;
    draft.filterGroups[id].enabled = !!enabled;
    renderKnowledgeSettingsContent();
}

window.setKnowledgeFilterLogic = function(logic) {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    if (!group) return;
    group.logic = logic === 'or' ? 'or' : 'and';
    renderKnowledgeSettingsContent();
}

window.addKnowledgeFilterCondition = function() {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    if (!group) return;
    const fieldOptions = getKnowledgeFieldOptions(activeKnowledgeFilterGroupId);
    const defaultField = fieldOptions[0]?.value || 'title';
    group.conditions.push(normalizeKnowledgeCondition({
        field: defaultField,
        operator: 'eq',
        valueType: 'fixed',
        value: ''
    }, activeKnowledgeFilterGroupId));
    renderKnowledgeSettingsContent();
}

window.removeKnowledgeFilterCondition = function(index) {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    if (!group) return;
    group.conditions.splice(index, 1);
    if (knowledgeVariableMenuIndex === index) knowledgeVariableMenuIndex = null;
    renderKnowledgeSettingsContent();
}

window.updateKnowledgeFilterCondition = function(index, field, value) {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    const condition = group?.conditions[index];
    if (!condition) return;

    condition[field] = value;
    if (field === 'value') {
        condition.valueType = String(value).includes('{{') ? 'variable' : 'fixed';
    }
    if (field === 'field') {
        const nextMeta = findKnowledgeFieldMeta(value, activeKnowledgeFilterGroupId);
        if (nextMeta) condition.fieldLabel = nextMeta.label;
        else delete condition.fieldLabel;
        const operators = getKnowledgeOperatorOptions(value, activeKnowledgeFilterGroupId);
        condition.operator = normalizeKnowledgeOperator(value, condition.operator, activeKnowledgeFilterGroupId);
        if (!operators.some(item => item.value === condition.operator)) {
            condition.operator = operators[0].value;
        }
        renderKnowledgeSettingsContent();
    }
    if (field === 'operator') {
        renderKnowledgeSettingsContent();
    }
}

window.setKnowledgeConditionValueType = function(index, valueType) {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    const condition = group?.conditions[index];
    if (!condition) return;
    condition.valueType = valueType === 'variable' ? 'variable' : 'fixed';
    condition.value = '';
    knowledgeVariableMenuIndex = condition.valueType === 'variable' ? index : null;
    renderKnowledgeSettingsContent();
}

window.toggleKnowledgeVariableMenu = function(index) {
    knowledgeVariableMenuIndex = knowledgeVariableMenuIndex === index ? null : index;
    renderKnowledgeSettingsContent();
}

window.selectKnowledgeVariable = function(index, value) {
    const group = ensureKnowledgeNodeDraft().filterGroups[activeKnowledgeFilterGroupId];
    const condition = group?.conditions[index];
    if (!condition) return;
    const input = document.getElementById(`knowledge-condition-value-${index}`);
    const currentValue = input ? input.value : condition.value;
    const start = input?.selectionStart ?? currentValue.length;
    const end = input?.selectionEnd ?? currentValue.length;
    condition.valueType = 'variable';
    condition.value = currentValue.substring(0, start) + value + currentValue.substring(end);
    knowledgeVariableMenuIndex = null;
    renderKnowledgeSettingsContent();
}

const FIELD_OPTIONS = [
    { label: '标题', value: 'title', type: 'text' },
    { label: '类型', value: 'type', type: 'single' },
    { label: '创建人', value: 'creator', type: 'text' },
    { label: '创建时间', value: 'create_time', type: 'date' },
    { label: '状态', value: 'status', type: 'single' },
    { label: '职责', value: 'duty', type: 'text' },
    { label: '职级', value: 'rank', type: 'number' }
];

const OPERATOR_OPTIONS = {
    text: [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'neq' },
        { label: '包含', value: 'contains' }
    ],
    number: [
        { label: '等于', value: 'eq' },
        { label: '大于', value: 'gt' },
        { label: '小于', value: 'lt' },
        { label: '介于', value: 'between' }
    ],
    date: [
        { label: '等于', value: 'eq' },
        { label: '早于', value: 'before' },
        { label: '晚于', value: 'after' },
        { label: '介于', value: 'between' },
        { label: '最近N天', value: 'recent_n_days' }
    ],
    single: [
        { label: '等于', value: 'eq' },
        { label: '属于任一', value: 'in_any' }
    ],
    multiple: [
        { label: '包含任一', value: 'contains_any' }
    ]
};

function getKnowledgeFieldOptions(kbId = null) {
    if (kbId && window.VAgentKnowledgeStore) {
        const fields = window.VAgentKnowledgeStore.getFilterFields(kbId);
        if (Array.isArray(fields) && fields.length) return fields;
    }
    return FIELD_OPTIONS;
}

function getKnowledgeFieldMeta(field, kbId = null) {
    const fields = getKnowledgeFieldOptions(kbId);
    return findKnowledgeFieldMeta(field, kbId)
        || fields[0]
        || FIELD_OPTIONS[0];
}

function getKnowledgeOperatorOptions(field, kbId = null) {
    const fieldMeta = getKnowledgeFieldMeta(field, kbId);
    return OPERATOR_OPTIONS[fieldMeta.type] || OPERATOR_OPTIONS.text;
}

function normalizeKnowledgeOperator(field, operator, kbId = null) {
    const fieldMeta = getKnowledgeFieldMeta(field, kbId);
    if (fieldMeta.type === 'date') {
        if (operator === 'lt') return 'before';
        if (operator === 'gt') return 'after';
    }
    if (fieldMeta.type === 'single' && operator === 'contains') return 'in_any';
    if (fieldMeta.type === 'multiple' && operator === 'contains') return 'contains_any';
    return operator || '';
}

function updateOperators(select) {
    const row = select.closest('.filter-condition-row') || select.parentElement;
    const opSelect = row.querySelector('.operator-select');
    const fieldMeta = getKnowledgeFieldMeta(select.value, activeKnowledgeFilterGroupId);
    
    const ops = OPERATOR_OPTIONS[fieldMeta.type] || OPERATOR_OPTIONS.text;
    opSelect.innerHTML = ops.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function getConditionRowHTML(defaultField = 'rank', defaultOp = 'eq', defaultValue = '总监') {
    const fields = getKnowledgeFieldOptions();
    const fieldOptions = fields.map(f => `<option value="${f.value}" ${f.value === defaultField ? 'selected' : ''}>${f.label}</option>`).join('');
    
    // Determine initial operators based on default field
    const initialOps = getKnowledgeOperatorOptions(defaultField);
    const normalizedOp = normalizeKnowledgeOperator(defaultField, defaultOp);
    const opOptions = initialOps.map(o => `<option value="${o.value}" ${o.value === normalizedOp ? 'selected' : ''}>${o.label}</option>`).join('');
    
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

function getKnowledgeToggleHTML({ checked, onChange, label }) {
    return `
        <label class="inline-flex items-center gap-2 cursor-pointer" onclick="event.stopPropagation()">
            <span class="text-xs text-gray-500">${escapeHtml(label || '')}</span>
            <span class="relative inline-flex items-center">
                <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''} onchange="${onChange}">
                <span class="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 transition-colors"></span>
                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></span>
            </span>
        </label>
    `;
}

function getKnowledgeBaseRowHTML(kb) {
    const usable = isKnowledgeBaseUsable(kb);
    return `
        <div class="flex items-center gap-2 px-3 py-2 rounded-md border ${usable ? 'border-transparent bg-gray-50 hover:bg-gray-100' : 'border-orange-200 bg-orange-50'} transition-colors">
            <i class="fa-regular fa-bookmark text-xs ${usable ? 'text-gray-500' : 'text-orange-500'}" aria-hidden="true"></i>
            <div class="flex-1 min-w-0">
                <div class="text-xs ${usable ? 'text-gray-700' : 'text-orange-800'} truncate">${escapeHtml(kb.name)}</div>
                ${usable ? '' : '<div class="mt-0.5 text-[11px] text-orange-600">知识库已停用，请重新启用或更换知识库</div>'}
            </div>
            ${usable ? '' : '<span class="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700">已停用</span>'}
            <button type="button" data-kb-id="${escapeHtml(kb.id)}" onclick="removeKnowledgeBaseFromNode(this.dataset.kbId)" class="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="移除知识库">
                <i class="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
            </button>
        </div>
    `;
}

function renderKnowledgeBasePickerModal() {
    const existingModal = document.getElementById('knowledge-base-picker-modal');
    if (existingModal) existingModal.remove();
    if (!knowledgeBasePickerOpen) return;

    const keyword = knowledgeBasePickerSearch.trim().toLowerCase();
    const availableKnowledgeBases = getAvailableKnowledgeBases();
    const visibleKnowledgeBases = availableKnowledgeBases.filter(kb => {
        if (!keyword) return true;
        return kb.name.toLowerCase().includes(keyword) || (kb.description || '').toLowerCase().includes(keyword);
    });
    const modal = document.createElement('div');
    modal.id = 'knowledge-base-picker-modal';
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/45';
    modal.innerHTML = `
        <div class="w-[640px] max-w-[92vw] h-[640px] max-h-[88vh] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
            <div class="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                <h3 class="text-base font-semibold text-gray-800">选择知识库</h3>
                <button type="button" onclick="closeKnowledgeBasePicker()" class="w-8 h-8 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="关闭">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </div>

            <div class="px-6 py-4 flex items-center justify-between gap-4">
                <label class="relative flex-1">
                    <span class="sr-only">搜索知识库</span>
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden="true"></i>
                    <input type="text" value="${escapeHtml(knowledgeBasePickerSearch)}" oninput="filterKnowledgeBasePicker(this.value)" placeholder="请输入知识库名称" class="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                </label>
                <button type="button" onclick="goToKnowledgeBaseCreationFromPicker()" class="flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <i class="fa-solid fa-plus text-indigo-500" aria-hidden="true"></i>
                    <span>创建新知识库</span>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto px-6 pb-3 space-y-3">
                ${visibleKnowledgeBases.length
                    ? visibleKnowledgeBases.map(kb => getKnowledgeBasePickerItemHTML(kb)).join('')
                    : `
                        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400">
                            <i class="fa-solid fa-box-open text-4xl text-gray-200 mb-3" aria-hidden="true"></i>
                            <div class="text-sm">没有找到匹配的知识库</div>
                        </div>
                    `}
            </div>

            <div class="h-14 flex items-center justify-between px-6 border-t border-gray-100 bg-white">
                <div class="text-xs text-gray-400">
                    已选择 <span class="font-medium text-indigo-600">${knowledgeBasePickerSelection.size}</span> 个知识库
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="closeKnowledgeBasePicker()" class="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">取消</button>
                    <button type="button" onclick="confirmKnowledgeBasePicker()" class="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors">确定</button>
                </div>
            </div>
        </div>
    `;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeKnowledgeBasePickerModal();
    });
    document.body.appendChild(modal);

    const searchInput = modal.querySelector('input[type="text"]');
    if (searchInput && knowledgeBasePickerSearch) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
}

function getKnowledgeBasePickerItemHTML(kb) {
    const isSelected = knowledgeBasePickerSelection.has(kb.id);
    const usable = isKnowledgeBaseUsable(kb);
    return `
        <button type="button" data-kb-id="${escapeHtml(kb.id)}" ${usable ? 'onclick="toggleKnowledgeBasePickerSelection(this.dataset.kbId)"' : 'disabled'} class="w-full flex items-center gap-3 rounded-md border ${isSelected ? 'border-indigo-400 bg-indigo-50/40' : usable ? 'border-gray-200 bg-white hover:border-indigo-200' : 'border-orange-100 bg-orange-50/60 opacity-80 cursor-not-allowed'} px-4 py-4 text-left transition-colors">
            <span class="w-4 h-4 flex items-center justify-center rounded border ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 bg-white text-transparent'}">
                <i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
            </span>
            <span class="w-10 h-10 flex items-center justify-center rounded-md border border-gray-200 bg-white ${usable ? 'text-indigo-400' : 'text-orange-400'}">
                <i class="fa-regular fa-bookmark" aria-hidden="true"></i>
            </span>
            <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-gray-800">${escapeHtml(kb.name)}</span>
                <span class="mt-1 block truncate text-xs ${usable ? 'text-gray-400' : 'text-orange-600'}">${usable ? escapeHtml(kb.description || '知识库') : '知识库已停用，不可选择'}</span>
            </span>
            <span class="text-xs ${usable ? 'text-gray-400' : 'text-orange-600'}">${usable ? (isSelected ? '已选择' : '可选择') : '已停用'}</span>
        </button>
    `;
}

function getKnowledgeFilterGroupCardHTML(kb, group) {
    const enabledText = group.enabled ? '已开启' : '默认关闭';
    const issues = getKnowledgeGroupIssues(kb, group);
    const hasIssue = issues.length > 0;
    return `
        <div data-kb-id="${escapeHtml(kb.id)}" onclick="openKnowledgeFilterGroup(this.dataset.kbId)" class="group flex items-center gap-2 px-3 py-2.5 rounded-md border ${hasIssue ? 'border-orange-200 bg-orange-50 hover:border-orange-300' : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40'} cursor-pointer transition-all">
            <i class="fa-solid ${hasIssue ? 'fa-triangle-exclamation text-orange-500' : 'fa-filter ' + (group.enabled ? 'text-blue-500' : 'text-gray-300')} text-xs" aria-hidden="true"></i>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-medium ${hasIssue ? 'text-orange-800' : 'text-gray-700'} truncate">${escapeHtml(kb.name)}</div>
                <div class="text-[11px] ${hasIssue ? 'text-orange-600' : group.enabled ? 'text-blue-500' : 'text-gray-400'}">${hasIssue ? `配置异常 · ${issues.length} 项需处理` : `${enabledText}${group.conditions.length ? ` · ${group.conditions.length} 条条件` : ''}`}</div>
            </div>
            ${getKnowledgeToggleHTML({
                checked: group.enabled,
                label: '',
                onChange: `setKnowledgeFilterGroupEnabled(this.closest('[data-kb-id]').dataset.kbId, this.checked)`
            })}
            <i class="fa-solid fa-chevron-right text-xs text-gray-300 group-hover:text-blue-500" aria-hidden="true"></i>
        </div>
    `;
}

function getKnowledgeOutputHTML() {
    return `
        <section class="border-t border-gray-200 pt-5">
            <div class="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                <span>输出</span>
                <i class="fa-regular fa-circle-question text-xs text-gray-400" aria-hidden="true"></i>
            </div>
            <div class="mt-4 text-xs">
                <div class="font-medium text-blue-900">chunk_list <span class="font-normal text-gray-400">Array&lt;Object&gt;</span></div>
                <div class="mt-2 ml-1 pl-3 border-l border-gray-200 space-y-2 text-blue-900">
                    <div>doc_id <span class="text-gray-400">String</span></div>
                    <div>doc_name <span class="text-gray-400">String</span></div>
                    <div>title <span class="text-gray-400">String</span></div>
                    <div>text <span class="text-gray-400">String</span></div>
                    <div>score <span class="text-gray-400">Number</span></div>
                    <div>page_number <span class="text-gray-400">Number</span></div>
                    <div>chunk_id <span class="text-gray-400">String</span></div>
                </div>
            </div>
        </section>
    `;
}

function extractDatabaseQueryVariables(text) {
    const source = String(text || '');
    const variables = [];
    source.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name) => {
        const value = String(name || '').trim();
        if (value && !variables.includes(value)) variables.push(value);
        return _;
    });
    return variables;
}

function getDatabaseQueryInputRowHTML(nodeId, input, sourceOptions = []) {
    const typeOptions = ['String', 'Number', 'Boolean', 'Object', 'Array<Object>'];
    const allSources = sourceOptions.length ? sourceOptions : ['{{start.query}}', '{{start.userId}}'];
    return `
        <div class="group grid grid-cols-[minmax(0,1fr),minmax(150px,190px),24px] items-center gap-2 py-1.5">
            <div class="flex min-w-0 items-center gap-1.5">
                <label class="min-w-0">
                    <span class="sr-only">入参名称</span>
                    <input value="${escapeHtml(input.name)}" onblur="updateDatabaseQueryInput('${nodeId}', '${escapeHtml(input.id)}', 'name', this.value)" class="min-w-0 max-w-[112px] border-0 bg-transparent px-0 py-1 text-xs text-gray-700 focus:outline-none focus:ring-0" placeholder="param_name">
                </label>
                <button type="button" onclick="updateDatabaseQueryInput('${nodeId}', '${escapeHtml(input.id)}', 'required', ${input.required ? 'false' : 'true'})" class="${input.required ? 'text-red-500' : 'text-gray-300'} text-xs font-semibold focus:outline-none" title="${input.required ? '点击设为非必填' : '点击设为必填'}">*</button>
                <label>
                    <span class="sr-only">入参类型</span>
                    <select onchange="updateDatabaseQueryInput('${nodeId}', '${escapeHtml(input.id)}', 'type', this.value)" class="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        ${typeOptions.map(type => `<option value="${escapeHtml(type)}" ${type === input.type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
                    </select>
                </label>
            </div>
            <label>
                <span class="sr-only">来源变量</span>
                <select onchange="updateDatabaseQueryInput('${nodeId}', '${escapeHtml(input.id)}', 'source', this.value)" class="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    ${allSources.map(source => `<option value="${escapeHtml(source)}" ${source === input.source ? 'selected' : ''}>${escapeHtml(source)}</option>`).join('')}
                </select>
            </label>
            <button type="button" onclick="removeDatabaseQueryInput('${nodeId}', '${escapeHtml(input.id)}')" class="flex h-7 w-6 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 group-hover:opacity-100" title="删除输入" aria-label="删除输入">
                <i class="fa-solid fa-trash-can text-[11px]" aria-hidden="true"></i>
            </button>
        </div>
    `;
}

function getDatabaseQueryInputHTML(nodeId, config, sourceOptions = []) {
    const inputs = normalizeDatabaseQueryInputParams(config.inputParams);
    const hasInputPanel = inputs.length > 0;

    return `
        <section>
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                    <span>输入</span>
                    ${getInlineHintHTML('配置节点运行时从上游接收的业务参数。入参可在 SQL 中以 {{入参名}} 引用；如果整段 SQL 来自上游，请直接在查询配置的 SQL 输入框插入对应变量。')}
                </div>
                <button type="button" onclick="addDatabaseQueryInput('${nodeId}')" class="rounded-md px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i>输入
                </button>
            </div>
            ${hasInputPanel ? `<div class="mt-3 rounded-md bg-gray-50 p-3">
                <div class="grid grid-cols-[minmax(0,1fr),minmax(150px,190px),24px] gap-2 text-xs font-medium text-gray-400">
                    <div>输入</div>
                    <div>值</div>
                    <div></div>
                </div>
                ${false ? `
                    <div class="grid grid-cols-[minmax(0,1fr),minmax(150px,190px),24px] items-center gap-2 py-1.5">
                        <div class="flex min-w-0 items-center gap-1.5 text-xs text-gray-700">
                            <span>sql</span>
                            <span class="text-red-500">*</span>
                            <span class="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">String</span>
                        </div>
                        <select onchange="updateDatabaseQuerySetting('${nodeId}', 'variableRef', this.value)" class="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            ${sourceOptions.map(source => `<option value="${escapeHtml(source)}" ${source === config.variableRef ? 'selected' : ''}>${escapeHtml(source)}</option>`).join('')}
                        </select>
                        <div></div>
                    </div>
                ` : ''}
                ${inputs.map(input => getDatabaseQueryInputRowHTML(nodeId, input, sourceOptions)).join('')}
            </div>` : ''}
        </section>
    `;
}

function getDatabaseQueryOutputHTML() {
    return `
        <section>
            <div class="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                <span>输出</span>
                ${getInlineHintHTML('节点执行后提供给下游节点消费的结构化结果。')}
            </div>
            <div class="mt-4 space-y-3 text-xs text-blue-900">
                <div>
                    <div>
                        <div class="font-medium">result <span class="font-normal text-gray-400">Object</span></div>
                        <div class="mt-1 text-gray-400">工具执行结果</div>
                    </div>
                    <div class="mt-2 ml-1 pl-3 border-l border-gray-200 space-y-2">
                        <div>
                            <div>content <span class="text-gray-400">Array&lt;Object&gt;</span></div>
                            <div class="mt-1 text-gray-400">返回内容</div>
                        </div>
                        <div>
                            <div>isError <span class="text-gray-400">Boolean</span></div>
                            <div class="mt-1 text-gray-400">是否发生错误</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function getKnowledgeNodeSettingsHTML() {
    const draft = ensureKnowledgeNodeDraft();

    return `
        <div class="space-y-0 pb-4">
            <section class="-mx-4 px-4 pb-4 border-b border-gray-200">
                <label for="knowledge-node-description" class="sr-only">节点描述</label>
                <input id="knowledge-node-description" type="text" value="${escapeHtml(draft.description)}" oninput="updateKnowledgeSetting('description', this.value)" placeholder="请输入描述..." class="w-full border-0 px-0 py-1 text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-0">
            </section>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200">
                <label for="knowledge-node-input" class="flex items-center gap-1.5 text-sm font-medium text-gray-800 mb-3">
                    <span>输入</span>
                    <i class="fa-regular fa-circle-question text-xs text-gray-400" aria-hidden="true"></i>
                </label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Str</span>
                    <input id="knowledge-node-input" type="text" value="${escapeHtml(draft.input)}" oninput="updateKnowledgeSetting('input', this.value)" class="w-full border border-gray-300 rounded-md pl-10 pr-8 py-2 text-xs font-mono text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <i class="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300" aria-hidden="true"></i>
                </div>
            </section>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <div class="text-sm font-medium text-gray-800">知识库</div>
                        <i class="fa-regular fa-circle-question text-xs text-gray-400" aria-hidden="true"></i>
                    </div>
                    <button type="button" onclick="openKnowledgeBasePicker()" class="px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                        <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i>知识库
                    </button>
                </div>
                <div class="space-y-2">
                    ${draft.knowledgeBases.length
                        ? draft.knowledgeBases.map(getKnowledgeBaseRowHTML).join('')
                        : '<div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">尚未选择知识库，请点击右上角添加</div>'}
                </div>

                <div class="rounded-md bg-gray-50 px-4 py-4 space-y-4">
                    <div class="flex items-center gap-3">
                        <label for="knowledge-topk" class="w-24 text-xs text-gray-500">topK <i class="fa-regular fa-circle-question ml-1 text-[10px] text-gray-400" aria-hidden="true"></i></label>
                        <div class="flex-1">
                            <input id="knowledge-topk" type="range" min="1" max="20" value="${draft.topK}" oninput="updateKnowledgeSetting('topK', this.value)" class="w-full accent-indigo-500">
                            <div class="flex justify-between text-[11px] text-gray-400 mt-0.5"><span>1</span><span>20</span></div>
                        </div>
                        <input id="knowledge-topk-number" type="number" min="1" max="20" value="${draft.topK}" oninput="updateKnowledgeSetting('topK', this.value)" class="w-14 border border-gray-300 rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-500">
                    </div>
                    <div class="flex items-center gap-3">
                        <label for="knowledge-threshold" class="w-24 text-xs text-gray-500">相似度阈值 <i class="fa-regular fa-circle-question ml-1 text-[10px] text-gray-400" aria-hidden="true"></i></label>
                        <div class="flex-1">
                            <input id="knowledge-threshold" type="range" min="0.01" max="1" step="0.01" value="${draft.similarityThreshold}" oninput="updateKnowledgeSetting('similarityThreshold', this.value)" class="w-full accent-indigo-500">
                            <div class="flex justify-between text-[11px] text-gray-400 mt-0.5"><span>0.01</span><span>1</span></div>
                        </div>
                        <input id="knowledge-threshold-number" type="number" min="0.01" max="1" step="0.01" value="${draft.similarityThreshold.toFixed(2)}" oninput="updateKnowledgeSetting('similarityThreshold', this.value)" class="w-14 border border-gray-300 rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-500">
                    </div>
                </div>
            </section>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <div class="text-sm font-medium text-gray-800">知识库过滤</div>
                        <i class="fa-regular fa-circle-question text-xs text-gray-400" aria-hidden="true"></i>
                    </div>
                    ${getKnowledgeToggleHTML({
                        checked: draft.filterEnabled,
                        label: '',
                        onChange: 'setKnowledgeFilterEnabled(this.checked)'
                    })}
                </div>

                ${draft.filterEnabled
                    ? `
                        <div class="space-y-2">
                            ${draft.knowledgeBases.length
                                ? draft.knowledgeBases.map(kb => getKnowledgeFilterGroupCardHTML(kb, draft.filterGroups[kb.id])).join('')
                                : '<div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-xs text-gray-400">请先添加知识库，再配置过滤条件</div>'}
                        </div>
                    `
                    : `
                        <div class="rounded-lg bg-gray-50 border border-gray-100 px-3 py-3 text-xs text-gray-500 leading-5">
                            开启后展示与上方知识库一一对应的过滤分组。每个分组默认关闭。
                        </div>
                    `}
            </section>

            <div class="-mx-4 px-4 py-5 border-b border-gray-200">
                ${getKnowledgeOutputHTML()}
            </div>

            <div class="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 border-t border-gray-100 bg-white flex justify-end gap-2">
                <button type="button" onclick="closeNodeSettings()" class="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">取消</button>
                <button type="button" id="save-knowledge-node-settings" onclick="saveKnowledgeNodeSettings()" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    <i class="fa-solid fa-floppy-disk mr-1" aria-hidden="true"></i>保存
                </button>
            </div>
        </div>
    `;
}

function getKnowledgeConditionHTML(condition, index) {
    const fields = getKnowledgeFieldOptions(activeKnowledgeFilterGroupId);
    const fieldMeta = findKnowledgeFieldMeta(condition.field, activeKnowledgeFilterGroupId);
    const fieldMissing = !fieldMeta;
    const fieldLabel = condition.fieldLabel || fieldMeta?.label || condition.field || '未知字段';
    const fieldOptions = `${fieldMissing ? `<option value="${escapeHtml(condition.field)}" selected>字段已删除：${escapeHtml(fieldLabel)}</option>` : ''}${fields.map(field => `
        <option value="${field.value}" ${field.value === condition.field ? 'selected' : ''}>${field.label}</option>
    `).join('')}`;
    const operators = fieldMissing ? OPERATOR_OPTIONS.text : getKnowledgeOperatorOptions(condition.field, activeKnowledgeFilterGroupId);
    const operatorInvalid = !fieldMissing && condition.operator && !operators.some(operator => operator.value === condition.operator);
    const operatorOptions = `${operatorInvalid ? `<option value="${escapeHtml(condition.operator)}" selected>操作符不适用：${escapeHtml(condition.operator)}</option>` : ''}${operators.map(operator => `
        <option value="${operator.value}" ${operator.value === condition.operator ? 'selected' : ''}>${operator.label}</option>
    `).join('')}`;
    const conditionIssues = getKnowledgeConditionIssues(condition, activeKnowledgeFilterGroupId);
    return `
        <div class="rounded-lg border ${conditionIssues.length ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'} p-3 space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-medium ${conditionIssues.length ? 'text-orange-700' : 'text-gray-500'}">条件 ${index + 1}${conditionIssues.length ? ' · 异常' : ''}</span>
                <button type="button" onclick="removeKnowledgeFilterCondition(${index})" class="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <i class="fa-solid fa-trash-can mr-1" aria-hidden="true"></i>删除
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <label class="block">
                    <span class="sr-only">字段</span>
                    <select onchange="updateKnowledgeFilterCondition(${index}, 'field', this.value)" class="w-full border ${fieldMissing ? 'border-orange-300 text-orange-700' : 'border-gray-300 text-gray-700'} rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                        ${fieldOptions}
                    </select>
                </label>
                <label class="block">
                    <span class="sr-only">操作符</span>
                    <select onchange="updateKnowledgeFilterCondition(${index}, 'operator', this.value)" class="w-full border ${operatorInvalid ? 'border-orange-300 text-orange-700' : 'border-gray-300 text-gray-700'} rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-blue-500">
                        ${operatorOptions}
                    </select>
                </label>
            </div>
            ${conditionIssues.length ? `<div class="rounded bg-orange-100 px-2 py-1.5 text-xs text-orange-700">${conditionIssues.map(issue => escapeHtml(issue)).join('；')}</div>` : ''}
            <div class="relative rounded-md border border-gray-200 bg-white p-2">
                <label class="block">
                    <span class="sr-only">过滤值</span>
                    <textarea id="knowledge-condition-value-${index}" rows="3" oninput="updateKnowledgeFilterCondition(${index}, 'value', this.value)" placeholder="在这里输入" class="w-full border-0 px-1 py-1 text-sm text-gray-700 placeholder:text-gray-300 resize-none focus:outline-none focus:ring-0">${escapeHtml(condition.value)}</textarea>
                </label>
                <div class="flex items-center gap-0.5 px-1 pt-1 text-[11px] text-gray-400">
                    <span>输入 /</span>
                    <button type="button" onclick="toggleKnowledgeVariableMenu(${index})" class="text-gray-400 hover:text-blue-600 transition-colors">插入变量</button>
                </div>
                ${knowledgeVariableMenuIndex === index ? getKnowledgeVariableMenuHTML(index) : ''}
            </div>
        </div>
    `;
}

function getKnowledgeVariableMenuHTML(index) {
    return `
        <div class="absolute z-30 left-0 right-0 mt-1 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div class="px-3 py-2 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">插入工作流变量</div>
            ${WORKFLOW_VARIABLE_OPTIONS.map(variable => `
                <button type="button" data-variable-value="${escapeHtml(variable.value)}" onclick="selectKnowledgeVariable(${index}, this.dataset.variableValue)" class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-blue-50 transition-colors">
                    <span class="text-xs text-gray-700">${escapeHtml(variable.name)}</span>
                    <code class="text-[11px] text-blue-600">${escapeHtml(variable.value)}</code>
                </button>
            `).join('')}
        </div>
    `;
}

function getKnowledgeFilterGroupSettingsHTML(id) {
    const draft = ensureKnowledgeNodeDraft();
    const kb = draft.knowledgeBases.find(item => item.id === id);
    const group = draft.filterGroups[id];
    if (!kb || !group) {
        activeKnowledgeFilterGroupId = null;
        return getKnowledgeNodeSettingsHTML();
    }
    const fieldCount = getKnowledgeFieldOptions(id).length;

    return `
        <div class="space-y-4 pb-4">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                <button type="button" onclick="closeKnowledgeFilterGroup()" class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                    <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
                    ${escapeHtml(kb.name)}
                </button>
                ${getKnowledgeToggleHTML({
                    checked: group.enabled,
                    label: group.enabled ? '已开启' : '未开启',
                    onChange: `setKnowledgeFilterGroupEnabled('${escapeHtml(id)}', this.checked)`
                })}
            </div>

            <div class="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700 leading-5">
                关闭分组开关后会保留已有条件，但该知识库检索时不应用过滤。
            </div>

            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm font-medium text-gray-800">过滤条件</div>
                    <div class="text-xs text-gray-400 mt-0.5">字段同步自「知识库设置 / 文档字段显示」，当前 ${fieldCount} 个字段</div>
                </div>
                <div class="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
                    <button type="button" onclick="setKnowledgeFilterLogic('and')" class="px-2 py-1 rounded text-xs font-medium ${group.logic === 'and' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}">且 (AND)</button>
                    <button type="button" onclick="setKnowledgeFilterLogic('or')" class="px-2 py-1 rounded text-xs font-medium ${group.logic === 'or' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}">或 (OR)</button>
                </div>
            </div>

            <div class="space-y-3">
                ${group.conditions.length
                    ? group.conditions.map(getKnowledgeConditionHTML).join('')
                    : '<div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">暂无过滤条件，点击下方按钮添加</div>'}
            </div>

            <button type="button" onclick="addKnowledgeFilterCondition()" class="w-full px-3 py-2 rounded-md border border-dashed border-blue-300 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i>添加条件
            </button>

            <div class="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 border-t border-gray-100 bg-white flex justify-end">
                <button type="button" onclick="closeKnowledgeFilterGroup()" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">完成配置</button>
            </div>
        </div>
    `;
}

function getDatabaseQueryPreviewSelectHTML(nodeId, config) {
    return `
        <label class="flex items-center gap-2 text-xs text-gray-500">
            <span>预览方式</span>
            <select onchange="updateDatabaseQuerySetting('${nodeId}', 'outputFormat', this.value)" class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="table" ${config.outputFormat === 'table' ? 'selected' : ''}>表格</option>
                <option value="json" ${config.outputFormat === 'json' ? 'selected' : ''}>JSON</option>
            </select>
        </label>
    `;
}

function getDatabaseQueryResultHTML(nodeId, config) {
    const result = config.lastRun;
    if (!result) {
        return '';
    }
    const success = result.status === 'success';
    const columns = Array.isArray(result.columns) ? result.columns : [];
    const rows = Array.isArray(result.rows) ? result.rows.slice(0, 20) : [];
    const previewJson = escapeHtml(JSON.stringify(result.result || result, null, 2));
    const getRowValue = (row, col, index) => {
        if (Array.isArray(row)) return row[index];
        if (!row || typeof row !== 'object') return '';
        const key = col?.name || col;
        return row[key];
    };
    return `
        <section class="-mx-4 px-4 py-5 border-b border-gray-200">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 class="text-sm font-semibold text-gray-900">运行结果</h4>
                    <p class="mt-0.5 text-xs ${success ? 'text-green-700' : 'text-red-700'}">${success ? '执行成功' : '执行失败'} · ${escapeHtml(result.execution_time || '0.00 秒')} · ${escapeHtml(result.row_count || 0)} 行</p>
                </div>
                <div class="flex items-center gap-2">
                    ${getDatabaseQueryPreviewSelectHTML(nodeId, config)}
                    <span class="rounded-full ${success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-2 py-1 text-xs font-medium">${escapeHtml(result.status)}</span>
                </div>
            </div>
            <div class="space-y-3">
                <div>
                    <div class="mb-1 text-xs font-medium text-gray-500">执行 SQL</div>
                    <pre class="max-h-28 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-700">${escapeHtml(result.executed_sql || '')}</pre>
                </div>
                ${success ? `
                    <div>
                        <div class="mb-1 text-xs font-medium text-gray-500">查询结果预览（前 20 行）</div>
                        ${config.outputFormat === 'json'
                            ? `<pre class="max-h-64 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-700">${previewJson}</pre>`
                            : `<div class="max-h-64 overflow-auto rounded-md border border-gray-200 bg-white">
                                <table class="w-full text-left text-xs">
                                    <thead class="sticky top-0 bg-gray-50 text-gray-500">
                                        <tr>${columns.map(col => `<th class="px-3 py-2 font-medium">${escapeHtml(col.name || col)}</th>`).join('')}</tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">
                                        ${rows.map(row => `<tr>${columns.map((col, index) => `<td class="px-3 py-2 text-gray-700">${escapeHtml(getRowValue(row, col, index))}</td>`).join('')}</tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>`}
                    </div>
                ` : `
                    <div class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        <span class="font-medium">错误信息：</span>${escapeHtml(result.error_message || '执行失败')}
                    </div>
                `}
                ${result.error_message && success ? `<div class="rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">${escapeHtml(result.error_message)}</div>` : ''}
            </div>
        </section>
    `;
}

function getDatabaseQuerySettingsHTML(nodeId) {
    const node = getDatabaseQueryNode(nodeId);
    const config = node?.config || createDefaultDatabaseQueryConfig();
    const store = window.VAgentDataSourceStore;
    const dataSources = store ? store.loadDataSources() : [];
    const selected = config.datasourceId ? dataSources.find(item => item.id === config.datasourceId) : null;
    const usableSources = dataSources.filter(item => item.status === 'connected' || item.id === config.datasourceId);
    const noSources = dataSources.filter(item => item.status === 'connected').length === 0;
    const variableOptions = store?.variableSqlMap ? Object.keys(store.variableSqlMap) : ['{{llm1.output.sql}}', '{{start.query}}'];
    const modeFixed = true;
    const inputParams = normalizeDatabaseQueryInputParams(config.inputParams);
    const sqlInsertOptions = Array.from(new Set([
        ...inputParams.map(input => `{{${input.name}}}`),
        ...variableOptions.slice(0, 4)
    ])).filter(Boolean);
    const sourceOptions = usableSources.length
        ? usableSources.map(ds => `<option value="${escapeHtml(ds.id)}" ${ds.id === config.datasourceId ? 'selected' : ''}>${escapeHtml(ds.name)} (${escapeHtml(ds.database)})${ds.status !== 'connected' ? ' - 不可用' : ''}</option>`).join('')
        : '<option value="">暂无可用数据源</option>';
    const sourceWarning = selected && selected.status !== 'connected'
        ? `<div class="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-700"><i class="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true"></i>当前数据源不可用，请更换数据源或联系管理员处理。</div>`
        : '';

    return `
        <div class="space-y-0">
            <section class="-mx-4 px-4 pb-4 border-b border-gray-200">
                <label for="database-query-desc-${nodeId}" class="sr-only">节点描述</label>
                <input id="database-query-desc-${nodeId}" type="text" value="${escapeHtml(config.description || '')}" oninput="updateDatabaseQuerySetting('${nodeId}', 'description', this.value)" placeholder="请输入描述..." class="w-full border-0 px-0 py-1 text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-0">
            </section>

            <div class="-mx-4 px-4 py-5 border-b border-gray-200">
                ${getDatabaseQueryInputHTML(nodeId, config, variableOptions)}
            </div>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200">
                <div class="mb-3 flex items-center justify-between">
                    <div>
                        <h4 class="text-sm font-semibold text-gray-900">数据源</h4>
                    </div>
                    <button type="button" onclick="switchView('data-source')" class="text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded">前往数据源管理</button>
                </div>
                ${noSources ? `
                    <div class="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
                        <div class="text-sm font-medium text-gray-700">暂无可用数据源</div>
                        <p class="mt-1 text-xs text-gray-400">暂无可用数据源，请先前往数据源管理创建数据库连接。</p>
                        <button type="button" onclick="switchView('data-source')" class="mt-3 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">前往数据源管理</button>
                    </div>
                ` : `
                    <label for="database-query-ds-${nodeId}" class="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <span>数据源名称</span>
                        ${getInlineHintHTML('仅展示当前用户有权使用且已启用的数据源。')}
                    </label>
                    <select id="database-query-ds-${nodeId}" onchange="refreshDatabaseQueryDatasource('${nodeId}', this.value)" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">请选择数据源</option>
                        ${sourceOptions}
                    </select>
                    ${sourceWarning}
                `}
            </section>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200">
                <div class="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h4 class="text-sm font-semibold text-gray-900">查询配置</h4>
                            ${getInlineHintHTML('直接填写 SELECT SQL，也可以插入输入参数或上游 SQL 变量；如果 SQL 内容仅为一个 SQL 变量，会先解析变量再执行安全校验。')}
                        </div>
                    </div>
                    <div class="hidden shrink-0 rounded-md border border-gray-200 bg-gray-50 p-0.5">
                        <button type="button" onclick="setDatabaseQuerySqlMode('${nodeId}', 'fixed')" class="rounded px-3 py-1.5 text-sm font-medium ${modeFixed ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} focus:outline-none focus:ring-2 focus:ring-blue-500/20">固定 SQL</button>
                        <button type="button" onclick="setDatabaseQuerySqlMode('${nodeId}', 'variable')" class="rounded px-3 py-1.5 text-sm font-medium ${!modeFixed ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} focus:outline-none focus:ring-2 focus:ring-blue-500/20">使用上游变量</button>
                    </div>
                </div>
                ${modeFixed ? `
                    <div>
                        <div class="mb-2 flex items-center justify-between">
                            <label for="database-query-sql-${nodeId}" class="text-sm font-medium text-gray-700">SQL 内容 <span class="text-red-500">*</span></label>
                        </div>
                        <textarea id="database-query-sql-${nodeId}" rows="8" oninput="updateDatabaseQuerySetting('${nodeId}', 'sql', this.value)" class="w-full rounded-md border border-gray-300 bg-white px-3 py-3 font-mono text-xs leading-5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">${escapeHtml(config.sql || '')}</textarea>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                            <span>插入变量</span>
                            <div class="flex flex-wrap gap-1.5">
                                ${sqlInsertOptions.map(v => `<button type="button" onclick="insertDatabaseSqlVariable('${nodeId}', '${escapeHtml(v)}')" class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-mono text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(v)}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                ` : `
                    <div>
                        <label for="database-query-variable-${nodeId}" class="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <span>SQL 来源变量 <span class="text-red-500">*</span></span>
                            ${getInlineHintHTML('如果变量为空或变量内容不是 SELECT SQL，执行时会返回明确错误。')}
                        </label>
                        <select id="database-query-variable-${nodeId}" onchange="updateDatabaseQuerySetting('${nodeId}', 'variableRef', this.value)" class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            ${variableOptions.map(v => `<option value="${escapeHtml(v)}" ${v === config.variableRef ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
                        </select>
                    </div>
                `}
                <div id="database-query-validation-${nodeId}" class="mt-3 hidden rounded-md border px-3 py-2 text-sm"></div>
            </section>

            <section class="-mx-4 px-4 py-5 border-b border-gray-200">
                <div class="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                    <span>失败重试</span>
                    ${getInlineHintHTML('配置查询失败或超时时的重试边界，避免异常时无限重试。')}
                </div>
                <div class="mt-4 space-y-4 text-xs">
                    <div>
                        <label for="database-query-max-retries-${nodeId}" class="mb-2 block font-medium text-blue-900">
                            最大重试次数 <span class="font-normal text-gray-400">Number</span>
                        </label>
                        <input id="database-query-max-retries-${nodeId}" type="number" min="0" max="5" value="${escapeHtml(config.maxRetries)}" oninput="updateDatabaseQuerySetting('${nodeId}', 'maxRetries', this.value)" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="database-query-timeout-${nodeId}" class="mb-2 block font-medium text-blue-900">
                            查询超时时间（秒） <span class="font-normal text-gray-400">Number</span>
                        </label>
                        <input id="database-query-timeout-${nodeId}" type="number" min="1" max="120" value="${escapeHtml(config.timeout)}" oninput="updateDatabaseQuerySetting('${nodeId}', 'timeout', this.value)" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    </div>
                </div>
            </section>

            <div class="-mx-4 px-4 py-5 border-b border-gray-200">
                ${getDatabaseQueryOutputHTML()}
            </div>

            ${getDatabaseQueryResultHTML(nodeId, config)}
        </div>
    `;
}

function getNodeSettingsHTML(type, ctx = null) {
    if (type === 'knowledge') {
        return getKnowledgeNodeSettingsHTML();
    } else if (type === 'database-query') {
        return getDatabaseQuerySettingsHTML(ctx?.nodeId || '');
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
                    <button class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg" onclick="deleteCurrentOpenedNode()">删除</button>
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
document.addEventListener('knowledge-bases-updated', () => {
    refreshKnowledgeNodeDraftFromSharedData();
});

document.addEventListener('knowledge-fields-updated', (event) => {
    if (!knowledgeNodeDraft) return;
    const kbId = event.detail?.kbId;
    if (!kbId || !knowledgeNodeDraft.filterGroups[kbId]) return;
    if (activeNodeSettingsType === 'knowledge') {
        renderKnowledgeSettingsContent();
    }
});

document.addEventListener('DOMContentLoaded', loadFeatureConfig);

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator-editor') {
        window.initOrchestratorEditor(e.detail.params);
        loadFeatureConfig();
    }
});
