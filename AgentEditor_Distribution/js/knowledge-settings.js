// Knowledge Base Settings Logic

let currentSettingsKbId = null;

const FIELD_TYPE_MAP = {
    'text': '文本',
    'textarea': '多行文本',
    'number': '数字',
    'date': '日期',
    'select': '下拉列表',
    'category': '下拉列表', // Map legacy category to select
    'boolean': '布尔值'
};

function getTypeName(type) {
    return FIELD_TYPE_MAP[type] || type;
}

let kbCustomFields = [
    { id: 'f1', name: '适用版本', type: 'text' },
    { id: 'f2', name: '机密等级', type: 'select' }
];

let kbDocFields = [
    { id: 'df1', name: '标题', type: 'text', system: true },
    { id: 'df2', name: '创建时间', type: 'date', system: true },
    { id: 'df3', name: '作者', type: 'text', system: false }
];

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
    renderDocFields();
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
    
    kbCustomFields.push({
        id: `f-${Date.now()}`,
        name: name,
        type: type
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
    
    tbody.innerHTML = '';
    kbDocFields.forEach((field, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 group';
        tr.innerHTML = `
            <td class="px-4 py-2 font-medium text-gray-700">
                ${field.name}
                ${field.system ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">系统</span>' : ''}
            </td>
            <td class="px-4 py-2 text-gray-500 text-xs uppercase">${getTypeName(field.type)}</td>
            <td class="px-4 py-2 text-right">
                ${!field.system ? `
                    <button onclick="openEditDocFieldModal(${index})" class="text-gray-400 hover:text-blue-600 mr-2">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button onclick="deleteDocField(${index})" class="text-gray-400 hover:text-red-600">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : '<span class="text-xs text-gray-400 italic">不可编辑</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let currentDocFieldIndex = -1;

window.openAddDocFieldModal = function() {
    currentDocFieldIndex = -1;
    document.getElementById('doc-field-modal-title').textContent = '新增文档字段';
    document.getElementById('doc-field-name').value = '';
    document.getElementById('doc-field-type').value = 'text';
    document.getElementById('add-doc-field-modal').classList.remove('hidden');
}

window.openEditDocFieldModal = function(index) {
    currentDocFieldIndex = index;
    const field = kbDocFields[index];
    document.getElementById('doc-field-modal-title').textContent = '编辑文档字段';
    document.getElementById('doc-field-name').value = field.name;
    document.getElementById('doc-field-type').value = field.type;
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
    
    if (currentDocFieldIndex === -1) {
        // Add
        kbDocFields.push({
            id: `df-${Date.now()}`,
            name: name,
            type: type,
            system: false
        });
    } else {
        // Edit
        kbDocFields[currentDocFieldIndex].name = name;
        kbDocFields[currentDocFieldIndex].type = type;
    }
    
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
