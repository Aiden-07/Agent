// Knowledge Base Settings Logic

let currentSettingsKbId = null;
let kbParserSelectPrevValue = null;

const FIELD_TYPE_MAP = {
    'text': '文本',
    'textarea': '多行文本',
    'number': '数字',
    'date': '日期',
    'single_select': '单选',
    'multi_select': '多选',
    'progress': '进度',
    'boolean': '布尔值',
    'switch': '开关',
    'user': '人员',
    'cascade': '级联',
    'checklist': '清单',
    'button': '按钮',
    'relation_single': '单向关联',
    'relation_double': '双向关联',
    'custom_number': '自定义编号',
    'rating': '评分',
    'department': '部门',
    'attachment': '附件',
    'select': '下拉列表',
    'category': '下拉列表' // Map legacy category to select
};

function getTypeName(type) {
    return FIELD_TYPE_MAP[type] || type;
}

function setNumberFormatPanels(format, mode) {
    const prefix = mode === 'add' ? 'new-' : '';
    const numberPanel = document.getElementById(`${prefix}number-format-number`);
    const currencyPanel = document.getElementById(`${prefix}number-format-currency`);
    const percentPanel = document.getElementById(`${prefix}number-format-percent`);
    if (!numberPanel || !currencyPanel || !percentPanel) return;
    numberPanel.classList.toggle('hidden', format !== 'number');
    currencyPanel.classList.toggle('hidden', format !== 'currency');
    percentPanel.classList.toggle('hidden', format !== 'percent');
}

window.handleNumberFormatChange = function(format, mode) {
    setNumberFormatPanels(format, mode === 'add' ? 'add' : 'edit');
};

function getNumberConfigFromUI(mode) {
    const prefix = mode === 'add' ? 'new-' : '';
    const formatEl = document.getElementById(`${prefix}number-format-select`);
    const format = (formatEl?.value || 'number');
    if (format === 'currency') {
        return {
            format,
            decimals: Number(document.getElementById(`${prefix}currency-decimals`)?.value ?? 2),
            currencyCode: String(document.getElementById(`${prefix}currency-code`)?.value || 'CNY'),
            thousands: !!document.getElementById(`${prefix}currency-thousands`)?.checked
        };
    }
    if (format === 'percent') {
        return {
            format,
            decimals: Number(document.getElementById(`${prefix}percent-decimals`)?.value ?? 0)
        };
    }
    return {
        format: 'number',
        decimals: Number(document.getElementById(`${prefix}number-decimals`)?.value ?? 0),
        thousands: !!document.getElementById(`${prefix}number-thousands`)?.checked
    };
}

function setNumberConfigToUI(cfg, mode) {
    const prefix = mode === 'add' ? 'new-' : '';
    const formatEl = document.getElementById(`${prefix}number-format-select`);
    if (!formatEl) return;
    const format = cfg?.format || 'number';
    formatEl.value = format;
    setNumberFormatPanels(format, mode);

    if (format === 'currency') {
        const dec = document.getElementById(`${prefix}currency-decimals`);
        const code = document.getElementById(`${prefix}currency-code`);
        const th = document.getElementById(`${prefix}currency-thousands`);
        if (dec) dec.value = String(cfg?.decimals ?? 2);
        if (code) code.value = cfg?.currencyCode || 'CNY';
        if (th) th.checked = !!cfg?.thousands;
        return;
    }
    if (format === 'percent') {
        const dec = document.getElementById(`${prefix}percent-decimals`);
        if (dec) dec.value = String(cfg?.decimals ?? 0);
        return;
    }
    const dec = document.getElementById(`${prefix}number-decimals`);
    const th = document.getElementById(`${prefix}number-thousands`);
    if (dec) dec.value = String(cfg?.decimals ?? 0);
    if (th) th.checked = !!cfg?.thousands;
}

window.handleFieldTypeChange = function(type, mode) {
    const isNumberType = type === 'number';
    if (mode === 'edit') {
        const numArea = document.getElementById('number-config-area');
        if (numArea) numArea.classList.toggle('hidden', !isNumberType);
        if (isNumberType) setNumberConfigToUI(getNumberConfigFromUI('edit'), 'edit');
    } else if (mode === 'add') {
        const numArea = document.getElementById('new-number-config-area');
        if (numArea) numArea.classList.toggle('hidden', !isNumberType);
        if (isNumberType) setNumberConfigToUI(getNumberConfigFromUI('add'), 'add');
    }
};

let kbCustomFields = [
    { id: 'f1', name: '适用版本', type: 'text' },
    { id: 'f2', name: '机密等级', type: 'single_select' }
];

let kbDocFields = [
    { id: 'df1', name: '标题', type: 'text', system: true, required: true, groupId: 'sys', order: 0 },
    { id: 'df2', name: '创建时间', type: 'date', system: true, required: true, groupId: 'sys', order: 1 },
    { id: 'df3', name: '作者', type: 'text', system: false, required: false, groupId: 'g0', order: 0 }
];

let kbDocFieldGroups = [
    { id: 'sys', name: '系统分组', fixed: true, order: 0 },
    { id: 'g0', name: '未分组', fixed: true, order: 1 }
];

const KB_DOC_FIELD_STORAGE_PREFIX = 'kb_doc_field_settings_v1_';

function normalizeDocFieldState() {
    // Ensure groups
    if (!Array.isArray(kbDocFieldGroups) || kbDocFieldGroups.length === 0) {
        kbDocFieldGroups = [
            { id: 'sys', name: '系统分组', fixed: true, order: 0 },
            { id: 'g0', name: '未分组', fixed: true, order: 1 }
        ];
    }
    // Ensure default groups exist (migration)
    if (!kbDocFieldGroups.some(g => g.id === 'sys')) kbDocFieldGroups.unshift({ id: 'sys', name: '系统分组', fixed: true, order: -1 });
    if (!kbDocFieldGroups.some(g => g.id === 'g0')) kbDocFieldGroups.push({ id: 'g0', name: '未分组', fixed: true, order: 9999 });
    kbDocFieldGroups.forEach((g, idx) => {
        if (!g.id) g.id = `g-${idx}`;
        if (typeof g.order !== 'number') g.order = idx;
        if (!g.name) g.name = `分组${idx + 1}`;
    });
    kbDocFieldGroups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const validGroupIds = new Set(kbDocFieldGroups.map(g => g.id));

    // Ensure fields
    if (!Array.isArray(kbDocFields)) kbDocFields = [];
    kbDocFields.forEach((f, idx) => {
        if (!f.id) f.id = `df-${Date.now()}-${idx}`;
        if (!f.name) f.name = '未命名字段';
        if (!f.type) f.type = 'text';
        if (typeof f.system !== 'boolean') f.system = false;
        if (typeof f.required !== 'boolean') f.required = !!f.system;
        // 系统字段强制归类到系统分组；其他字段归类到未分组（或已有分组）
        if (f.system) f.groupId = 'sys';
        else if (!f.groupId || !validGroupIds.has(f.groupId) || f.groupId === 'sys') f.groupId = 'g0';
        if (typeof f.order !== 'number') f.order = idx;
    });
    normalizeDocFieldOrders();
}

function normalizeDocFieldOrders() {
    // Normalize per group
    kbDocFieldGroups.forEach(g => {
        const items = kbDocFields
            .filter(f => f.groupId === g.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        items.forEach((f, idx) => { f.order = idx; });
    });
}

function persistDocFieldSettings() {
    if (!currentSettingsKbId) return;
    try {
        const payload = {
            groups: kbDocFieldGroups,
            fields: kbDocFields
        };
        localStorage.setItem(`${KB_DOC_FIELD_STORAGE_PREFIX}${currentSettingsKbId}`, JSON.stringify(payload));
    } catch (e) {
        // ignore
    }
}

function loadDocFieldSettings(kbId) {
    try {
        const raw = localStorage.getItem(`${KB_DOC_FIELD_STORAGE_PREFIX}${kbId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.groups)) kbDocFieldGroups = parsed.groups;
                if (Array.isArray(parsed.fields)) kbDocFields = parsed.fields;
            }
        }
    } catch (e) {
        // ignore
    }
    normalizeDocFieldState();
}

window.initKbSettingsPage = function(params) {
    console.log('Initializing KB Settings...', params);
    
    // Initialize Retrieval Config UI
    if (window.renderCreateKbRetrievalConfig) {
        window.renderCreateKbRetrievalConfig();
    }
    
    if (params && params.id) {
        currentSettingsKbId = params.id;
        loadKbSettings(params.id);
    } else {
        alert('未指定知识库ID');
        window.history.back();
    }
}

function loadKbSettings(id) {
    // Mock Loading
    // In real app: const data = await fetch(`/api/kb/${id}/settings`);
    
    // Try to find in global data if available, else mock
    let kb = null;
    if (window.knowledgeData) {
        kb = window.knowledgeData.find(k => k.id === id);
    }
    
    if (!kb) {
        kb = {
            id: id,
            name: '示例知识库',
            description: '这是一个用于演示的知识库描述。',
            tags: ['演示', '文档'],
            autoParse: true
        };
    }
    
    // Fill Form
    document.getElementById('setting-kb-name-display').textContent = kb.name;
    document.getElementById('kb-setting-name').value = kb.name;
    document.getElementById('kb-setting-desc').value = kb.description || '';
    
    // Parser Select (Embedding Model)
    const parserSelect = document.getElementById('kb-setting-parser');
    if (parserSelect) {
        parserSelect.value = kb.parser || 'embedding-2';
    }
    // 仅编辑页：切换 embedding 模型需要二次确认
    bindKbParserSelectConfirmIfNeeded();

    // Retrieval Settings
    const rerankModel = document.getElementById('create-kb-rerank-model');
    if (rerankModel) rerankModel.value = kb.retrievalRerankModel || 'bge-reranker-large';
    
    const hybridWeight = document.getElementById('create-kb-hybrid-weight');
    const hybridWeightSlider = document.getElementById('create-kb-hybrid-weight-slider');
    if (hybridWeight && hybridWeightSlider) {
        const val = kb.retrievalHybridWeight !== undefined ? kb.retrievalHybridWeight : 0.5;
        hybridWeight.value = val;
        hybridWeightSlider.value = val;
        const weightDisplay = document.getElementById('create-kb-weight-display');
        if (weightDisplay) weightDisplay.textContent = parseFloat(val).toFixed(1);
    }
    
    const initialTok = document.getElementById('create-kb-initial-tok');
    const initialTokSlider = document.getElementById('create-kb-initial-tok-slider');
    if (initialTok && initialTokSlider) {
        const val = kb.retrievalInitialTok || 25;
        initialTok.value = val;
        initialTokSlider.value = val;
        const initialTokDisplay = document.getElementById('create-kb-initial-tok-display');
        if (initialTokDisplay) initialTokDisplay.textContent = val;
    }

    const similarityThreshold = document.getElementById('create-kb-similarity-threshold');
    const similarityThresholdSlider = document.getElementById('create-kb-similarity-threshold-slider');
    if (similarityThreshold && similarityThresholdSlider) {
        const val = kb.retrievalScoreThreshold !== undefined ? kb.retrievalScoreThreshold : 0.7;
        similarityThreshold.value = val;
        similarityThresholdSlider.value = val;
        const thresholdDisplay = document.getElementById('create-kb-similarity-threshold-display');
        if (thresholdDisplay) thresholdDisplay.textContent = parseFloat(val).toFixed(2);
    }

    const finalTok = document.getElementById('create-kb-final-tok');
    const finalTokSlider = document.getElementById('create-kb-final-tok-slider');
    if (finalTok && finalTokSlider) {
        const val = kb.retrievalFinalTok || 10;
        finalTok.value = val;
        finalTokSlider.value = val;
        const finalTokDisplay = document.getElementById('create-kb-final-tok-display');
        if (finalTokDisplay) finalTokDisplay.textContent = val;
    }

    // Prompt Settings
    const promptEnable = document.getElementById('kb-custom-prompt-enable');
    const promptTemplate = document.getElementById('kb-prompt-template');
    const promptContainer = document.getElementById('kb-prompt-container');
    
    if (promptEnable && promptTemplate) {
        promptEnable.checked = kb.promptEnabled || false;
        promptTemplate.value = kb.promptTemplate || '';
        if (kb.promptEnabled) {
            promptContainer.classList.remove('hidden');
        } else {
            promptContainer.classList.add('hidden');
        }
    }
    
    renderTags(kb.tags || []);
    renderCustomFields();
    loadDocFieldSettings(id);
    renderDocFields();
}

function bindKbParserSelectConfirmIfNeeded() {
    const parserSelect = document.getElementById('kb-setting-parser');
    if (!parserSelect) return;
    if (parserSelect.dataset && parserSelect.dataset.confirmBound === '1') return;
    if (parserSelect.dataset) parserSelect.dataset.confirmBound = '1';

    kbParserSelectPrevValue = parserSelect.value;

    parserSelect.addEventListener('focus', () => {
        kbParserSelectPrevValue = parserSelect.value;
    });

    parserSelect.addEventListener('change', () => {
        const next = parserSelect.value;
        const prev = kbParserSelectPrevValue;
        if (!next || next === prev) {
            kbParserSelectPrevValue = next;
            return;
        }

        const ok = window.confirm(`确认切换为 *${next}模型吗？此操作将导致当前知识库重建索引，过程可能需要一些时间，请耐心等待。`);
        if (!ok) {
            parserSelect.value = prev;
            return;
        }

        kbParserSelectPrevValue = next;
    });
}

// --- Tags Logic ---
function renderTags(tags) {
    const container = document.getElementById('kb-setting-tags');
    const input = container.querySelector('input');
    
    // Remove existing tags
    Array.from(container.querySelectorAll('.tag-item')).forEach(el => el.remove());
    
    tags.forEach(tag => {
        const el = document.createElement('div');
        el.className = 'tag-item bg-blue-50 text-blue-600 px-2 py-1 rounded text-sm flex items-center gap-1';
        el.innerHTML = `
            <span>${tag}</span>
            <button onclick="this.parentElement.remove()" class="hover:text-blue-800"><i class="fa-solid fa-times"></i></button>
        `;
        container.insertBefore(el, input);
    });
}

window.handleTagInput = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) {
            const container = document.getElementById('kb-setting-tags');
            const el = document.createElement('div');
            el.className = 'tag-item bg-blue-50 text-blue-600 px-2 py-1 rounded text-sm flex items-center gap-1';
            el.innerHTML = `
                <span>${val}</span>
                <button onclick="this.parentElement.remove()" class="hover:text-blue-800"><i class="fa-solid fa-times"></i></button>
            `;
            container.insertBefore(el, e.target);
            e.target.value = '';
        }
    }
}

// --- Custom Fields Logic ---
function renderCustomFields() {
    const tbody = document.getElementById('kb-custom-fields-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    kbCustomFields.forEach((field, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-4 py-2 font-medium text-gray-700">${field.name}</td>
            <td class="px-4 py-2 text-gray-500 text-xs uppercase">${getTypeName(field.type)}</td>
            <td class="px-4 py-2 text-right">
                <button onclick="deleteCustomField(${index})" class="text-gray-400 hover:text-red-600 transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openAddFieldModal = function() {
    document.getElementById('add-field-modal').classList.remove('hidden');
    document.getElementById('new-field-name').value = '';
    document.getElementById('new-field-type').value = 'text';
    if (typeof handleFieldTypeChange === 'function') handleFieldTypeChange('text', 'add');
    const newNumberArea = document.getElementById('new-number-config-area');
    if (newNumberArea) newNumberArea.classList.add('hidden');
    setNumberConfigToUI({ format: 'number', decimals: 0, thousands: false }, 'add');
}

window.closeAddFieldModal = function() {
    document.getElementById('add-field-modal').classList.add('hidden');
}

window.confirmAddField = function() {
    const name = document.getElementById('new-field-name').value.trim();
    const type = document.getElementById('new-field-type').value;
    
    if (!name) {
        alert('请输入字段名称');
        return;
    }

    const isNumberType = type === 'number';
    const numberConfig = isNumberType ? getNumberConfigFromUI('add') : null;
    
    kbCustomFields.push({
        id: `f-${Date.now()}`,
        name: name,
        type: type,
        ...(numberConfig ? { numberConfig } : {})
    });
    
    renderCustomFields();
    closeAddFieldModal();
}

window.deleteCustomField = function(index) {
    if (confirm('确定要删除该字段吗？已有的数据可能会丢失。')) {
        kbCustomFields.splice(index, 1);
        renderCustomFields();
    }
}

// --- Document Fields Logic ---
function renderDocFields() {
    const tbody = document.getElementById('kb-doc-fields-body');
    if (!tbody) return;
    
    normalizeDocFieldState();
    tbody.innerHTML = '';

    // Render by group
    kbDocFieldGroups
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach(group => {
            const groupFields = kbDocFields
                .filter(f => f.groupId === group.id)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            const groupTr = document.createElement('tr');
            groupTr.className = 'bg-gray-100/60 text-gray-600';
            groupTr.dataset.groupHeader = 'true';
            groupTr.dataset.groupId = group.id;
            groupTr.innerHTML = `
                <td class="px-4 py-2 font-semibold" colspan="4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-folder-open text-gray-400" aria-hidden="true"></i>
                            <span>${escapeHtml(group.name || '未分组')}</span>
                            <span class="text-xs text-gray-400">(${groupFields.length})</span>
                        </div>
                        <div class="text-xs text-gray-400">${group.id === 'sys' ? '系统字段固定不可移动' : '可拖拽字段到此分组'}</div>
                    </div>
                </td>
            `;
            tbody.appendChild(groupTr);

            if (groupFields.length === 0) {
                const emptyTr = document.createElement('tr');
                emptyTr.className = 'bg-white';
                emptyTr.dataset.groupEmpty = 'true';
                emptyTr.dataset.groupId = group.id;
                emptyTr.innerHTML = `<td class="px-4 py-3 text-sm text-gray-400" colspan="4">暂无字段</td>`;
                tbody.appendChild(emptyTr);
                return;
            }

            groupFields.forEach(field => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 group';
                tr.draggable = !field.system;
                tr.dataset.fieldId = field.id;
                tr.dataset.groupId = group.id;

                const requiredBtn = `
                    <button type="button"
                        ${field.system ? 'disabled' : `onclick="toggleDocFieldRequired('${field.id}')"`}
                        class="${field.required ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${field.system ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                        role="switch"
                        aria-label="是否必填"
                        aria-checked="${field.required ? 'true' : 'false'}">
                        <span class="sr-only">是否必填</span>
                        <span class="${field.required ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                    </button>
                `;

                tr.innerHTML = `
                    <td class="px-4 py-2 font-medium text-gray-700">
                        <span class="inline-flex items-center gap-2">
                            <i class="fa-solid fa-grip-vertical text-gray-300 group-hover:text-gray-400" aria-hidden="true"></i>
                            <span>${escapeHtml(field.name)}</span>
                            ${field.system ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-1">系统</span>' : ''}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-gray-500 text-xs uppercase">${escapeHtml(getTypeName(field.type))}</td>
                    <td class="px-4 py-2">${requiredBtn}</td>
                    <td class="px-4 py-2 text-right">
                        ${!field.system ? `
                            <button type="button" onclick="openEditDocFieldModalById('${field.id}')" class="text-gray-400 hover:text-blue-600 mr-2" aria-label="编辑字段">
                                <i class="fa-solid fa-edit" aria-hidden="true"></i>
                            </button>
                            <button type="button" onclick="deleteDocFieldById('${field.id}')" class="text-gray-400 hover:text-red-600" aria-label="删除字段">
                                <i class="fa-solid fa-trash" aria-hidden="true"></i>
                            </button>
                        ` : '<span class="text-xs text-gray-400 italic">不可编辑</span>'}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });

    initDocFieldDnD();
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

let draggingDocFieldId = null;
let docFieldDnDInitialized = false;

function initDocFieldDnD() {
    const tbody = document.getElementById('kb-doc-fields-body');
    if (!tbody) return;
    if (docFieldDnDInitialized) return;
    docFieldDnDInitialized = true;

    tbody.addEventListener('dragstart', onDocFieldDragStart);
    tbody.addEventListener('dragover', onDocFieldDragOver);
    tbody.addEventListener('drop', onDocFieldDrop);
    tbody.addEventListener('dragend', onDocFieldDragEnd);
}

function onDocFieldDragStart(e) {
    const row = e.target.closest('tr[data-field-id]');
    if (!row) return;
    const field = kbDocFields.find(f => f.id === row.dataset.fieldId);
    if (field?.system) return;
    draggingDocFieldId = row.dataset.fieldId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggingDocFieldId);
    row.classList.add('opacity-50');
}

function onDocFieldDragOver(e) {
    const targetRow = e.target.closest('tr');
    if (!targetRow) return;
    if (!draggingDocFieldId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    targetRow.classList.add('bg-blue-50/50');
}

function onDocFieldDrop(e) {
    const targetRow = e.target.closest('tr');
    if (!targetRow) return;
    const fieldId = draggingDocFieldId || e.dataTransfer.getData('text/plain');
    if (!fieldId) return;
    e.preventDefault();

    // Drop onto group header / empty row => move to group end
    if (targetRow.dataset.groupHeader === 'true' || targetRow.dataset.groupEmpty === 'true') {
        moveDocFieldToGroupEnd(fieldId, targetRow.dataset.groupId);
        renderDocFields();
        return;
    }

    // Drop onto another field row => insert before/after
    const targetFieldId = targetRow.dataset.fieldId;
    if (!targetFieldId || targetFieldId === fieldId) return;

    const rect = targetRow.getBoundingClientRect();
    const placeAfter = (e.clientY - rect.top) > rect.height / 2;
    moveDocFieldRelative(fieldId, targetFieldId, placeAfter);
    renderDocFields();
}

function onDocFieldDragEnd(e) {
    const rows = document.querySelectorAll('#kb-doc-fields-body tr');
    rows.forEach(r => r.classList.remove('bg-blue-50/50', 'opacity-50'));
    draggingDocFieldId = null;
}

function moveDocFieldToGroupEnd(fieldId, groupId) {
    if (!groupId) return;
    const field = kbDocFields.find(f => f.id === fieldId);
    if (!field) return;
    if (field.system) return;
    if (groupId === 'sys') return;
    field.groupId = groupId;
    field.order = 999999;
    normalizeDocFieldOrders();
    persistDocFieldSettings();
}

function moveDocFieldRelative(fieldId, targetFieldId, placeAfter) {
    const field = kbDocFields.find(f => f.id === fieldId);
    const target = kbDocFields.find(f => f.id === targetFieldId);
    if (!field || !target) return;
    if (field.system) return;

    const toGroupId = target.groupId;
    if (toGroupId === 'sys') return;
    const fromGroupId = field.groupId;

    const fromList = kbDocFields.filter(f => f.groupId === fromGroupId && f.id !== fieldId).sort((a, b) => a.order - b.order);
    const toList = kbDocFields.filter(f => f.groupId === toGroupId && f.id !== fieldId).sort((a, b) => a.order - b.order);

    const insertIndex = Math.max(0, toList.findIndex(f => f.id === targetFieldId) + (placeAfter ? 1 : 0));
    field.groupId = toGroupId;
    toList.splice(insertIndex, 0, field);

    // Write back orders
    fromList.forEach((f, i) => { f.order = i; });
    toList.forEach((f, i) => { f.order = i; });

    persistDocFieldSettings();
}

window.toggleDocFieldRequired = function(fieldId) {
    const field = kbDocFields.find(f => f.id === fieldId);
    if (!field) return;
    if (field.system) return;
    field.required = !field.required;
    persistDocFieldSettings();
    renderDocFields();
}

window.openEditDocFieldModalById = function(fieldId) {
    const idx = kbDocFields.findIndex(f => f.id === fieldId);
    if (idx < 0) return;
    window.openEditDocFieldModal(idx);
}

window.deleteDocFieldById = function(fieldId) {
    const idx = kbDocFields.findIndex(f => f.id === fieldId);
    if (idx < 0) return;
    window.deleteDocField(idx);
}

// --- Document Field Grouping Modal ---
window.openDocFieldGroupModal = function() {
    const modal = document.getElementById('doc-field-group-modal');
    if (!modal) return;
    normalizeDocFieldState();
    renderDocFieldGroupModal();
    modal.classList.remove('hidden');
}

window.closeDocFieldGroupModal = function() {
    const modal = document.getElementById('doc-field-group-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    persistDocFieldSettings();
    renderDocFields();
}

window.addDocFieldGroup = function() {
    const input = document.getElementById('kb-field-group-new-name');
    const name = (input?.value || '').trim();
    if (!name) return;
    const id = `g-${Date.now()}`;
    kbDocFieldGroups.push({ id, name, fixed: false, order: kbDocFieldGroups.length });
    if (input) input.value = '';
    normalizeDocFieldState();
    persistDocFieldSettings();
    renderDocFieldGroupModal();
    renderDocFields();
}

window.renameDocFieldGroup = function(groupId, value) {
    const g = kbDocFieldGroups.find(x => x.id === groupId);
    if (!g || g.fixed) return;
    g.name = (value || '').trim() || g.name;
    persistDocFieldSettings();
    renderDocFieldGroupModal();
    renderDocFields();
}

window.deleteDocFieldGroup = function(groupId) {
    const g = kbDocFieldGroups.find(x => x.id === groupId);
    if (!g || g.fixed) return;
    window.openDeleteDocFieldGroupModal(groupId);
}

// 删除分组：单弹窗三按钮（取消 / 全删除 / 仅删除分组保留字段）
window.openDeleteDocFieldGroupModal = function(groupId) {
    const modal = document.getElementById('doc-field-group-delete-modal');
    if (!modal) return;
    const g = kbDocFieldGroups.find(x => x.id === groupId);
    if (!g || g.fixed) return;
    modal.dataset.groupId = groupId;
    modal.classList.remove('hidden');
};

window.closeDeleteDocFieldGroupModal = function() {
    const modal = document.getElementById('doc-field-group-delete-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    delete modal.dataset.groupId;
};

window.confirmDeleteDocFieldGroupAction = function(action) {
    const modal = document.getElementById('doc-field-group-delete-modal');
    if (!modal) return;
    const groupId = modal.dataset.groupId;
    if (!groupId) return window.closeDeleteDocFieldGroupModal();

    const g = kbDocFieldGroups.find(x => x.id === groupId);
    if (!g || g.fixed) return window.closeDeleteDocFieldGroupModal();

    if (action === 'all') {
        // 全删除：分组 + 分组下字段
        kbDocFields = kbDocFields.filter(f => f.groupId !== groupId);
    } else if (action === 'move') {
        // 仅删分组：字段移至未分组
        kbDocFields.forEach(f => {
            if (f.groupId === groupId) {
                f.groupId = 'g0';
                f.order = 999999;
            }
        });
    } else {
        return window.closeDeleteDocFieldGroupModal();
    }

    kbDocFieldGroups = kbDocFieldGroups.filter(x => x.id !== groupId);
    normalizeDocFieldState();
    persistDocFieldSettings();
    if (typeof renderDocFieldGroupModal === 'function') renderDocFieldGroupModal();
    if (typeof renderDocFields === 'function') renderDocFields();

    window.closeDeleteDocFieldGroupModal();
};

window.assignDocFieldGroup = function(fieldId, groupId) {
    const field = kbDocFields.find(f => f.id === fieldId);
    if (!field) return;
    if (field.system) return;
    if (groupId === 'sys') return;
    field.groupId = groupId;
    field.order = 999999;
    normalizeDocFieldOrders();
    persistDocFieldSettings();
    renderDocFields();
}

function renderDocFieldGroupModal() {
    const list = document.getElementById('kb-field-group-list');
    if (!list) return;

    list.innerHTML = '';

    const groups = kbDocFieldGroups.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    groups.forEach(g => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML = `
            <input ${g.fixed ? 'disabled' : ''} value="${escapeHtml(g.name || '')}" class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${g.fixed ? 'bg-gray-50 text-gray-500' : ''}" oninput="renameDocFieldGroup('${g.id}', this.value)" aria-label="分组名称">
            <button type="button" ${g.fixed ? 'disabled' : ''} onclick="deleteDocFieldGroup('${g.id}')" class="px-2 py-2 text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="删除分组">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
        `;
        list.appendChild(row);
    });
}

let currentDocFieldIndex = -1;

window.openAddDocFieldModal = function() {
    currentDocFieldIndex = -1;
    document.getElementById('doc-field-modal-title').textContent = '新增文档字段';
    document.getElementById('doc-field-name').value = '';
    document.getElementById('doc-field-type').value = 'text';
    const numArea = document.getElementById('number-config-area');
    if (numArea) numArea.classList.add('hidden');
    setNumberConfigToUI({ format: 'number', decimals: 0, thousands: false }, 'edit');
    if (typeof handleFieldTypeChange === 'function') handleFieldTypeChange('text', 'edit');
    document.getElementById('add-doc-field-modal').classList.remove('hidden');
}

window.openEditDocFieldModal = function(index) {
    currentDocFieldIndex = index;
    const field = kbDocFields[index];
    document.getElementById('doc-field-modal-title').textContent = '编辑文档字段';
    document.getElementById('doc-field-name').value = field.name;
    document.getElementById('doc-field-type').value = field.type;
    if (field.type === 'number') {
        setNumberConfigToUI(field.numberConfig || { format: 'number', decimals: 0, thousands: false }, 'edit');
    }
    if (typeof handleFieldTypeChange === 'function') handleFieldTypeChange(field.type, 'edit');
    document.getElementById('add-doc-field-modal').classList.remove('hidden');
}

window.closeAddDocFieldModal = function() {
    document.getElementById('add-doc-field-modal').classList.add('hidden');
}

window.confirmSaveDocField = function() {
    const name = document.getElementById('doc-field-name').value.trim();
    const type = document.getElementById('doc-field-type').value;
    
    if (!name) {
        alert('请填写字段名称');
        return;
    }

    const isNumberType = type === 'number';
    const numberConfig = isNumberType ? getNumberConfigFromUI('edit') : null;
    
    if (currentDocFieldIndex === -1) {
        // Add
        kbDocFields.push({
            id: `df-${Date.now()}`,
            name: name,
            type: type,
            system: false,
            required: false,
            groupId: 'g0',
            order: 999999,
            ...(numberConfig ? { numberConfig } : {})
        });
    } else {
        // Edit
        kbDocFields[currentDocFieldIndex].name = name;
        kbDocFields[currentDocFieldIndex].type = type;
        if (numberConfig) kbDocFields[currentDocFieldIndex].numberConfig = numberConfig;
        else delete kbDocFields[currentDocFieldIndex].numberConfig;
    }
    
    normalizeDocFieldState();
    persistDocFieldSettings();
    renderDocFields();
    closeAddDocFieldModal();
}

window.deleteDocField = function(index) {
    if (kbDocFields[index].system) {
        alert('系统字段无法删除');
        return;
    }
    
    if (confirm(`确定要删除字段 "${kbDocFields[index].name}" 吗？`)) {
        kbDocFields.splice(index, 1);
        normalizeDocFieldState();
        persistDocFieldSettings();
        renderDocFields();
    }
}



// --- Global Actions ---
window.saveKbSettings = function() {
    // Collect Data
    const name = document.getElementById('kb-setting-name').value;
    if (!name) {
        alert('知识库名称不能为空');
        return;
    }
    
    // Update Mock Data if exists
    if (window.knowledgeData) {
        const kb = window.knowledgeData.find(k => k.id === currentSettingsKbId);
        if (kb) {
            kb.name = name;
            kb.description = document.getElementById('kb-setting-desc').value;
            kb.parser = document.getElementById('kb-setting-parser').value;
            
            // Retrieval Settings
            kb.retrievalRerankModel = document.getElementById('create-kb-rerank-model')?.value;
            kb.retrievalHybridWeight = Number(document.getElementById('create-kb-hybrid-weight')?.value);
            kb.retrievalInitialTok = Number(document.getElementById('create-kb-initial-tok')?.value);
            kb.retrievalScoreThreshold = Number(document.getElementById('create-kb-similarity-threshold')?.value);
            kb.retrievalFinalTok = Number(document.getElementById('create-kb-final-tok')?.value);

            // Prompt
            kb.promptEnabled = document.getElementById('kb-custom-prompt-enable').checked;
            kb.promptTemplate = document.getElementById('kb-prompt-template').value;
            
            // Update other fields...
        }
    }
    
    alert('设置已保存！');
}

window.exportKbSettings = function() {
    const data = {
        id: currentSettingsKbId,
        name: document.getElementById('kb-setting-name').value,
        fields: kbCustomFields,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kb-settings-${currentSettingsKbId}.json`;
    a.click();
}

window.importKbSettings = function() {
    // Mock Import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            alert(`已导入配置: ${file.name}`);
            // Parse logic here
        }
    };
    input.click();
}

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'knowledge-settings') {
        window.initKbSettingsPage(e.detail.params);
    }
});
