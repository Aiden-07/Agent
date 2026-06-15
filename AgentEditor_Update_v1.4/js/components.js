// Component Square Management Logic

// Global State
window.componentsData = [];
window.currentFilter = { type: 'all', search: '' };
let createCompConfig = { type: 'agent', method: 'new' };

// Provide a unified getter so other pages (e.g. orchestrator editor) can reuse component data
window.getComponentsData = function() {
    if (!Array.isArray(window.componentsData)) window.componentsData = [];
    if (window.componentsData.length === 0) {
        window.componentsData = generateMockComponents(8);
    }
    ensurePluginMockComponents(2);
    ensureSkillMockComponents(2);
    return window.componentsData;
}

const COMP_NAMES = [
    '客服接待标准模板', '代码审计流程模板', '销售话术库', 'RAG 知识检索模板', 
    '多轮对话编排模板', '自动回复机器人', '数据清洗流程', '日报生成助手'
];

// Initialize Page
window.initComponentsPage = function() {
    console.log('Initializing Components Page...');
    window.getComponentsData();
    applyComponentsListIntent();
    renderComponentsList();
    maybeOpenCreateComponentFromIntent();
}

function applyComponentsListIntent() {
    let type = null;
    try {
        type = sessionStorage.getItem('pendingComponentsFilterType');
        if (type) sessionStorage.removeItem('pendingComponentsFilterType');
    } catch (e) {
        // ignore
    }
    if (!type) return;

    const typeSelect = document.getElementById('comp-filter-type');
    if (typeSelect) typeSelect.value = type;
    window.currentFilter.type = type;
}

function maybeOpenCreateComponentFromIntent() {
    let type = null;
    try {
        type = sessionStorage.getItem('pendingCreateComponentType');
        if (type) sessionStorage.removeItem('pendingCreateComponentType');
    } catch (e) {
        // ignore
    }
    if (!type) return;

    // Open create modal and preselect type
    if (typeof window.openCreateComponentModal === 'function') {
        window.openCreateComponentModal();
    }
    if (typeof window.selectCompType === 'function') {
        window.selectCompType(type);
    }
}

function ensurePluginMockComponents(minCount = 2) {
    const existing = window.componentsData.filter(c => c.type === 'plugin').length;
    const need = Math.max(0, minCount - existing);
    if (need === 0) return;

    const base = [
        {
            id: 'PLG-001',
            name: '天气插件',
            type: 'plugin',
            refCount: 2,
            description: '提供实时天气查询能力，可作为工具/插件集成使用。',
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString(),
            version: 'v1.0.0',
            creator: 'Admin',
            status: 'active'
        },
        {
            id: 'PLG-002',
            name: '翻译插件',
            type: 'plugin',
            refCount: 0,
            description: '多语言互译插件，支持常见语种自动识别与翻译。',
            updatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toLocaleString(),
            version: 'v1.1.0',
            creator: 'Admin',
            status: 'active'
        }
    ];

    // 只补齐缺少的数量，避免重复插入
    const toAdd = base.filter(x => !window.componentsData.some(c => c.id === x.id)).slice(0, need);
    window.componentsData = [...toAdd, ...window.componentsData];
}

function ensureSkillMockComponents(minCount = 2) {
    const existing = window.componentsData.filter(c => c.type === 'skill').length;
    const need = Math.max(0, minCount - existing);
    if (need === 0) return;

    const base = [
        {
            id: 'SKL-001',
            name: '文档生成 Skill',
            type: 'skill',
            refCount: 1,
            description: '将输入内容整理为结构化文档（段落/标题/要点）。',
            updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toLocaleString(),
            version: 'v1.0.0',
            creator: 'Admin',
            status: 'active'
        },
        {
            id: 'SKL-002',
            name: 'PPT 生成 Skill',
            type: 'skill',
            refCount: 0,
            description: '根据大纲生成 PPT 结构与每页要点。',
            updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toLocaleString(),
            version: 'v1.0.0',
            creator: 'Admin',
            status: 'active'
        }
    ];

    const toAdd = base.filter(x => !window.componentsData.some(c => c.id === x.id)).slice(0, need);
    window.componentsData = [...toAdd, ...window.componentsData];
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
        
        const typeMeta = (() => {
            if (item.type === 'agent') {
                return { iconClass: 'text-purple-600 bg-purple-100', icon: 'fa-robot', text: '智能体模板' };
            }
            if (item.type === 'orchestrator') {
                return { iconClass: 'text-blue-600 bg-blue-100', icon: 'fa-layer-group', text: '工作流模板' };
            }
            if (item.type === 'skill') {
                return { iconClass: 'text-emerald-600 bg-emerald-100', icon: 'fa-wand-magic-sparkles', text: 'Skill' };
            }
            return { iconClass: 'text-green-600 bg-green-100', icon: 'fa-plug', text: '插件' };
        })();

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${typeMeta.iconClass} flex items-center justify-center">
                        <i class="fa-solid ${typeMeta.icon}"></i>
                    </div>
                    <div>
                        <div class="font-medium text-gray-900">${item.name}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${typeMeta.text}</td>
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
                <button onclick="window.openCompActions(event, '${item.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openCompActions = function(event, id) {
    const actions = [
        {
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => alert('编辑组件: ' + id)
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => window.deleteComponent(id)
        }
    ];
    window.showActionMenu(event, actions);
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
    createCompConfig = { type: 'agent' };
    resetCreateComponentWizard();
    
    // Reset radio button state
    const agentRadio = document.querySelector('input[name="comp-type"][value="agent"]');
    if (agentRadio) {
        agentRadio.click(); // Trigger click to set state and UI
    } else {
        updateResourceDropdown();
    }
}

window.closeCreateComponentModal = function() {
    const modal = document.getElementById('create-comp-modal');
    if (modal) modal.classList.add('hidden');
}

window.selectCompType = function(type) {
    createCompConfig.type = type;
    // Keep radio state in sync (inputs are hidden)
    const radio = document.querySelector(`input[name="comp-type"][value="${type}"]`);
    if (radio) radio.checked = true;

    updateCreateComponentModalVisibility();
    if (type !== 'plugin' && type !== 'skill') updateResourceDropdown();
}

window.createNewComponentTab = function() {
    // Open corresponding list page in new tab
    if (createCompConfig.type === 'plugin' || createCompConfig.type === 'skill') {
        alert('该类型不需要选择资源');
        return;
    }
    const url = createCompConfig.type === 'agent' ? 'index.html#/agent' : 'index.html#/orchestrator';
    window.open(url, '_blank');
}

function getExistingResources(type) {
    // Try to get data from global scope or generate mock
    if (type === 'agent') {
        if (window.agentData && window.agentData.length > 0) return window.agentData;
        // Mock Agents if no data
        return [
            { id: 'AGENT-001', name: '客服助手' },
            { id: 'AGENT-002', name: '代码审计' },
            { id: 'AGENT-003', name: '文案生成' }
        ];
    } else {
        if (window.orchestratorData && window.orchestratorData.length > 0) return window.orchestratorData;
        // Mock Orchestrators if no data
        return [
            { id: 'WF-001', name: '多轮对话流程' },
            { id: 'WF-002', name: '数据清洗流' }
        ];
    }
}

function updateResourceDropdown() {
    const select = document.getElementById('comp-create-method');
    if (!select) return;

    // Plugin does not need resources
    if (createCompConfig.type === 'plugin' || createCompConfig.type === 'skill') {
        select.innerHTML = '';
        return;
    }
    
    const resources = getExistingResources(createCompConfig.type);
    select.innerHTML = '';
    
    if (resources.length === 0) {
        const option = document.createElement('option');
        option.text = '无可用资源';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    resources.forEach(res => {
        const option = document.createElement('option');
        option.value = res.id;
        option.textContent = `${res.name} (${res.id})`;
        select.appendChild(option);
    });
}

window.submitCreateComponent = function() {
    // Plugin: go to step 2 (plugin info)
    if (createCompConfig.type === 'plugin') {
        showCreateCompStep('plugin');
        initPluginForm();
        return;
    }

    // Skill: no resource, keep it simple for demo
    if (createCompConfig.type === 'skill') {
        const compName = document.getElementById('comp-name')?.value?.trim();
        const compDesc = document.getElementById('comp-desc')?.value?.trim();
        if (!compName || !compDesc) {
            alert('请填写组件名称和描述');
            return;
        }
        window.closeCreateComponentModal();
        alert(`正在创建 Skill：${compName}（演示页面，保存逻辑待开发）`);
        return;
    }

    window.closeCreateComponentModal();
    
    const select = document.getElementById('comp-create-method');
    const selectedId = select ? select.value : null;
    
    if (!selectedId) {
        alert('请选择一个资源');
        return;
    }

    // Mock creation logic
    alert(`正在从资源 ${selectedId} 创建组件... (功能开发中)`);
}

function resetCreateComponentWizard() {
    showCreateCompStep('step1');
    updateCreateComponentModalVisibility();
}

function showCreateCompStep(step) {
    const title = document.getElementById('create-comp-title');
    const step1 = document.getElementById('create-comp-step-1');
    const stepPlugin = document.getElementById('create-comp-step-plugin');
    const actions1 = document.getElementById('create-comp-actions-step-1');
    const actionsPlugin = document.getElementById('create-comp-actions-step-plugin');

    const isPluginStep = step === 'plugin';
    if (step1) step1.classList.toggle('hidden', isPluginStep);
    if (stepPlugin) stepPlugin.classList.toggle('hidden', !isPluginStep);
    if (actions1) actions1.classList.toggle('hidden', isPluginStep);
    if (actionsPlugin) actionsPlugin.classList.toggle('hidden', !isPluginStep);
    if (title) title.textContent = isPluginStep ? '插件信息' : '创建新组件';
}

function updateCreateComponentModalVisibility() {
    const hideResource = createCompConfig.type === 'plugin' || createCompConfig.type === 'skill';
    const resourceSection = document.getElementById('comp-resource-section');
    const basicInfoSection = document.getElementById('comp-basic-info-section');

    if (resourceSection) resourceSection.classList.toggle('hidden', hideResource);
    // 插件类型仍需填写组件名称/描述，因此不隐藏基础信息区
    if (basicInfoSection) basicInfoSection.classList.remove('hidden');
}

window.backToCreateComponentStep1 = function() {
    showCreateCompStep('step1');
    updateCreateComponentModalVisibility();
}

function initPluginForm() {
    // Ensure at least one header row exists
    const headers = document.getElementById('plugin-headers');
    if (headers) {
        headers.innerHTML = '';
        addPluginHeaderRow();
    }
}

window.addPluginHeaderRow = function(key = '', value = '') {
    const headers = document.getElementById('plugin-headers');
    if (!headers) return;

    const row = document.createElement('div');
    row.className = 'grid grid-cols-[1fr,1fr,32px] gap-2 items-center';
    row.innerHTML = `
        <input type="text" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入参数名" value="${escapeHtml(key)}">
        <input type="text" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入Value" value="${escapeHtml(value)}">
        <button type="button" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500" title="删除" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    headers.appendChild(row);
}

window.submitPluginInfo = function() {
    const compName = document.getElementById('comp-name')?.value?.trim();
    const compDesc = document.getElementById('comp-desc')?.value?.trim();
    const url = document.getElementById('plugin-url')?.value?.trim();
    const authKey = document.getElementById('plugin-auth-key')?.value?.trim();
    const authValue = document.getElementById('plugin-auth-value')?.value?.trim();

    if (!compName || !compDesc || !url || !authKey || !authValue) {
        alert('请完善插件信息（带 * 的为必填项）');
        return;
    }

    window.closeCreateComponentModal();
    alert(`插件信息已填写：${compName}（演示页面，保存逻辑待开发）`);
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
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
