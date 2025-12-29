// Section Toggle Logic
function toggleSection(sectionId, headerElement) {
    const content = document.getElementById(sectionId);
    if (!content) return;
    
    const icon = headerElement.querySelector('.fa-chevron-down') || headerElement.querySelector('.fa-chevron-right');
    const isHidden = content.classList.contains('hidden');
    
    if (isHidden) {
        content.classList.remove('hidden');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    } else {
        content.classList.add('hidden');
        if (icon) {
            icon.style.transform = 'rotate(-90deg)';
        }
    }
}

// Global Export
window.toggleSection = toggleSection;

// Variable Insertion Logic
function insertVariable(variable, targetId = 'agent-prompt') {
    const textarea = document.getElementById(targetId);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + variable + text.substring(end);
    
    // Restore focus and cursor position
    const newPos = start + variable.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
    
    // Trigger input event for auto-saving if implemented
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Trigger change event for onchange listeners
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
}
window.insertVariable = insertVariable;

// Agent Management Logic

// Mock Data
let agentsData = [];
const MODELS = ['GPT-4o', 'Claude 3.5 Sonnet', 'GPT-4 Turbo', 'DeepSeek V2'];
const KBS = ['产品文档库', '技术规范', '员工手册', '市场分析报告'];
const CREATORS = ['Admin', 'User_1001', 'User_1002', 'User_1003'];

// Realistic Agent Names
const AGENT_NAMES = [
    '电商客服助手', 'Python 代码审查员', '英文翻译专家', 'SQL 查询生成器', 
    '周报自动生成助手', '产品文案润色', '旅游行程规划师', '法律咨询顾问', 
    '前端组件生成器', '招聘简历筛选助手', '数据分析报告生成', 'API 文档自动生成',
    '用户评论情感分析', '智能会议纪要', '个性化推荐引擎'
];

// Mock MCP and Plugin Data
let mcpData = [
    { id: 'MCP-001', name: 'Google Search' },
    { id: 'MCP-002', name: 'GitHub Integration' },
    { id: 'MCP-003', name: 'Slack Notifier' },
    { id: 'MCP-004', name: 'Linear Issue Tracker' },
    { id: 'MCP-005', name: 'Postgres Database' }
];

let pluginData = [
    { id: 'PLG-001', name: 'Code Interpreter' },
    { id: 'PLG-002', name: 'Image Generator' },
    { id: 'PLG-003', name: 'PDF Reader' },
    { id: 'PLG-004', name: 'Wolfram Alpha' },
    { id: 'PLG-005', name: 'Web Browser' }
];

let currentPage = 1;
const pageSize = 10;
let isLoading = false;
let hasMore = true;
let currentSearch = '';
let currentFilter = 'all';

// Generate initial mock data
function generateMockAgents(count) {
    const newAgents = [];
    for (let i = 0; i < count; i++) {
        const id = window.generateId ? window.generateId('AGT') : `AGT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        // Pick a name from the list cyclically or randomly
        let name;
        if (i < AGENT_NAMES.length) {
             name = AGENT_NAMES[i % AGENT_NAMES.length];
        } else {
             name = `${AGENT_NAMES[i % AGENT_NAMES.length]} ${Math.floor(i / AGENT_NAMES.length) + 1}`;
        }

        const createdAtDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
        
        newAgents.push({
            id: id,
            name: name,
            model: MODELS[Math.floor(Math.random() * MODELS.length)],
            // Generate random multiple knowledge bases (1-3)
            knowledgeBase: (() => {
                const shuffled = [...KBS].sort(() => 0.5 - Math.random());
                const count = Math.floor(Math.random() * 3) + 1; // 1 to 3
                return shuffled.slice(0, count);
            })(),
            creator: CREATORS[Math.floor(Math.random() * CREATORS.length)],
            createdAt: createdAtDate.toLocaleString(),
            timestamp: createdAtDate.getTime(), // Added for sorting
            updatedAt: new Date(createdAtDate.getTime() + Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)).toLocaleString(),
            hot: Math.floor(Math.random() * 10000),
            status: Math.random() > 0.2 ? 'running' : 'stopped' // 80% running
        });
    }
    return newAgents;
}

// Initialize
function initAgentPage() {
    console.log('Initializing Agent Page...');
    
    // Reset state if needed, or keep it to persist during session
    // For now, let's check if we already have data, if not generate some
    if (agentsData.length === 0) {
        agentsData = generateMockAgents(10); // Changed from 25 to 10
    }
    
    // Reset view state
    currentPage = 1;
    hasMore = true;
    isLoading = false;
    currentSearch = ''; // Optional: Reset filters on re-entry
    currentFilter = 'all';

    // Render initial list
    renderAgentList(true);
    updateStats();
    
    // Bind Events
    const scrollContainer = document.getElementById('agent-list-container');
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll);
    }

    const searchInput = document.getElementById('agent-search-input');
    if (searchInput) {
        searchInput.value = ''; // Clear input visually
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            currentPage = 1;
            hasMore = true;
            renderAgentList(true);
        });
    }

    const statusFilter = document.getElementById('agent-status-filter');
    if (statusFilter) {
        statusFilter.value = 'all'; // Reset select visually
        statusFilter.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            currentPage = 1;
            hasMore = true;
            renderAgentList(true);
        });
    }
}

function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Check if scrolled near bottom
    if (scrollHeight - scrollTop <= clientHeight + 50) {
        if (!isLoading && hasMore) {
            loadMoreAgents();
        }
    }
}

function loadMoreAgents() {
    isLoading = true;
    const loader = document.getElementById('agent-list-loader');
    if (loader) loader.classList.remove('hidden');

    // Simulate network delay
    setTimeout(() => {
        currentPage++;
        
        // Let's generate 5 more "new" items to simulate infinite DB if we run out of mock data?
        // Or just pretend existing data is paginated.
        // For true infinite scroll feel in prototype, let's generate more data if we reach the end of static list.
        // But logic is simpler if we just filter existing data. 
        // Let's create more data on the fly to append to `agentsData` so the list grows.
        
        const newItems = generateMockAgents(5); 
        agentsData = [...agentsData, ...newItems]; // Append to master list
        
        renderAgentList(false); // Append/Re-render
        
        isLoading = false;
        if (loader) loader.classList.add('hidden');
    }, 800);
}

function getFilteredAgents() {
    let filtered = agentsData.filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(currentSearch) || 
                              agent.id.toString().includes(currentSearch);
        const matchesStatus = currentFilter === 'all' || agent.status === currentFilter;
        return matchesSearch && matchesStatus;
    });
    // Sort by timestamp desc (newest first)
    return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function renderAgentList(reset = false) {
    const tbody = document.getElementById('agent-list-body');
    const emptyState = document.getElementById('agent-list-empty');
    if (!tbody) return;

    const allFiltered = getFilteredAgents();
    const visibleCount = currentPage * pageSize;
    const visibleAgents = allFiltered.slice(0, visibleCount);
    
    // If we have fewer items than we want to show (and no search active), maybe trigger loadMore?
    // But simplified logic: just show what we have in `visibleAgents`.

    if (reset) {
        tbody.innerHTML = '';
    } else {
        // Optimization: could just append new ones, but re-render is safer for sort/filter consistency
        tbody.innerHTML = ''; 
    }

    if (visibleAgents.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        
        visibleAgents.forEach((agent, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            
            // Calculate global index (optional, but requested "序号")
            // Since visibleAgents starts from 0 for current view, and we might have pagination logic...
            // If simple infinite scroll, index + 1 is fine if we render all. 
            // If paginated by slice, it's relative. 
            // Current logic slices: visibleAgents = allFiltered.slice(0, visibleCount);
            // So visibleAgents contains elements from 0 to visibleCount.
            // The index in forEach is the correct global index (within filtered set).
            
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            AI
                        </div>
                        <div class="font-medium text-gray-900">${agent.name}</div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <button onclick="toggleAgentStatus('${agent.id}')" class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${agent.status === 'running' ? 'bg-green-500' : 'bg-gray-200'}">
                        <span class="sr-only">Use setting</span>
                        <span aria-hidden="true" class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${agent.status === 'running' ? 'translate-x-4' : 'translate-x-0'}"></span>
                    </button>
                    <span class="ml-2 text-xs ${agent.status === 'running' ? 'text-green-600' : 'text-gray-500'}">
                        ${agent.status === 'running' ? '运行中' : '已停止'}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        ${agent.model || '未设置'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                     ${Array.isArray(agent.knowledgeBase) && agent.knowledgeBase.length > 0 ? agent.knowledgeBase.map(kb => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mr-1">${kb}</span>`).join('') : '-'}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                     <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        ${agent.creator || 'Admin'}
                    </div>
                </td>
                <td class="px-6 py-4 text-xs text-gray-500">
                    ${agent.createdAt || '-'}
                </td>
                <td class="px-6 py-4 text-xs text-gray-500">
                    ${agent.updatedAt || '-'}
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.openAgentActions(event, '${agent.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Action Menu Handler
window.openAgentActions = function(event, id) {
    window.showActionMenu(event, [
        {
            label: '配置权限',
            icon: 'fa-solid fa-user-shield',
            onClick: () => openPermissionModal(id)
        },
        {
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => editAgent(id)
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => openDeleteConfirm(id)
        }
    ]);
}

// Edit Agent (Ensure it's exposed)
window.editAgent = function(id) {
    if (typeof switchView === 'function') {
        switchView('agent-editor', { id: id });
    }
}

// Create Agent
function createNewAgent() {
    const nameInput = document.getElementById('new-agent-name');
    const modelInput = document.getElementById('new-agent-model');
    const descInput = document.getElementById('new-agent-desc');

    if (!nameInput.value.trim()) {
        alert('请输入智能体名称');
        return;
    }

    const newAgent = {
        id: window.generateId ? window.generateId('AGT') : `AGT-${Date.now()}`,
        name: nameInput.value,
        model: modelInput.value,
        description: descInput.value,
        prompt: descInput.value, // Use description as initial prompt
        hot: 0,
        status: 'running',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        updatedAt: new Date().toLocaleString()
    };

    agentsData.unshift(newAgent); // Add to top
    closeModal('create-agent-modal');
    
    // Clear inputs
    nameInput.value = '';
    descInput.value = '';
    
    // Instead of rendering list, switch to editor
    // currentPage = 1;
    // renderAgentList(true);
    // updateStats();
    
    // Go to editor
    switchView('agent-editor', { id: newAgent.id });
}

// Delete Agent
let agentToDeleteId = null;
let agentToStopId = null; // State for stop confirmation

function openDeleteConfirm(id) {
    agentToDeleteId = id;
    const agent = agentsData.find(a => a.id === id);
    if (agent) {
        document.getElementById('delete-agent-name').textContent = agent.name;
        openModal('delete-confirm-modal');
    }
}

function confirmDelete() {
    if (agentToDeleteId) {
        agentsData = agentsData.filter(a => a.id !== agentToDeleteId);
        closeModal('delete-confirm-modal');
        renderAgentList(true);
        updateStats();
        agentToDeleteId = null;
    }
}

// Bind confirm delete button (Global listener in case element is recreated, though modal is static in views/agent.html? No, modal is part of view, so it is re-injected)
// Since modal is part of the view, we need to bind the click event AFTER view load or use inline onclick.
// The HTML uses onclick="createNewAgent()" and onclick="confirmDelete()" but wait, confirmDelete is button id="confirm-delete-btn".
// In `views/agent.html`: <button id="confirm-delete-btn" ...>删除</button>
// So we need to bind it in initAgentPage or use onclick in HTML.
// Let's add onclick to the button in HTML to be safe and consistent with createNewAgent.

// Toggle Status
function toggleAgentStatus(id) {
    const agent = agentsData.find(a => a.id === id);
    if (agent) {
        if (agent.status === 'running') {
            // If running, ask for confirmation to stop
            agentToStopId = id;
            if (typeof openModal === 'function') {
                openModal('stop-confirm-modal');
            } else {
                // Fallback if openModal is not globally available (it should be in utils.js)
                const modal = document.getElementById('stop-confirm-modal');
                if (modal) modal.classList.remove('hidden');
            }
        } else {
            // If stopped, start immediately
            agent.status = 'running';
            renderAgentList(false);
        }
    }
}

function confirmStopAgent() {
    if (agentToStopId) {
        const agent = agentsData.find(a => a.id === agentToStopId);
        if (agent) {
            agent.status = 'stopped';
            renderAgentList(false);
        }
        
        if (typeof closeModal === 'function') {
            closeModal('stop-confirm-modal');
        } else {
             const modal = document.getElementById('stop-confirm-modal');
             if (modal) modal.classList.add('hidden');
        }
        agentToStopId = null;
    }
}

// Update Stats
function updateStats() {
    const countEl = document.getElementById('total-agents-count');
    if (countEl) countEl.textContent = agentsData.length;
}

// Listen for custom view loaded event
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'agent') {
        initAgentPage();
        
        // Bind Confirm Delete Button dynamically since it's re-rendered
        const deleteBtn = document.getElementById('confirm-delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = confirmDelete;
        }
    }
});

// Edit Agent
function editAgent(id) {
    switchView('agent-editor', { id: id });
}

// Helper to get agent by ID (exposed globally for editor)
window.getAgentById = function(id) {
    return agentsData.find(a => a.id === id);
};

// Expose functions
window.initAgentPage = initAgentPage;
window.createNewAgent = createNewAgent;
window.openDeleteConfirm = openDeleteConfirm;
window.toggleAgentStatus = toggleAgentStatus;
window.confirmStopAgent = confirmStopAgent;
window.editAgent = editAgent;

// --- Agent Editor Logic ---

let currentEditorAgentId = null;

// --- Resource Management Logic ---
let editorResources = {
    knowledge: [],
    agent: [],
    orchestrator: [],
    mcp: [],
    plugin: []
};

function loadResources() {
    // Check and load Knowledge Data
    if (typeof knowledgeData !== 'undefined' && knowledgeData.length === 0) {
        if (typeof generateMockKnowledge === 'function') {
            knowledgeData = generateMockKnowledge(10);
        }
    }
    
    // Check and load Orchestrator Data
    if (typeof orchestratorData !== 'undefined' && orchestratorData.length === 0) {
        if (typeof generateMockOrchestrators === 'function') {
            orchestratorData = generateMockOrchestrators(10);
        }
    }

    // Populate Selects
    // Knowledge
    if (typeof knowledgeData !== 'undefined') {
        populateSelect('select-knowledge', knowledgeData);
    }
    
    // Agents (exclude current)
    if (typeof agentsData !== 'undefined') {
        const availableAgents = agentsData.filter(a => a.id !== currentEditorAgentId);
        populateSelect('select-agent', availableAgents);
    }
    
    // Orchestrator
    if (typeof orchestratorData !== 'undefined') {
        populateSelect('select-orchestrator', orchestratorData);
    }

    // MCP
    if (typeof mcpData !== 'undefined') {
        populateSelect('select-mcp', mcpData);
    }

    // Plugins
    if (typeof pluginData !== 'undefined') {
        populateSelect('select-plugin', pluginData);
    }
}

function populateSelect(id, data) {
    const select = document.getElementById(id);
    if (!select) return;
    
    // Reset options but keep the first one
    select.innerHTML = select.options[0].outerHTML;
    
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

function addResource(type) {
    const select = document.getElementById(`select-${type}`);
    if (!select) return;
    
    const id = select.value;
    if (!id) return;
    
    if (!editorResources[type].includes(id)) {
        editorResources[type].push(id);
        renderResourceList(type);
    }
    
    // Reset select
    select.value = '';
}

function removeResource(type, id) {
    editorResources[type] = editorResources[type].filter(item => item !== id);
    renderResourceList(type);
}

function renderResourceList(type) {
    const container = document.getElementById(`list-${type}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    editorResources[type].forEach(id => {
        let name = id;
        let data = [];
        
        if (type === 'knowledge' && typeof knowledgeData !== 'undefined') data = knowledgeData;
        else if (type === 'agent') data = agentsData;
        else if (type === 'orchestrator' && typeof orchestratorData !== 'undefined') data = orchestratorData;
        else if (type === 'mcp' && typeof mcpData !== 'undefined') data = mcpData;
        else if (type === 'plugin' && typeof pluginData !== 'undefined') data = pluginData;
        
        const item = data.find(x => x.id === id);
        if (item) name = item.name;
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-white rounded-md border border-gray-200 text-xs shadow-sm group hover:border-blue-300 transition-all';
        div.innerHTML = `
            <span class="text-gray-700 truncate mr-2 flex-1 flex items-center gap-2">
                <i class="fa-solid fa-link text-gray-300 text-[10px]"></i>
                ${name}
            </span>
            <button onclick="removeResource('${type}', '${id}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

function saveAgentConfig(silent = false) {
    // Collect Data
    const nameInput = document.getElementById('agent-name');
    const modelInput = document.getElementById('agent-model');
    const promptInput = document.getElementById('agent-prompt');
    const contextMemoryInput = document.getElementById('agent-context-memory');
    
    const config = {
        name: nameInput ? nameInput.value : '',
        model: modelInput ? modelInput.value : '',
        prompt: promptInput ? promptInput.value : '',
        contextMemory: contextMemoryInput ? parseInt(contextMemoryInput.value) : 10,
        knowledge: [...editorResources.knowledge],
        relatedAgents: [...editorResources.agent],
        orchestrators: [...editorResources.orchestrator]
    };

    if (currentEditorAgentId) {
        // Update existing agent
        const agent = agentsData.find(a => a.id === currentEditorAgentId);
        if (agent) {
            agent.name = config.name;
            agent.model = config.model;
            agent.prompt = config.prompt;
            agent.contextMemory = config.contextMemory;
            agent.knowledge = config.knowledge;
            agent.relatedAgents = config.relatedAgents;
            agent.orchestrators = config.orchestrators;
            agent.updatedAt = new Date().toLocaleString();
            agent.timestamp = Date.now();
            
            // Save experience config
            agent.experience = JSON.parse(JSON.stringify(experienceConfig));
        }
    } else {
        // Create new (if not already created via modal? Logic is user creates via modal then edits)
        // But if we are here, we might be editing a draft?
        // For now assume agent exists.
    }

    if (!silent) {
        showToast('配置已保存');
    }
}

// Init Agent Editor
function initAgentEditor(params) {
    console.log('Initializing Agent Editor', params);
    
    currentEditorAgentId = params && params.id ? params.id : null;
    
    // Reset Resources
    editorResources = {
        knowledge: [],
        agent: [],
        orchestrator: [],
        mcp: [],
        plugin: []
    };
    
    // Load Data if editing
    if (currentEditorAgentId) {
        const agent = agentsData.find(a => a.id == currentEditorAgentId);
        if (agent) {
            const nameInput = document.getElementById('agent-name');
            const modelInput = document.getElementById('agent-model');
            const promptInput = document.getElementById('agent-prompt');
            const contextMemoryInput = document.getElementById('agent-context-memory');
            const editorTitle = document.getElementById('editor-title');
            
            if (nameInput) nameInput.value = agent.name;
            if (modelInput) modelInput.value = agent.model;
            if (promptInput) promptInput.value = agent.prompt || agent.description || '';
            if (contextMemoryInput) contextMemoryInput.value = agent.contextMemory !== undefined ? agent.contextMemory : 10;
            if (editorTitle) editorTitle.textContent = `编辑智能体: ${agent.name}`;
            
            // Populate Resources
            if (agent.knowledge) editorResources.knowledge = [...agent.knowledge];
            if (agent.relatedAgents) editorResources.agent = [...agent.relatedAgents];
            if (agent.orchestrators) editorResources.orchestrator = [...agent.orchestrators];
            
            // Init Experience Config
            initExperienceConfig(agent);

            // Update Header Info
            const nameDisplay = document.getElementById('agent-name-display');
            const descDisplay = document.getElementById('agent-desc-display');
            const headerAvatar = document.getElementById('editor-agent-avatar');

            if (nameDisplay) nameDisplay.textContent = agent.name;
            if (descDisplay) descDisplay.textContent = agent.description || '暂无描述';
            if (headerAvatar) {
                if (agent.avatar) {
                     headerAvatar.innerHTML = `<img src="${agent.avatar}" class="w-full h-full object-cover rounded-xl">`;
                } else {
                     headerAvatar.innerHTML = '<i class="fa-solid fa-robot"></i>';
                }
            }
        }
    } else {
        // New Agent
        // Reset inputs
        const inputs = ['agent-name', 'agent-model', 'agent-prompt'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        
        // Reset Header
        const nameDisplay = document.getElementById('agent-name-display');
        const descDisplay = document.getElementById('agent-desc-display');
        const headerAvatar = document.getElementById('editor-agent-avatar');
        if (nameDisplay) nameDisplay.textContent = '新智能体';
        if (descDisplay) descDisplay.textContent = '请配置智能体信息';
        if (headerAvatar) headerAvatar.innerHTML = '<i class="fa-solid fa-robot"></i>';
        
        initExperienceConfig(null);
    }
    
    loadResources();
    renderResourceList('knowledge');
    renderResourceList('agent');
    renderResourceList('orchestrator');
    renderResourceList('mcp');
    renderResourceList('plugin');
    
    // Init Tabs
    // Default to 'config' tab
    if (typeof switchEditorTab === 'function') {
        switchEditorTab('config');
    }
    
    // Init Section States (Expand/Collapse)
    // Removed redundant initSectionStates call to fix SyntaxError
}

function switchEditorTab(tabName) {
    const tabs = ['config', 'publish', 'logs', 'analytics'];
    
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        
        if (t === tabName) {
            if (btn) {
                btn.className = 'py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 transition-colors';
            }
            if (content) {
                content.classList.remove('hidden');
                // Special handling for logs tab
                if (t === 'logs' && window.renderLogList) {
                    window.renderLogList();
                }
            }
        } else {
            if (btn) {
                btn.className = 'py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-200 transition-colors';
            }
            if (content) {
                content.classList.add('hidden');
            }
        }
    });
}

// Expose Editor Functions
window.initAgentEditor = initAgentEditor;
window.switchEditorTab = switchEditorTab;
window.addResource = addResource;
window.removeResource = removeResource;
window.saveAgentConfig = saveAgentConfig;


// --- System Logs Logic (Mock) ---

let logsData = [];
let currentLogSearch = '';
let currentLogFilter = 'all';

function generateMockLogs(count) {
    const logs = [];
    const users = ['User_A', 'User_B', 'User_C', 'Admin'];
    const topics = ['如何重置密码', '查询订单状态', '产品使用咨询', '系统报错反馈'];
    const statuses = ['active', 'closed'];
    
    for (let i = 0; i < count; i++) {
        const date = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        const status = statuses[Math.random() > 0.3 ? 1 : 0]; // 70% closed
        const msgCount = Math.floor(Math.random() * 20) + 2;
        
        logs.push({
            id: `sess_${Math.floor(Math.random() * 100000000)}`,
            user: users[Math.floor(Math.random() * users.length)],
            agentName: '我的智能体', // Should match current agent name but hardcoded for now or use context
            status: status,
            topic: topics[Math.floor(Math.random() * topics.length)],
            messageCount: msgCount,
            createdAt: date.toLocaleString(),
            updatedAt: new Date(date.getTime() + Math.floor(Math.random() * 3600000)).toLocaleString(),
            content: generateMockChatContent(msgCount)
        });
    }
    return logs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function generateMockChatContent(count) {
    const content = [];
    const interactions = [
        { role: 'user', text: '你好' },
        { role: 'ai', text: '你好！有什么我可以帮你的吗？' },
        { role: 'user', text: '帮我写个代码' },
        { role: 'ai', text: '好的，请告诉我你需要什么语言的代码？' },
        { role: 'user', text: 'Python' },
        { role: 'ai', text: '这是一个 Python 示例...' }
    ];
    
    for (let i = 0; i < count; i++) {
        content.push(interactions[i % interactions.length]);
    }
    return content;
}

function renderLogList(reset = false) {
    if (reset || logsData.length === 0) {
        logsData = generateMockLogs(15);
        
        // Bind search/filter events if not already bound
        const searchInput = document.getElementById('log-search');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.addEventListener('input', (e) => {
                currentLogSearch = e.target.value.toLowerCase();
                renderLogList(false);
            });
            searchInput.dataset.bound = true;
        }
        
        const filterSelect = document.getElementById('log-filter-status');
        if (filterSelect && !filterSelect.dataset.bound) {
            filterSelect.addEventListener('change', (e) => {
                currentLogFilter = e.target.value;
                renderLogList(false);
            });
            filterSelect.dataset.bound = true;
        }
    }

    const tbody = document.getElementById('logs-list-body');
    const emptyState = document.getElementById('logs-list-empty');
    if (!tbody) return;

    // Filter
    const filtered = logsData.filter(log => {
        const matchesSearch = log.id.toLowerCase().includes(currentLogSearch) || 
                              log.user.toLowerCase().includes(currentLogSearch) ||
                              log.topic.toLowerCase().includes(currentLogSearch);
        const matchesStatus = currentLogFilter === 'all' || log.status === currentLogFilter;
        return matchesSearch && matchesStatus;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        
        filtered.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            tr.onclick = (e) => {
                // Prevent click if clicking specific buttons if any
                if (e.target.closest('button')) return;
                openLogDetailModal(log.id);
            };
            
            const statusClass = log.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
            const statusText = log.status === 'active' ? '进行中' : '已结束';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 font-mono">
                    ${log.id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        ${log.user}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.agentName}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title="${log.topic}">
                    ${log.topic}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.messageCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.createdAt}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.updatedAt}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="openLogDetailModal('${log.id}')" class="text-blue-600 hover:text-blue-900">查看</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function openLogDetailModal(logId) {
    const log = logsData.find(l => l.id === logId);
    if (!log) return;

    document.getElementById('log-detail-title').textContent = `会话详情: ${log.topic}`;
    document.getElementById('log-detail-meta').textContent = `ID: ${log.id} • 用户: ${log.user} • 时间: ${log.createdAt}`;
    
    const contentContainer = document.getElementById('log-detail-content');
    contentContainer.innerHTML = '';

    log.content.forEach(msg => {
        const isUser = msg.role === 'user';
        const div = document.createElement('div');
        div.className = isUser ? 'flex gap-3 flex-row-reverse mb-4' : 'flex gap-3 mb-4';
        
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center text-xs flex-shrink-0">
                <i class="fa-solid fa-${isUser ? 'user' : 'robot'}"></i>
            </div>
            <div class="${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'} rounded-2xl px-4 py-2.5 text-sm max-w-[80%] shadow-sm">
                ${msg.text}
            </div>
        `;
        contentContainer.appendChild(div);
    });

    openModal('log-detail-modal');
}

// Expose functions
window.renderLogList = renderLogList;
window.openLogDetailModal = openLogDetailModal;

// --- Edit Agent Info (Name & Desc & Avatar) ---

let currentAvatarDataUrl = null;
let cropperInstance = null;

function openEditAgentInfoModal() {
    // Allow opening even if new agent (currentEditorAgentId is null)
    
    let agentName = '';
    let agentDesc = '';
    
    if (currentEditorAgentId) {
        const agent = agentsData.find(a => a.id == currentEditorAgentId);
        if (agent) {
            agentName = agent.name || '';
            agentDesc = agent.description || '';
            currentAvatarDataUrl = agent.avatar || null;
        }
    } else {
        // New Agent Mode - Try to get from main input if user typed something
        const mainNameInput = document.getElementById('agent-name');
        if (mainNameInput) agentName = mainNameInput.value;
        // currentAvatarDataUrl should be preserved from previous crop in this session if any
    }

    const nameInput = document.getElementById('edit-agent-name');
    const descInput = document.getElementById('edit-agent-desc');
    const avatarPreview = document.getElementById('edit-agent-avatar-preview');
    
    if (nameInput) nameInput.value = agentName;
    if (descInput) descInput.value = agentDesc;
    
    updateAvatarPreview(avatarPreview, currentAvatarDataUrl);
    
    openModal('edit-agent-info-modal');
}

function updateAvatarPreview(element, url) {
    if (!element) return;
    if (url) {
        element.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
    } else {
        element.innerHTML = '<i class="fa-solid fa-robot"></i>';
    }
}

function handleAvatarSelect(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Validation
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showToast('仅支持 JPG 或 PNG 格式图片', 'error');
        input.value = '';
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过 2MB', 'error');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        openCropModal(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Clear input so same file can be selected again if cancelled
    input.value = '';
}

// --- Experience Config Logic ---
let experienceConfig = {};

function initExperienceConfig(agent) {
    // Default Config
    experienceConfig = {
        welcomeMsg: '',
        welcomeQuestions: { enabled: false, list: [] },
        responseQuestions: { enabled: false, list: [] },
        feedback: { enabled: false, mandatory: false, custom: false, options: ['内容不准确', '答非所问', '逻辑混乱'] },
        translation: { enabled: false, targetLang: 'en' }
    };

    if (agent && agent.experience) {
        // Safe Merge
        if (agent.experience.welcomeMsg !== undefined) experienceConfig.welcomeMsg = agent.experience.welcomeMsg;
        
        if (agent.experience.welcomeQuestions) {
            if (agent.experience.welcomeQuestions.enabled !== undefined) 
                experienceConfig.welcomeQuestions.enabled = agent.experience.welcomeQuestions.enabled;
            if (Array.isArray(agent.experience.welcomeQuestions.list))
                experienceConfig.welcomeQuestions.list = [...agent.experience.welcomeQuestions.list];
        }
        
        if (agent.experience.responseQuestions) {
            if (agent.experience.responseQuestions.enabled !== undefined) 
                experienceConfig.responseQuestions.enabled = agent.experience.responseQuestions.enabled;
            if (Array.isArray(agent.experience.responseQuestions.list))
                experienceConfig.responseQuestions.list = [...agent.experience.responseQuestions.list];
        }

        if (agent.experience.feedback) {
            if (agent.experience.feedback.enabled !== undefined) experienceConfig.feedback.enabled = agent.experience.feedback.enabled;
            if (agent.experience.feedback.mandatory !== undefined) experienceConfig.feedback.mandatory = agent.experience.feedback.mandatory;
            if (agent.experience.feedback.custom !== undefined) experienceConfig.feedback.custom = agent.experience.feedback.custom;
            if (Array.isArray(agent.experience.feedback.options)) experienceConfig.feedback.options = [...agent.experience.feedback.options];
        }

        if (agent.experience.translation) {
            if (agent.experience.translation.enabled !== undefined) experienceConfig.translation.enabled = agent.experience.translation.enabled;
            if (agent.experience.translation.targetLang !== undefined) experienceConfig.translation.targetLang = agent.experience.translation.targetLang;
        }
    }

    // Render UI
    const welcomeMsgInput = document.getElementById('welcome-msg-input');
    const welcomeCheck = document.getElementById('welcome-questions-check');
    const responseCheck = document.getElementById('response-questions-check');
    const feedbackCheck = document.getElementById('feedback-check');
    const feedbackMandatory = document.getElementById('feedback-mandatory-check');
    const feedbackCustom = document.getElementById('feedback-custom-check');
    const translationCheck = document.getElementById('translation-check');
    const translationLang = document.getElementById('translation-lang-select');
    
    if (welcomeMsgInput) welcomeMsgInput.value = experienceConfig.welcomeMsg || '';
    if (welcomeCheck) welcomeCheck.checked = experienceConfig.welcomeQuestions?.enabled || false;
    if (responseCheck) responseCheck.checked = experienceConfig.responseQuestions?.enabled || false;
    if (feedbackCheck) feedbackCheck.checked = experienceConfig.feedback?.enabled || false;
    if (feedbackMandatory) feedbackMandatory.checked = experienceConfig.feedback?.mandatory || false;
    if (feedbackCustom) feedbackCustom.checked = experienceConfig.feedback?.custom || false;

    if (translationCheck) translationCheck.checked = experienceConfig.translation?.enabled || false;
    if (translationLang) translationLang.value = experienceConfig.translation?.targetLang || 'en';
    
    // Trigger toggles to show/hide sections
    toggleExperienceFeature('welcome', false); // false = no save
    toggleExperienceFeature('response', false);
    toggleExperienceFeature('feedback', false);
    toggleExperienceFeature('translation', false);

    renderQuestionsList('welcome');
    renderQuestionsList('response');
    renderFeedbackOptions();
}

function toggleExperienceFeature(type, save = true) {
    if (type === 'feedback') {
        const check = document.getElementById('feedback-check');
        const section = document.getElementById('feedback-settings-section');
        if (check && section) {
            const enabled = check.checked;
            if (enabled) section.classList.remove('hidden');
            else section.classList.add('hidden');
            experienceConfig.feedback.enabled = enabled;
        }
    } else if (type === 'feedback-mandatory') {
        const check = document.getElementById('feedback-mandatory-check');
        if (check) experienceConfig.feedback.mandatory = check.checked;
    } else if (type === 'feedback-custom') {
        const check = document.getElementById('feedback-custom-check');
        if (check) experienceConfig.feedback.custom = check.checked;
    } else if (type === 'translation') {
        const check = document.getElementById('translation-check');
        const section = document.getElementById('translation-settings-section');
        
        if (check && section) {
            const enabled = check.checked;
            if (enabled) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
            experienceConfig.translation.enabled = enabled;
        }
    } else {
        const check = document.getElementById(`${type}-questions-check`);
        const section = document.getElementById(`${type}-questions-section`);
        
        if (check && section) {
            const enabled = check.checked;
            if (enabled) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
            
            if (type === 'welcome') {
                experienceConfig.welcomeQuestions.enabled = enabled;
            } else {
                experienceConfig.responseQuestions.enabled = enabled;
            }
        }
    }
        
    if (save) saveAgentConfig(true);
}

function addQuestion(type) {
    const list = type === 'welcome' ? experienceConfig.welcomeQuestions.list : experienceConfig.responseQuestions.list;
    
    // Limit check (Welcome: 8, Response: 5)
    const limit = type === 'welcome' ? 8 : 5;
    if (list.length >= limit) {
        showToast(`最多只能添加 ${limit} 个推荐问题`, 'warning');
        return;
    }

    // Add default question
    list.push(`示例问题 ${list.length + 1}`);
    renderQuestionsList(type);
    saveAgentConfig(true);
}

function removeQuestion(type, index) {
    const list = type === 'welcome' ? experienceConfig.welcomeQuestions.list : experienceConfig.responseQuestions.list;
    list.splice(index, 1);
    renderQuestionsList(type);
    saveAgentConfig(true);
}

function updateQuestion(type, index, value) {
    const list = type === 'welcome' ? experienceConfig.welcomeQuestions.list : experienceConfig.responseQuestions.list;
    list[index] = value;
    saveAgentConfig(true);
}

// --- Feedback Options Logic ---
function renderFeedbackOptions() {
    const container = document.getElementById('feedback-options-list');
    if (!container) return;
    
    container.innerHTML = '';
    const list = experienceConfig.feedback.options;
    
    list.forEach((option, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2';
        div.innerHTML = `
            <div class="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">${option}</div>
            <button onclick="removeFeedbackOption(${index})" class="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

function addFeedbackOption() {
    const input = document.getElementById('new-feedback-option');
    if (!input) return;
    
    const value = input.value.trim();
    if (!value) {
        showToast('请输入反馈选项内容', 'warning');
        return;
    }
    
    if (experienceConfig.feedback.options.includes(value)) {
        showToast('该选项已存在', 'warning');
        return;
    }
    
    experienceConfig.feedback.options.push(value);
    input.value = '';
    renderFeedbackOptions();
    saveAgentConfig(true);
}

function removeFeedbackOption(index) {
    experienceConfig.feedback.options.splice(index, 1);
    renderFeedbackOptions();
    saveAgentConfig(true);
}

// --- Variable Picker Logic ---
let currentVariableTargetId = null;
const availableVariables = [
    { label: '用户名称', value: '{user}', type: 'user', desc: '当前对话用户的名称' },
    { label: '上下文', value: '{context}', type: 'system', desc: '之前的对话历史' },
    { label: '用户提问', value: '{query}', type: 'system', desc: '当前用户的输入内容' },
    { label: '系统时间', value: '{time}', type: 'system', desc: '当前的系统时间' },
    { label: '日期', value: '{date}', type: 'system', desc: '当前的日期' }
];

function openVariablePicker(event, targetId) {
    event.preventDefault();
    event.stopPropagation();
    currentVariableTargetId = targetId;
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const panel = document.getElementById('variable-picker-panel');
    
    if (!panel) return;
    
    // Render List
    renderVariableList();
    
    // Position Panel (Bottom Right aligned to button)
    panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
    panel.style.left = `${rect.right + window.scrollX - 250}px`; // 250 is approx width
    
    panel.classList.remove('hidden');
    
    // Focus search
    setTimeout(() => {
        document.getElementById('variable-search').focus();
    }, 100);

    // Click outside to close
    document.addEventListener('click', handleOutsideClick);
}

function closeVariablePicker() {
    const panel = document.getElementById('variable-picker-panel');
    if (panel) panel.classList.add('hidden');
    currentVariableTargetId = null;
    document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(e) {
    const panel = document.getElementById('variable-picker-panel');
    if (panel && !panel.contains(e.target) && !e.target.closest('button[onclick^="openVariablePicker"]')) {
        closeVariablePicker();
    }
}

function renderVariableList(filter = '') {
    const container = document.getElementById('variable-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const lowerFilter = filter.toLowerCase();
    const filtered = availableVariables.filter(v => 
        v.label.toLowerCase().includes(lowerFilter) || 
        v.value.toLowerCase().includes(lowerFilter)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="p-3 text-center text-xs text-gray-400">无匹配变量</div>';
        return;
    }
    
    // Group by type
    const groups = {
        user: filtered.filter(v => v.type === 'user'),
        system: filtered.filter(v => v.type === 'system')
    };
    
    if (groups.user.length > 0) {
        renderVariableGroup(container, '用户变量', groups.user);
    }
    
    if (groups.system.length > 0) {
        renderVariableGroup(container, '系统变量', groups.system);
    }
}

function renderVariableGroup(container, title, items) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'mb-2';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider';
    titleDiv.textContent = title;
    groupDiv.appendChild(titleDiv);
    
    items.forEach(v => {
        const item = document.createElement('div');
        item.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between group transition-colors';
        item.onclick = () => selectVariable(v.value);
        
        item.innerHTML = `
            <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-700 group-hover:text-blue-700">${v.label}</span>
                <span class="text-[10px] text-gray-400">${v.desc}</span>
            </div>
            <code class="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-mono group-hover:bg-blue-100 group-hover:text-blue-600">${v.value}</code>
        `;
        groupDiv.appendChild(item);
    });
    
    container.appendChild(groupDiv);
}

function selectVariable(value) {
    if (currentVariableTargetId) {
        insertVariable(value, currentVariableTargetId);
    }
    closeVariablePicker();
}

function onVariableSearchInput(value) {
    renderVariableList(value);
}

function renderQuestionsList(type) {
    const listContainer = document.getElementById(`${type}-questions-list`);
    if (!listContainer) return;
    
    const list = type === 'welcome' ? experienceConfig.welcomeQuestions.list : experienceConfig.responseQuestions.list;
    
    listContainer.innerHTML = '';
    
    list.forEach((q, index) => {
        const inputId = `question-${type}-${index}`;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2';
        div.innerHTML = `
            <div class="relative flex-1">
                <input type="text" id="${inputId}" value="${q}" onchange="updateQuestion('${type}', ${index}, this.value)" class="w-full px-3 py-2 pr-16 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <button onclick="openVariablePicker(event, '${inputId}')" class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="插入变量">
                    <i class="fa-solid fa-code text-xs"></i>
                </button>
            </div>
            <button onclick="removeQuestion('${type}', ${index})" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        listContainer.appendChild(div);
    });
}

function previewWelcomeMessage() {
    const msg = document.getElementById('welcome-msg-input').value;
    if (!msg) {
        showToast('请先输入欢迎语', 'warning');
        return;
    }
    alert(`[预览效果]\n\n${msg}`);
}

// Expose functions to window
window.initExperienceConfig = initExperienceConfig;
window.toggleExperienceFeature = toggleExperienceFeature;
window.addQuestion = addQuestion;
window.removeQuestion = removeQuestion;
window.updateQuestion = updateQuestion;
window.previewWelcomeMessage = previewWelcomeMessage;
window.openVariablePicker = openVariablePicker;
window.closeVariablePicker = closeVariablePicker;
window.selectVariable = selectVariable;
window.onVariableSearchInput = onVariableSearchInput;
window.addFeedbackOption = addFeedbackOption;
window.removeFeedbackOption = removeFeedbackOption;


function openCropModal(imageUrl) {
    const image = document.getElementById('crop-image');
    if (!image) return;
    
    image.src = imageUrl;
    openModal('crop-modal');
    
    // Destroy previous instance if any
    if (cropperInstance) {
        cropperInstance.destroy();
    }
    
    // Init Cropper
    // Use timeout to ensure modal is visible for correct calculation
    setTimeout(() => {
        cropperInstance = new Cropper(image, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    }, 200);
}

function confirmCrop() {
    if (!cropperInstance) return;
    
    // Get cropped canvas
    const canvas = cropperInstance.getCroppedCanvas({
        width: 200,
        height: 200,
    });
    
    currentAvatarDataUrl = canvas.toDataURL('image/png');
    
    // Update Preview in Edit Modal
    const avatarPreview = document.getElementById('edit-agent-avatar-preview');
    updateAvatarPreview(avatarPreview, currentAvatarDataUrl);
    
    closeModal('crop-modal');
}

function saveAgentInfo() {
    const nameInput = document.getElementById('edit-agent-name');
    const descInput = document.getElementById('edit-agent-desc');
    
    const newName = nameInput.value.trim();
    if (!newName) {
        showToast('请输入智能体名称', 'error');
        return;
    }

    // Update Data if existing
    if (currentEditorAgentId) {
        const agent = agentsData.find(a => a.id === currentEditorAgentId);
        if (agent) {
            agent.name = newName;
            agent.description = descInput.value.trim();
            agent.avatar = currentAvatarDataUrl;
            agent.updatedAt = new Date().toLocaleString();
        }
    }

    // Update UI
    const nameDisplay = document.getElementById('agent-name-display');
    const descDisplay = document.getElementById('agent-desc-display');
    const editorTitle = document.getElementById('editor-title');
    const headerAvatarContainer = document.getElementById('editor-agent-avatar');
    
    if (nameDisplay) nameDisplay.textContent = newName;
    if (descDisplay) descDisplay.textContent = descInput.value.trim() || '暂无描述';
    if (editorTitle) editorTitle.textContent = currentEditorAgentId ? `编辑智能体: ${newName}` : newName;
    
    // Update main avatar logic
    if (headerAvatarContainer) {
        if (currentAvatarDataUrl) {
            headerAvatarContainer.innerHTML = `<img src="${currentAvatarDataUrl}" class="w-full h-full object-cover rounded-xl">`;
        } else {
             headerAvatarContainer.innerHTML = '<i class="fa-solid fa-robot"></i>';
        }
    }

    // Also update the hidden/main form inputs if they exist (to keep sync)
    const mainNameInput = document.getElementById('agent-name');
    if (mainNameInput) {
        mainNameInput.value = newName;
        // Store description in dataset for later save
        mainNameInput.dataset.description = descInput.value.trim();
    }

    closeModal('edit-agent-info-modal');
    showToast('基本信息已更新');
}

window.openEditAgentInfoModal = openEditAgentInfoModal;
window.handleAvatarSelect = handleAvatarSelect;
window.confirmCrop = confirmCrop;
window.saveAgentInfo = saveAgentInfo;

// --- Version Control & Publishing ---

function publishAgent() {
    if (!currentEditorAgentId) {
        showToast('请先保存智能体基本信息', 'error');
        return;
    }
    
    const agent = agentsData.find(a => a.id === currentEditorAgentId);
    if (!agent) return;

    // Capture current config
    const nameInput = document.getElementById('agent-name');
    const modelInput = document.getElementById('agent-model');
    const promptInput = document.getElementById('agent-prompt');
    
    const config = {
        name: nameInput ? nameInput.value : agent.name,
        model: modelInput ? modelInput.value : agent.model,
        prompt: promptInput ? promptInput.value : agent.prompt,
        knowledge: [...editorResources.knowledge],
        relatedAgents: [...editorResources.agent],
        orchestrators: [...editorResources.orchestrator]
    };

    // Update agent current config
    agent.name = config.name;
    agent.model = config.model;
    agent.prompt = config.prompt;
    agent.knowledge = config.knowledge;
    agent.relatedAgents = config.relatedAgents;
    agent.orchestrators = config.orchestrators;
    agent.updatedAt = new Date().toLocaleString();
    agent.timestamp = Date.now();

    // Create version
    if (!agent.versions) agent.versions = [];
    const versionId = `v${agent.versions.length + 1}.0`;
    agent.versions.unshift({
        id: versionId,
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        creator: 'Admin', // Mock
        config: { ...config },
        desc: `Updates to prompt and model configuration` // Mock description
    });

    // Show Success Modal
    openModal('publish-success-modal');
}

function confirmPublish() {
    const isPublishToMarket = document.getElementById('publish-to-market-check').checked;
    
    closeModal('publish-success-modal');
    
    if (isPublishToMarket) {
        showToast('发布成功！已同步至组件广场');
    } else {
        showToast('发布成功！');
    }
}

// --- Permission Management ---

let currentPermissionAgentId = null;
let permissionChanges = {
    manage: [],
    edit: [],
    view: []
};

// Mock Users and Depts
const mockUsers = [
    { id: 'u1', name: '张三', dept: '研发部', avatar: 'https://ui-avatars.com/api/?name=ZS&background=0D8ABC&color=fff' },
    { id: 'u2', name: '李四', dept: '产品部', avatar: 'https://ui-avatars.com/api/?name=LS&background=0D8ABC&color=fff' },
    { id: 'u3', name: '王五', dept: '运营部', avatar: 'https://ui-avatars.com/api/?name=WW&background=0D8ABC&color=fff' },
    { id: 'u4', name: '赵六', dept: '研发部', avatar: 'https://ui-avatars.com/api/?name=ZL&background=0D8ABC&color=fff' },
    { id: 'u5', name: '陈七', dept: '市场部', avatar: 'https://ui-avatars.com/api/?name=CQ&background=0D8ABC&color=fff' }
];

const mockDepts = [
    { id: 'd1', name: '研发部', count: 12 },
    { id: 'd2', name: '产品部', count: 5 },
    { id: 'd3', name: '运营部', count: 8 },
    { id: 'd4', name: '市场部', count: 6 },
    { id: 'd5', name: '设计部', count: 4 }
];

function openPermissionModal(agentId) {
    console.log('Opening permission modal for agent:', agentId);
    currentPermissionAgentId = agentId;
    const agent = agentsData.find(a => a.id === agentId);
    
    if (!agent) {
        console.error('Agent not found:', agentId);
        showToast('未找到智能体数据', 'error');
        return;
    }

    // Init permissions if not exist
    if (!agent.permissions) {
        agent.permissions = {
            manage: [],
            edit: [],
            view: []
        };
    }

    // Clone to local state
    permissionChanges = JSON.parse(JSON.stringify(agent.permissions));
    
    const modalTitle = document.getElementById('permission-modal-title');
    const modal = document.getElementById('permission-modal');

    if (!modal || !modalTitle) {
        console.error('Permission modal elements not found in DOM');
        alert('页面资源未完全加载，请尝试刷新页面');
        return;
    }

    // Set Title
    modalTitle.textContent = `权限配置 - ${agent.name}`;
    
    try {
        renderPermissionUI();
        openModal('permission-modal');
    } catch (e) {
        console.error('Error rendering permission UI:', e);
        showToast('界面渲染出错', 'error');
    }
}

function getPermissionTree(role) {
    const common = [
        { name: '使用智能体', checked: true },
        { name: '查看会话日志', checked: role !== 'view' },
    ];
    
    const edit = [
        { name: '修改基础信息', checked: true },
        { name: '配置提示词', checked: true },
        { name: '管理知识库', checked: true },
        { name: '发布版本', checked: true },
    ];
    
    const manage = [
        { name: '管理成员权限', checked: true },
        { name: '删除智能体', checked: true },
    ];
    
    let items = [];
    if (role === 'view') items = [...common];
    else if (role === 'edit') items = [...common, ...edit];
    else if (role === 'manage') items = [...common, ...edit, ...manage];
    
    // Grouping for "Multi-level" feel
    return `
        <div class="mt-2 mb-3 bg-white p-2 rounded border border-gray-100 text-xs">
            <div class="font-medium text-gray-500 mb-1 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors" onclick="togglePermTree('${role}')">
                <span class="flex items-center gap-1"><i class="fa-solid fa-shield-alt text-gray-400"></i> 权限详情</span>
                <i class="fa-solid fa-chevron-down transition-transform duration-200" id="perm-arrow-${role}"></i>
            </div>
            <div id="perm-tree-${role}" class="hidden space-y-2 pl-1 pt-2 border-t border-gray-50 mt-1">
                ${items.map(item => `
                    <label class="flex items-center gap-2 text-gray-700 cursor-not-allowed opacity-80">
                        <input type="checkbox" class="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 border-gray-300" ${item.checked ? 'checked' : ''} disabled>
                        <span>${item.name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

window.togglePermTree = function(role) {
    const tree = document.getElementById(`perm-tree-${role}`);
    const arrow = document.getElementById(`perm-arrow-${role}`);
    if (tree && arrow) {
        if (tree.classList.contains('hidden')) {
            tree.classList.remove('hidden');
            arrow.classList.add('rotate-180');
        } else {
            tree.classList.add('hidden');
            arrow.classList.remove('rotate-180');
        }
    }
}

function renderPermissionUI() {
    ['manage', 'edit', 'view'].forEach(role => {
        const container = document.getElementById(`role-list-${role}`);
        if (!container) return;
        
        // Find or create permission tree container
        const parent = container.parentElement;
        let treeContainer = parent.querySelector(`.perm-tree-container`);
        
        if (!treeContainer) {
            treeContainer = document.createElement('div');
            treeContainer.className = 'perm-tree-container';
            treeContainer.innerHTML = getPermissionTree(role);
            parent.insertBefore(treeContainer, container);
        } else {
            // Update tree content in case logic changes (optional, but safer)
            treeContainer.innerHTML = getPermissionTree(role);
        }

        container.innerHTML = '';
        
        const members = permissionChanges[role] || [];
        
        if (members.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-400 italic py-1 pl-1">暂无成员</span>';
            return;
        }

        members.forEach(member => {
            const el = document.createElement('div');
            el.className = 'flex items-center gap-2 bg-gray-100 rounded-full pl-1 pr-3 py-1 border border-gray-200 group hover:bg-gray-200 transition-colors';
            
            let iconHtml = '';
            if (member.type === 'dept' || member.dept === 'dept') { // Handle both formats if any
                 iconHtml = `<span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs"><i class="fa-solid fa-sitemap"></i></span>`;
            } else {
                iconHtml = `<img src="${member.avatar || 'https://ui-avatars.com/api/?name=' + member.name}" class="w-6 h-6 rounded-full object-cover">`;
            }

            el.innerHTML = `
                ${iconHtml}
                <span class="text-sm text-gray-700">${member.name}</span>
                <button onclick="removePermissionMember('${role}', '${member.id}')" class="text-gray-400 hover:text-red-500 ml-1 transition-colors opacity-0 group-hover:opacity-100">
                    <i class="fa-solid fa-times-circle"></i>
                </button>
            `;
            container.appendChild(el);
        });
    });
}

function removePermissionMember(role, memberId) {
    if (!permissionChanges[role]) return;
    permissionChanges[role] = permissionChanges[role].filter(m => m.id !== memberId);
    renderPermissionUI();
}

function savePermissions() {
    if (!currentPermissionAgentId) return;
    const agent = agentsData.find(a => a.id === currentPermissionAgentId);
    if (agent) {
        agent.permissions = JSON.parse(JSON.stringify(permissionChanges));
        showToast('权限配置已保存');
        closeModal('permission-modal');
        // Log operation (mock)
        console.log(`Permissions updated for Agent ${agent.name}`, agent.permissions);
    }
}

// Member Selector Logic
let currentSelectorRole = null;
let currentSelectorTab = 'user'; // 'user' or 'dept'
let selectorSelected = []; // Temporary selection in selector

function openMemberSelector(role) {
    currentSelectorRole = role;
    selectorSelected = []; // Reset selection
    currentSelectorTab = 'user'; // Reset tab
    
    // Bind search input event dynamically
    const memberSearch = document.getElementById('member-search-input');
    if (memberSearch) {
        memberSearch.value = ''; // Clear search
        // Remove old listener to avoid duplicates? 
        // cloneNode is a cheap way to strip listeners, but might break other things.
        // Better: just assign oninput property which overwrites.
        memberSearch.oninput = updateSelectorUI;
    }

    updateSelectorUI();
    openModal('member-selector-modal');
}

function switchSelectorTab(tab) {
    currentSelectorTab = tab;
    updateSelectorUI();
}

function updateSelectorUI() {
    // Update Tabs Style
    const userTab = document.getElementById('tab-selector-user');
    const deptTab = document.getElementById('tab-selector-dept');
    
    if (currentSelectorTab === 'user') {
        userTab.className = 'flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 bg-blue-50/50';
        deptTab.className = 'flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700';
    } else {
        userTab.className = 'flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700';
        deptTab.className = 'flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 bg-blue-50/50';
    }
    
    // Render List
    const listContainer = document.getElementById('member-selector-list');
    listContainer.innerHTML = '';
    
    const data = currentSelectorTab === 'user' ? mockUsers : mockDepts;
    const searchTerm = (document.getElementById('member-search-input').value || '').toLowerCase();
    
    data.filter(item => item.name.toLowerCase().includes(searchTerm)).forEach(item => {
        const isSelected = selectorSelected.some(s => s.id === item.id);
        
        const div = document.createElement('div');
        div.className = `flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`;
        div.onclick = () => toggleSelectorItem(item);
        
        let leftContent = '';
        if (currentSelectorTab === 'user') {
            leftContent = `
                <div class="flex items-center gap-3">
                    <img src="${item.avatar}" class="w-8 h-8 rounded-full">
                    <div>
                        <div class="text-sm font-medium text-gray-800">${item.name}</div>
                        <div class="text-xs text-gray-500">${item.dept}</div>
                    </div>
                </div>
            `;
        } else {
            leftContent = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <i class="fa-solid fa-sitemap"></i>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-800">${item.name}</div>
                        <div class="text-xs text-gray-500">${item.count} 人</div>
                    </div>
                </div>
            `;
        }
        
        div.innerHTML = `
            ${leftContent}
            <div class="w-5 h-5 rounded-full border ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'} flex items-center justify-center">
                ${isSelected ? '<i class="fa-solid fa-check text-xs"></i>' : ''}
            </div>
        `;
        
        listContainer.appendChild(div);
    });
    
    // Update Preview Area
    const previewArea = document.getElementById('selected-preview-area');
    const countSpan = document.getElementById('selected-count');
    
    countSpan.textContent = selectorSelected.length;
    previewArea.innerHTML = '';
    
    selectorSelected.forEach(item => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100';
        tag.innerHTML = `
            <span>${item.name}</span>
            <i class="fa-solid fa-times cursor-pointer hover:text-blue-900" onclick="event.stopPropagation(); toggleSelectorItem({id: '${item.id}'})"></i>
        `;
        previewArea.appendChild(tag);
    });
}

function toggleSelectorItem(item) {
    const idx = selectorSelected.findIndex(s => s.id === item.id);
    if (idx >= 0) {
        selectorSelected.splice(idx, 1);
    } else {
        // Need full item data if adding
        const fullItem = [...mockUsers, ...mockDepts].find(i => i.id === item.id);
        if (fullItem) {
            selectorSelected.push({
                id: fullItem.id,
                name: fullItem.name,
                type: fullItem.dept ? 'user' : 'dept', // heuristic
                avatar: fullItem.avatar
            });
        }
    }
    updateSelectorUI();
}

function confirmMemberSelection() {
    if (!currentSelectorRole) return;
    
    // Merge selection into permissionChanges
    // Filter out duplicates
    const currentMembers = permissionChanges[currentSelectorRole] || [];
    
    selectorSelected.forEach(newItem => {
        if (!currentMembers.some(existing => existing.id === newItem.id)) {
            currentMembers.push(newItem);
        }
    });
    
    permissionChanges[currentSelectorRole] = currentMembers;
    
    renderPermissionUI();
    closeModal('member-selector-modal');
}

// Bind Search Input - Moved to openMemberSelector
// document.addEventListener('DOMContentLoaded', () => {
//    const memberSearch = document.getElementById('member-search-input');
//    if (memberSearch) {
//        memberSearch.addEventListener('input', updateSelectorUI);
//    }
// });

window.openPermissionModal = openPermissionModal;
window.renderPermissionUI = renderPermissionUI;
window.removePermissionMember = removePermissionMember;
window.savePermissions = savePermissions;
window.openMemberSelector = openMemberSelector;
window.switchSelectorTab = switchSelectorTab;
window.toggleSelectorItem = toggleSelectorItem;
window.confirmMemberSelection = confirmMemberSelection;