// Orchestrator Management Logic

window.orchestratorData = [];
const ORCH_NAMES = [
    '订单处理流程', '每日日报汇总', '客户投诉自动分类', '新员工入职指引', 
    '发票报销审批', '代码自动部署', '社交媒体监控', '竞品价格分析',
    '服务器健康检查', '数据备份流程'
];
const ORCH_TRIGGERS = ['API Webhook', 'Cron Schedule', 'Event Driven', 'Manual'];

// Agent Configuration
const AGENT_TYPES = [
    { type: 'functional', label: '功能型', icon: 'fa-robot', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { type: 'industry', label: '行业型', icon: 'fa-briefcase', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { type: 'role', label: '角色型', icon: 'fa-user-tie', color: 'bg-orange-50 text-orange-700 border-orange-200' }
];

// Renamed to avoid conflict with js/agent.js
const ORCH_AGENT_NAMES = {
    functional: ['数据分析Agent', '客户服务Bot', '文档解析助手', '代码审查员', '日志监控器'],
    industry: ['金融风控助手', '医疗咨询专家', '法律顾问Bot', '教育辅导员', '电商导购助手'],
    role: ['项目经理Agent', '技术支持Bot', '产品经理助理', 'HR招聘助手', '销售代表Bot']
};

// Initialize Page
window.initOrchestratorPage = function() {
    console.log('Initializing Orchestrator Page...');
    if (window.orchestratorData.length === 0) {
        window.orchestratorData = generateMockOrchestrators(10);
    }
    renderOrchestratorList();
    setupInputListeners();
}

function generateMockAgents() {
    const count = Math.floor(Math.random() * 4); // 0 to 3 agents
    if (count === 0) return [];
    
    const agents = [];
    for (let i = 0; i < count; i++) {
        const typeKey = Object.keys(ORCH_AGENT_NAMES)[Math.floor(Math.random() * 3)];
        const nameList = ORCH_AGENT_NAMES[typeKey];
        const name = nameList[Math.floor(Math.random() * nameList.length)];
        agents.push({
            id: `AG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            name: name,
            type: typeKey,
            avatar: `https://ui-avatars.com/api/?name=${name}&background=random`
        });
    }
    return agents;
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
            agents: generateMockAgents(), 
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
        
        // Status Toggle Logic
        const isActive = item.status === 'active';
        const toggleBg = isActive ? 'bg-blue-600' : 'bg-gray-200';
        const toggleDot = isActive ? 'translate-x-5' : 'translate-x-0';
        const statusLabel = isActive ? '已启用' : '已停用';

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
            <td class="px-6 py-4">
                ${renderAgentTags(item.agents)}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center cursor-pointer" onclick="window.toggleOrchestratorStatus('${item.id}', event)">
                    <div class="${toggleBg} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none">
                        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${toggleDot}"></span>
                    </div>
                    <span class="ml-2 text-xs text-gray-500 select-none min-w-[36px]">${statusLabel}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.nodeCount}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.creator}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.createdAt}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.updatedAt}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.openOrchActions(event, '${item.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openOrchActions = function(event, id) {
    window.showActionMenu(event, [
        {
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => editOrchestrator(id)
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => deleteOrchestrator(id)
        }
    ]);
}

function renderAgentTags(agents) {
    if (!agents || agents.length === 0) return '<span class="text-gray-400 text-xs">无关联智能体</span>';
    
    // Support legacy string format if any
    if (typeof agents === 'string') {
        return `<span class="text-gray-600 text-sm">${agents}</span>`;
    }

    const displayAgents = agents.slice(0, 3);
    const remainingCount = agents.length - 3;
    
    let html = '<div class="flex flex-wrap items-center gap-2">';
    
    displayAgents.forEach(agent => {
        const typeConfig = AGENT_TYPES.find(t => t.type === agent.type) || AGENT_TYPES[0];
        const agentJson = encodeURIComponent(JSON.stringify(agent));
        
        html += `
            <div class="group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer hover:shadow-sm transition-all ${typeConfig.color}"
                 onclick="window.showAgentCard(event, '${agentJson}')"
                 title="${agent.name} (${typeConfig.label})">
                <i class="fa-solid ${typeConfig.icon} opacity-70"></i>
                <span class="truncate max-w-[80px]">${agent.name}</span>
            </div>
        `;
    });
    
    if (remainingCount > 0) {
        const remainingNames = agents.slice(3).map(a => a.name).join('\n');
        html += `
            <div class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors"
                 title="${remainingNames}">
                +${remainingCount}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// --- Status Toggle Logic ---

window.toggleOrchestratorStatus = function(id, event) {
    if (event) event.stopPropagation();
    
    const item = window.orchestratorData.find(o => o.id === id);
    if (!item) return;
    
    // Toggle Status
    item.status = item.status === 'active' ? 'paused' : 'active';
    
    // Re-render
    renderOrchestratorList();
}

// --- Agent Popover Logic ---

window.showAgentCard = function(event, agentJson) {
    event.stopPropagation();
    const agent = JSON.parse(decodeURIComponent(agentJson));
    
    // Remove existing popovers
    window.closeAgentPopovers();
    
    const typeConfig = AGENT_TYPES.find(t => t.type === agent.type) || AGENT_TYPES[0];
    
    const popover = document.createElement('div');
    popover.className = 'agent-card-popover fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-100 p-4 w-64 animate-fade-in-up';
    popover.innerHTML = `
        <div class="flex items-start gap-3 mb-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg overflow-hidden border border-gray-200">
                <img src="${agent.avatar}" alt="${agent.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-robot text-gray-400\\'></i>'">
            </div>
            <div>
                <h4 class="font-bold text-gray-900 text-sm leading-tight">${agent.name}</h4>
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color} mt-1.5">
                    <i class="fa-solid ${typeConfig.icon}"></i> ${typeConfig.label}
                </span>
            </div>
        </div>
        <div class="space-y-2 text-xs text-gray-500">
            <div class="flex justify-between items-center border-b border-gray-50 pb-2">
                <span>ID</span>
                <span class="font-mono text-gray-700">${agent.id}</span>
            </div>
             <div class="flex justify-between items-center">
                <span>API 调用</span>
                <span class="font-medium text-gray-700">${(Math.random() * 5000 + 100).toFixed(0)} 次/周</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(popover);
    
    // Positioning
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverHeight = 150; // approximate
    let top = rect.bottom + 8;
    
    // Check if bottom overflow
    if (top + popoverHeight > window.innerHeight) {
        top = rect.top - popoverHeight - 8;
    }
    
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${top}px`;
    
    // Handle click outside
    requestAnimationFrame(() => {
        document.addEventListener('click', window.closeAgentPopovers);
    });
}

window.closeAgentPopovers = function() {
    const existing = document.querySelectorAll('.agent-card-popover');
    existing.forEach(el => el.remove());
    document.removeEventListener('click', window.closeAgentPopovers);
}

// ... existing Create/Edit/Delete Logic (which was included in previous Write) ...
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
        agents: [], // New items have no agents initially
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

window.editOrchestrator = function(id) {
    if (typeof window.switchView === 'function') {
        window.switchView('orchestrator-editor', { id: id });
    } else {
        console.error('switchView is not defined');
        alert('无法跳转到编辑器：switchView 未定义');
    }
}

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
}

document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator') {
        window.initOrchestratorPage();
    }
});
