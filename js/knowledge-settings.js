// Knowledge Base Settings Logic

let currentSettingsKbId = null;
let kbCustomFields = [
    { id: 'f1', name: '适用版本', type: 'text', required: false },
    { id: 'f2', name: '机密等级', type: 'select', required: true }
];

window.initKbSettingsPage = function(params) {
    console.log('Initializing KB Settings...', params);
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
    document.getElementById('kb-auto-parse').checked = kb.autoParse !== false;
    
    renderTags(kb.tags || []);
    renderCustomFields();
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
            <td class="px-4 py-2 text-gray-500 text-xs uppercase">${field.type}</td>
            <td class="px-4 py-2">
                ${field.required ? '<span class="text-red-500 text-xs font-bold">是</span>' : '<span class="text-gray-400 text-xs">否</span>'}
            </td>
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
    document.getElementById('new-field-required').checked = false;
}

window.closeAddFieldModal = function() {
    document.getElementById('add-field-modal').classList.add('hidden');
}

window.confirmAddField = function() {
    const name = document.getElementById('new-field-name').value.trim();
    const type = document.getElementById('new-field-type').value;
    const required = document.getElementById('new-field-required').checked;
    
    if (!name) {
        alert('请输入字段名称');
        return;
    }
    
    kbCustomFields.push({
        id: `f-${Date.now()}`,
        name: name,
        type: type,
        required: required
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
