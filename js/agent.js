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
                        ${agent.model}
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
                    ${agent.updatedAt}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="event.stopPropagation(); editAgent('${agent.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="编辑">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="event.stopPropagation(); openDeleteConfirm('${agent.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
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
        agent.status = agent.status === 'running' ? 'stopped' : 'running';
        renderAgentList(false); 
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
window.editAgent = editAgent;

// --- Agent Editor Logic ---

let currentEditorAgentId = null;

// --- Resource Management Logic ---
let editorResources = {
    knowledge: [],
    agent: [],
    orchestrator: []
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
        
        const item = data.find(x => x.id === id);
        if (item) name = item.name;
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-white rounded-md border border-gray-200 text-xs shadow-sm group hover:border-blue-300 transition-all';
        div.innerHTML = `
            <span class="text-gray-700 truncate mr-2 flex-1 flex items-center gap-2">
                <i class="fa-solid fa-link text-gray-300 text-[10px]"></i>
                ${name}
            </span>
            <button onclick="removeResource('${type}', '${id}')" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

// Expose resource functions
window.addResource = addResource;
window.removeResource = removeResource;

// Toggle Section
function toggleSection(contentId, headerElement) {
    const content = document.getElementById(contentId);
    if (!content) return;
    
    content.classList.toggle('hidden');
    
    const chevron = headerElement.querySelector('.fa-chevron-down');
    if (chevron) {
        if (content.classList.contains('hidden')) {
            chevron.style.transform = 'rotate(-90deg)';
        } else {
            chevron.style.transform = 'rotate(0deg)';
        }
    }
}

window.toggleSection = toggleSection;

function initAgentEditor(params) {
    console.log('Initializing Agent Editor with params:', params);
    
    // Ensure data exists (in case of page reload directly on editor)
    if (typeof agentsData === 'undefined' || agentsData.length === 0) {
        agentsData = generateMockAgents(10);
    }
    
    // Reset Tabs
    switchEditorTab('config');
    
    // Initialize Resources State
    editorResources = {
        knowledge: [],
        agent: [],
        orchestrator: []
    };

    // Load Resources Options
    loadResources();
    
    // Load Data if ID exists
    if (params && params.id) {
        currentEditorAgentId = params.id;
        const agent = agentsData.find(a => a.id == params.id);
        if (agent) {
            // Update Title
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `编辑智能体: ${agent.name}`;
            
            // Populate Form
            const nameInput = document.getElementById('agent-name');
            const modelInput = document.getElementById('agent-model');
            const promptInput = document.getElementById('agent-prompt');
            
            if (nameInput) nameInput.value = agent.name;
            if (modelInput) modelInput.value = agent.model;
            if (promptInput && agent.prompt) promptInput.value = agent.prompt;

            // Load Agent's Resources
            if (agent.knowledge) editorResources.knowledge = [...agent.knowledge];
            if (agent.relatedAgents) editorResources.agent = [...agent.relatedAgents];
            if (agent.orchestrators) editorResources.orchestrator = [...agent.orchestrators];
        }
    } else {
        currentEditorAgentId = null;
        // New Agent Mode
        const titleEl = document.getElementById('editor-title');
        if (titleEl) titleEl.textContent = '新建智能体';
        // Clear inputs
        const nameInput = document.getElementById('agent-name');
        const modelInput = document.getElementById('agent-model');
        const promptInput = document.getElementById('agent-prompt');
        if (nameInput) nameInput.value = '';
        if (modelInput) modelInput.value = '';
        if (promptInput) promptInput.value = '';
    }

    // Render Initial Lists
    renderResourceList('knowledge');
    renderResourceList('agent');
    renderResourceList('orchestrator');
}

function switchEditorTab(tabId) {
    // Hide all contents
    ['config', 'publish', 'logs', 'analytics'].forEach(id => {
        const content = document.getElementById(`tab-content-${id}`);
        const btn = document.getElementById(`tab-btn-${id}`);
        
        if (content) content.classList.add('hidden');
        if (btn) {
            btn.classList.remove('text-blue-600', 'border-blue-600');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });
    
    // Show selected
    const content = document.getElementById(`tab-content-${tabId}`);
    const btn = document.getElementById(`tab-btn-${tabId}`);
    
    if (content) content.classList.remove('hidden');
    if (btn) {
        btn.classList.remove('text-gray-500', 'border-transparent');
        btn.classList.add('text-blue-600', 'border-blue-600');
    }
    
    // Refresh Logs if needed
    if (tabId === 'logs') {
        renderLogList(true);
    }
}

function saveAgentConfig() {
    // Show saving feedback
    const btn = document.querySelector('button[onclick="saveAgentConfig()"]');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 保存中...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('配置已保存');
    }, 1000);
}

// Expose editor functions
window.initAgentEditor = initAgentEditor;
window.switchEditorTab = switchEditorTab;
window.saveAgentConfig = saveAgentConfig;

// Copy Web Preview Link
function copyWebLink() {
    const link = "https://chat.vagent.ai/preview/ag_839201";
    navigator.clipboard.writeText(link).then(() => {
        showToast('链接已复制到剪贴板');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for non-secure contexts if needed, or just alert
        showToast('复制失败', 'error');
    });
}

// Copy SDK Code
function copySdkCode() {
    const codeBlock = document.getElementById('sdk-code-block');
    if (codeBlock) {
        const code = codeBlock.textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast('SDK 代码已复制');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('复制失败', 'error');
        });
    }
}

window.copyWebLink = copyWebLink;
window.copySdkCode = copySdkCode;

// Save Component Config
function saveComponentConfig() {
    closeModal('component-config-modal');
    showToast('组件配置已保存');
}

window.saveComponentConfig = saveComponentConfig;

// --- Logs Management Logic ---

let logsData = [];
let currentLogSearch = '';
let currentLogFilter = 'all';

// Generate Mock Logs
function generateMockLogs(count) {
    const logs = [];
    const users = ['User_8392', 'User_1204', 'User_5593', 'User_9921', 'User_3322'];
    const topics = ['Python Hello World', 'DeepSeek V2 评价', 'Translate to Chinese', '写一个 SQL 查询', 'React 组件优化', '解释量子纠缠', '生成周报'];
    const statuses = ['active', 'completed'];
    
    for (let i = 0; i < count; i++) {
        const date = new Date(Date.now() - Math.floor(Math.random() * 1000000000)); // Random time in last ~11 days
        const status = statuses[Math.floor(Math.random() * statuses.length)];
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

function openVersionHistory() {
    if (!currentEditorAgentId) return;
    
    const agent = agentsData.find(a => a.id === currentEditorAgentId);
    if (!agent) return;

    // Mock history if empty
    if (!agent.versions || agent.versions.length === 0) {
        if (!agent.versions) agent.versions = [];
         agent.versions.push({
            id: 'v1.0',
            timestamp: Date.now() - 86400000,
            date: new Date(Date.now() - 86400000).toLocaleString(),
            creator: 'Admin',
            config: { name: agent.name, model: agent.model, prompt: "Initial prompt..." },
            desc: 'Initial release'
        });
    }

    const container = document.getElementById('version-list-container');
    container.innerHTML = agent.versions.map((v, index) => `
        <div class="flex items-start gap-4 p-4 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                ${v.id}
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                    <h4 class="text-sm font-semibold text-gray-900">发布于 ${v.date}</h4>
                    ${index === 0 ? '<span class="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">当前版本</span>' : ''}
                </div>
                <p class="text-xs text-gray-500 mb-2">操作人: ${v.creator || 'Admin'}</p>
                <p class="text-sm text-gray-600 mb-3">${v.desc || '常规更新'}</p>
                
                ${index !== 0 ? `
                <button onclick="restoreVersion('${v.id}')" class="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <i class="fa-solid fa-clock-rotate-left"></i> 回滚到此版本
                </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    openModal('version-history-modal');
}

function restoreVersion(versionId) {
    if (!currentEditorAgentId) return;
    const agent = agentsData.find(a => a.id === currentEditorAgentId);
    if (!agent) return;
    
    const version = agent.versions.find(v => v.id === versionId);
    if (!version) return;
    
    // Restore config
    const nameInput = document.getElementById('agent-name');
    const modelInput = document.getElementById('agent-model');
    const promptInput = document.getElementById('agent-prompt');

    if (nameInput) nameInput.value = version.config.name;
    if (modelInput) modelInput.value = version.config.model;
    if (promptInput) promptInput.value = version.config.prompt;
    
    // Restore resources
    if (version.config.knowledge) editorResources.knowledge = [...version.config.knowledge];
    else editorResources.knowledge = [];
    
    if (version.config.relatedAgents) editorResources.agent = [...version.config.relatedAgents];
    else editorResources.agent = [];

    if (version.config.orchestrators) editorResources.orchestrator = [...version.config.orchestrators];
    else editorResources.orchestrator = [];

    renderResourceList('knowledge');
    renderResourceList('agent');
    renderResourceList('orchestrator');
    
    closeModal('version-history-modal');
    showToast(`已回滚到版本 ${versionId}`);
}

window.publishAgent = publishAgent;
window.confirmPublish = confirmPublish;
window.openVersionHistory = openVersionHistory;
window.restoreVersion = restoreVersion;
