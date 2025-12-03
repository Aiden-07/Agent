// Component Square Management Logic

// Global State
window.componentsData = [];
window.currentFilter = { type: 'all', search: '' };
let createCompConfig = { type: 'agent', method: 'new' };

const COMP_NAMES = [
    '客服接待标准模板', '代码审计流程模板', '销售话术库', 'RAG 知识检索模板', 
    '多轮对话编排模板', '自动回复机器人', '数据清洗流程', '日报生成助手'
];

// Initialize Page
window.initComponentsPage = function() {
    console.log('Initializing Components Page...');
    if (window.componentsData.length === 0) {
        window.componentsData = generateMockComponents(8);
    }
    renderComponentsList();
}

function generateMockComponents(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        // Use window.generateId if available, else fallback
        const id = (window.generateId && typeof window.generateId === 'function') 
            ? window.generateId('CMP') 
            : `CMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
        const name = COMP_NAMES[i % COMP_NAMES.length];
        const isAgent = Math.random() > 0.4;
        
        data.push({
            id: id,
            name: name,
            type: isAgent ? 'agent' : 'orchestrator',
            refCount: Math.floor(Math.random() * 15),
            description: isAgent ? `基于 ${name} 的标准智能体模板，可快速复用。` : `包含 ${name} 的完整编排流程配置。`,
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            version: `v1.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
            creator: 'Admin',
            status: Math.random() > 0.1 ? 'active' : 'disabled'
        });
    }
    return data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

window.renderComponentsList = function() {
    const tbody = document.getElementById('components-list-body');
    if (!tbody) {
        console.warn('Components list body not found');
        return;
    }

    // Filter
    let filteredData = window.componentsData.filter(item => {
        const matchType = window.currentFilter.type === 'all' || item.type === window.currentFilter.type;
        const matchSearch = item.name.toLowerCase().includes(window.currentFilter.search.toLowerCase());
        return matchType && matchSearch;
    });

    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fa-solid fa-box-open text-3xl text-gray-300"></i>
                        <p>暂无组件数据</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filteredData.forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        
        const statusClass = item.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500';
        const statusText = item.status === 'active' ? '已启用' : '已禁用';
        
        const typeIcon = item.type === 'agent' ? 'fa-robot text-purple-600 bg-purple-100' : 'fa-layer-group text-blue-600 bg-blue-100';
        const typeText = item.type === 'agent' ? '智能体模板' : '编排器模板';

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${typeIcon} flex items-center justify-center">
                        <i class="fa-solid ${item.type === 'agent' ? 'fa-robot' : 'fa-layer-group'}"></i>
                    </div>
                    <div>
                        <div class="font-medium text-gray-900">${item.name}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${typeText}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">${item.refCount} 引用</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${item.description}">
                ${item.description}
            </td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.updatedAt}</td>
            <td class="px-6 py-4 text-sm text-gray-600 font-mono">${item.version}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="alert('编辑组件: ${item.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="编辑">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteComponent('${item.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterComponents = function() {
    const searchInput = document.getElementById('comp-search-input');
    const typeSelect = document.getElementById('comp-filter-type');
    
    window.currentFilter.search = searchInput ? searchInput.value : '';
    window.currentFilter.type = typeSelect ? typeSelect.value : 'all';
    
    renderComponentsList();
}

window.sortComponents = function(field) {
    window.componentsData.sort((a, b) => {
        if (a[field] < b[field]) return -1;
        if (a[field] > b[field]) return 1;
        return 0;
    });
    renderComponentsList();
}

// Create Modal Logic
window.openCreateComponentModal = function() {
    const modal = document.getElementById('create-comp-modal');
    if (modal) modal.classList.remove('hidden');
    createCompConfig = { type: 'agent', method: 'new' };
    updateCreateUI();
}

window.closeCreateComponentModal = function() {
    const modal = document.getElementById('create-comp-modal');
    if (modal) modal.classList.add('hidden');
}

window.selectCompType = function(type) {
    createCompConfig.type = type;
    updateCreateUI();
}

function updateCreateUI() {
    const methodSelect = document.getElementById('comp-create-method');
    const sourceSelect = document.getElementById('comp-source-select');
    
    if (methodSelect) {
        methodSelect.onchange = (e) => {
            createCompConfig.method = e.target.value;
            if (e.target.value === 'publish') {
                sourceSelect.classList.remove('hidden');
            } else {
                sourceSelect.classList.add('hidden');
            }
        };
    }
}

window.submitCreateComponent = function() {
    window.closeCreateComponentModal();
    
    // Check for switchView function
    if (typeof window.switchView !== 'function') {
        console.error('switchView function not found!');
        alert('Navigation Error: switchView is missing.');
        return;
    }

    if (createCompConfig.method === 'new') {
        if (createCompConfig.type === 'agent') {
            window.switchView('agent-editor'); // Redirect to Agent Editor
        } else {
             // Create a temporary ID for the new orchestrator component
             const newOrchId = (window.generateId && typeof window.generateId === 'function') 
                ? window.generateId('WF') 
                : `WF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            // Redirect to Orchestrator Editor
            window.switchView('orchestrator-editor', { id: newOrchId }); 
        }
    } else {
        // Publish Flow
        alert('发布已有组件功能正在开发中...');
    }
}

// Delete Logic
let deletingCompId = null;

window.deleteComponent = function(id) {
    deletingCompId = id;
    const comp = window.componentsData.find(c => c.id === id);
    if (!comp) return;
    
    const modal = document.getElementById('delete-safety-modal');
    if (!modal) return;
    
    // Populate Modal
    document.getElementById('del-comp-name').textContent = comp.name;
    document.getElementById('del-ref-count').textContent = comp.refCount;
    
    const refList = document.getElementById('del-ref-list');
    refList.innerHTML = '';
    
    if (comp.refCount > 0) {
        // Mock References
        for(let i=0; i<Math.min(comp.refCount, 5); i++) {
            refList.innerHTML += `<li><i class="fa-solid fa-link text-gray-400 mr-2"></i>引用项目-${i+1}</li>`;
        }
        if (comp.refCount > 5) {
             refList.innerHTML += `<li class="text-gray-500 italic">...等 ${comp.refCount} 个引用</li>`;
        }
    } else {
        refList.innerHTML = `<li class="text-gray-500 italic">无引用</li>`;
    }
    
    // Reset Checkbox
    const check = document.getElementById('del-confirm-check');
    const btn = document.getElementById('btn-del-confirm');
    if (check) {
        check.checked = false;
        check.onchange = (e) => btn.disabled = !e.target.checked;
    }
    if (btn) btn.disabled = true;
    
    modal.classList.remove('hidden');
}

window.closeDeleteSafetyModal = function() {
    const modal = document.getElementById('delete-safety-modal');
    if (modal) modal.classList.add('hidden');
    deletingCompId = null;
}

window.confirmDeleteComponent = function() {
    if (!deletingCompId) return;
    
    window.componentsData = window.componentsData.filter(c => c.id !== deletingCompId);
    renderComponentsList();
    closeDeleteSafetyModal();
    
    // Show Toast
    alert('组件已安全删除');
}

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'components') {
        window.initComponentsPage();
    }
});
