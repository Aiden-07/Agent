// Knowledge Graph Management Logic

let kgData = [];
let currentKgFilter = { search: '' };

// Mock Data Generators
const KG_NAMES = [
    '金融风险控制图谱', '医疗疾病诊断图谱', '企业股权穿透图谱', '电商商品关系图谱', 
    '网络安全威胁图谱', '供应链关系图谱', '法律法规知识图谱', '智能制造工艺图谱'
];

window.initKnowledgeGraphPage = function() {
    console.log('Initializing Knowledge Graph Page...');
    if (kgData.length === 0) {
        kgData = generateMockKgData(8);
    }
    renderKgList();
}

function generateMockKgData(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        const name = KG_NAMES[i % KG_NAMES.length];
        data.push({
            id: `KG-${Date.now()}-${i}`,
            name: name,
            description: `包含${name}相关的核心实体与关系，用于智能分析与推理。`,
            entityCount: Math.floor(Math.random() * 50000) + 1000,
            docCount: Math.floor(Math.random() * 500) + 10,
            creator: 'Admin',
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toLocaleString()
        });
    }
    // Sort by created time desc
    return data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Render List
function renderKgList() {
    const tbody = document.getElementById('kg-list-body');
    const emptyState = document.getElementById('kg-empty');
    const loadingState = document.getElementById('kg-loading');
    const totalCount = document.getElementById('kg-total-count');
    
    if (!tbody) return;

    // Simulate Loading
    tbody.innerHTML = '';
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');

    setTimeout(() => {
        loadingState.classList.add('hidden');
        
        // Filter
        let filteredData = kgData.filter(item => {
            const search = currentKgFilter.search.toLowerCase();
            return item.name.toLowerCase().includes(search) || item.description.toLowerCase().includes(search);
        });

        if (totalCount) totalCount.textContent = filteredData.length;

        if (filteredData.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        filteredData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            
            tr.innerHTML = `
                <td class="px-6 py-4 text-gray-500">${index + 1}</td>
                <td class="px-6 py-4">
                    <a href="javascript:void(0)" onclick="viewKgDetail('${item.id}')" class="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                        ${item.name}
                    </a>
                </td>
                <td class="px-6 py-4">
                    <div class="text-gray-500 max-w-xs truncate" title="${item.description}">
                        ${item.description}
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="bg-blue-50 text-blue-700 py-1 px-2 rounded text-xs font-mono">${formatNumber(item.entityCount)}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="bg-gray-100 text-gray-700 py-1 px-2 rounded text-xs font-mono">${formatNumber(item.docCount)}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                            ${item.creator.charAt(0)}
                        </div>
                        ${item.creator}
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${item.createdAt}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.openKgActions(event, '${item.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }, 300); // Fake delay
}

window.openKgActions = function(event, id) {
    window.showActionMenu(event, [
        {
            label: '配置权限',
            icon: 'fa-solid fa-user-shield',
            onClick: () => {
                const item = kgData.find(k => k.id === id);
                if(item) {
                    if (window.navigateToPermissionConfig) {
                        window.navigateToPermissionConfig(id, 'knowledge_graph', item.name);
                    } else {
                        console.error('navigateToPermissionConfig is not defined');
                    }
                }
            }
        },
        {
            label: '知识管理',
            icon: 'fa-solid fa-database',
            onClick: () => manageKg(id)
        },
        {
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => editKg(id)
        },
        {
            label: '可视化',
            icon: 'fa-solid fa-share-nodes',
            onClick: () => visualizeKg(id)
        },
        {
            label: '重建',
            icon: 'fa-solid fa-rotate',
            onClick: () => rebuildKg(id)
        },
        {
            label: '清空',
            icon: 'fa-solid fa-eraser',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => clearKg(id)
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => deleteKg(id)
        }
    ]);
}

function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

window.filterKnowledgeGraphs = function() {
    const input = document.getElementById('kg-search-input');
    currentKgFilter.search = input ? input.value : '';
    renderKgList();
}

// Actions
window.submitCreateKg = function() {
    const nameInput = document.getElementById('create-kg-name');
    const descInput = document.getElementById('create-kg-desc');
    const editIdInput = document.getElementById('edit-kg-id');
    const nameError = document.getElementById('create-kg-name-error');
    
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    const editId = editIdInput.value;

    if (!name) {
        nameError.classList.remove('hidden');
        return;
    }
    nameError.classList.add('hidden');

    if (editId) {
        // Update
        const index = kgData.findIndex(item => item.id === editId);
        if (index !== -1) {
            kgData[index].name = name;
            kgData[index].description = desc;
        }
    } else {
        // Create
        const newKg = {
            id: `KG-${Date.now()}`,
            name: name,
            description: desc,
            entityCount: 0,
            docCount: 0,
            creator: 'Admin', // Mock user
            createdAt: new Date().toLocaleString()
        };
        kgData.unshift(newKg);
    }

    closeModal('create-kg-modal');
    renderKgList();
    
    // Clear form
    nameInput.value = '';
    descInput.value = '';
    editIdInput.value = '';
}

window.openCreateKgModal = function() {
    const modal = document.getElementById('create-kg-modal');
    const title = document.getElementById('create-kg-modal-title');
    const editIdInput = document.getElementById('edit-kg-id');
    const nameInput = document.getElementById('create-kg-name');
    const descInput = document.getElementById('create-kg-desc');

    if (title) title.textContent = '新建知识图谱';
    if (editIdInput) editIdInput.value = '';
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';

    openModal('create-kg-modal');
}

window.editKg = function(id) {
    const item = kgData.find(k => k.id === id);
    if (!item) return;

    const title = document.getElementById('create-kg-modal-title');
    const editIdInput = document.getElementById('edit-kg-id');
    const nameInput = document.getElementById('create-kg-name');
    const descInput = document.getElementById('create-kg-desc');

    if (title) title.textContent = '编辑知识图谱';
    if (editIdInput) editIdInput.value = id;
    if (nameInput) nameInput.value = item.name;
    if (descInput) descInput.value = item.description;

    openModal('create-kg-modal');
}

window.deleteKg = function(id) {
    showConfirmModal('删除图谱', '此操作将永久删除该知识图谱及其所有数据，不可恢复。确定要继续吗？', () => {
        kgData = kgData.filter(item => item.id !== id);
        renderKgList();
        closeModal('kg-confirm-modal');
    }, true);
}

window.clearKg = function(id) {
    showConfirmModal('清空图谱', '此操作将清除图谱中的所有实体和关系数据。确定要继续吗？', () => {
        const item = kgData.find(k => k.id === id);
        if (item) {
            item.entityCount = 0;
            item.docCount = 0;
            renderKgList();
        }
        closeModal('kg-confirm-modal');
    });
}

window.rebuildKg = function(id) {
    showConfirmModal('重建图谱', '将重新扫描文档并提取知识，这可能需要一些时间。确定要开始吗？', () => {
        // Mock rebuilding process
        alert('开始重建图谱任务...');
        closeModal('kg-confirm-modal');
    });
}

window.manageKg = function(id) {
    switchView('knowledge-graph-detail', { id: id });
}

window.visualizeKg = function(id) {
    alert(`打开图谱 [${id}] 的可视化界面`);
}

window.viewKgDetail = function(id) {
    // Just reuse visualize for now or show detail
    window.visualizeKg(id);
}

// Helper for Confirm Modal
function showConfirmModal(title, msg, onConfirm, isDanger = false) {
    const modal = document.getElementById('kg-confirm-modal');
    const titleEl = document.getElementById('kg-confirm-title');
    const msgEl = document.getElementById('kg-confirm-msg');
    const btn = document.getElementById('kg-confirm-btn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    
    if (btn) {
        btn.onclick = onConfirm;
        if (isDanger) {
            btn.className = 'px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm';
        } else {
            btn.className = 'px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm';
        }
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}
