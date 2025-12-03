// Orchestrator Management Logic

window.orchestratorData = [];
const ORCH_NAMES = [
    '订单处理流程', '每日日报汇总', '客户投诉自动分类', '新员工入职指引', 
    '发票报销审批', '代码自动部署', '社交媒体监控', '竞品价格分析',
    '服务器健康检查', '数据备份流程'
];
const ORCH_TRIGGERS = ['API Webhook', 'Cron Schedule', 'Event Driven', 'Manual'];

// Initialize Page
window.initOrchestratorPage = function() {
    console.log('Initializing Orchestrator Page...');
    if (window.orchestratorData.length === 0) {
        window.orchestratorData = generateMockOrchestrators(10);
    }
    renderOrchestratorList();
    setupInputListeners();
}

function generateMockOrchestrators(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        const id = (window.generateId && typeof window.generateId === 'function') 
            ? window.generateId('WF') 
            : `WF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
        const name = ORCH_NAMES[i % ORCH_NAMES.length];
        
        data.push({
            id: id,
            name: name,
            description: `This is a description for ${name}, handling automated tasks efficiently.`,
            agent: `Agent-${Math.floor(Math.random() * 5) + 1}`,
            status: Math.random() > 0.3 ? 'active' : 'paused',
            nodeCount: Math.floor(Math.random() * 10) + 3,
            creator: 'Admin',
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toLocaleString(),
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            trigger: ORCH_TRIGGERS[Math.floor(Math.random() * ORCH_TRIGGERS.length)]
        });
    }
    return data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderOrchestratorList() {
    const tbody = document.getElementById('orchestrator-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (window.orchestratorData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fa-solid fa-diagram-project text-3xl text-gray-300"></i>
                        <p>暂无编排器数据</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    window.orchestratorData.forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        
        const statusClass = item.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500';
        const statusText = item.status === 'active' ? 'Active' : 'Paused';

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <i class="fa-solid fa-diagram-project"></i>
                    </div>
                    <div>
                        <div class="font-medium text-gray-900">${item.name}</div>
                        <div class="text-xs text-gray-500 truncate max-w-[150px]" title="${item.description}">${item.description}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.agent}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.nodeCount}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.creator}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.createdAt}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.updatedAt}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editOrchestrator('${item.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="编辑">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteOrchestrator('${item.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Create Modal Logic ---

function setupInputListeners() {
    const nameInput = document.getElementById('orch-name-input');
    const descInput = document.getElementById('orch-desc-input');
    
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            document.getElementById('orch-name-count').textContent = e.target.value.length;
        });
    }
    
    if (descInput) {
        descInput.addEventListener('input', (e) => {
            document.getElementById('orch-desc-count').textContent = e.target.value.length;
        });
    }
}

window.openCreateOrchestratorModal = function() {
    const modal = document.getElementById('create-orch-modal');
    if (modal) modal.classList.remove('hidden');
    
    // Reset inputs
    document.getElementById('orch-name-input').value = '';
    document.getElementById('orch-desc-input').value = '';
    document.getElementById('orch-name-count').textContent = '0';
    document.getElementById('orch-desc-count').textContent = '0';
}

window.closeCreateOrchestratorModal = function() {
    const modal = document.getElementById('create-orch-modal');
    if (modal) modal.classList.add('hidden');
}

window.submitCreateOrchestrator = function() {
    const name = document.getElementById('orch-name-input').value.trim();
    const desc = document.getElementById('orch-desc-input').value.trim();
    
    if (!name) {
        alert('请输入编排器名称');
        return;
    }
    
    const newOrch = {
        id: (window.generateId && typeof window.generateId === 'function') 
            ? window.generateId('WF') 
            : `WF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: name,
        description: desc,
        agent: '-',
        status: 'active',
        nodeCount: 0,
        creator: 'Current User',
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString(),
        trigger: 'Manual'
    };
    
    window.orchestratorData.unshift(newOrch);
    renderOrchestratorList();
    closeCreateOrchestratorModal();
    
    // Redirect to Editor
    editOrchestrator(newOrch.id);
}

// --- Edit Logic ---

window.editOrchestrator = function(id) {
    if (typeof window.switchView === 'function') {
        window.switchView('orchestrator-editor', { id: id });
    } else {
        console.error('switchView is not defined');
        alert('无法跳转到编辑器：switchView 未定义');
    }
}

// --- Delete Logic ---

let deletingOrchId = null;

window.deleteOrchestrator = function(id) {
    deletingOrchId = id;
    const orch = window.orchestratorData.find(o => o.id === id);
    if (!orch) return;
    
    document.getElementById('del-orch-name').textContent = orch.name;
    const modal = document.getElementById('delete-orch-modal');
    if (modal) modal.classList.remove('hidden');
}

window.closeDeleteOrchestratorModal = function() {
    const modal = document.getElementById('delete-orch-modal');
    if (modal) modal.classList.add('hidden');
    deletingOrchId = null;
}

window.confirmDeleteOrchestrator = function() {
    if (!deletingOrchId) return;
    
    window.orchestratorData = window.orchestratorData.filter(o => o.id !== deletingOrchId);
    renderOrchestratorList();
    closeDeleteOrchestratorModal();
    
    // Show Toast or Alert
    // alert('编排器已删除'); 
}

// Event Listener for View Load
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator') {
        window.initOrchestratorPage();
    }
});
