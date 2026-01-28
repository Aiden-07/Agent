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

// Fixed Mock Data
const FIXED_AGENT_LIST = [
    {
        id: 'AGT-FIX-001',
        name: '电商客服助手',
        model: 'GPT-4o',
        description: '专业的电商客服，擅长处理售后问题和产品咨询，支持多轮对话和情绪安抚。',
        knowledgeBase: ['产品文档库', '话术规范'],
        creator: 'Admin',
        createdAt: '2024/05/20 10:00:00',
        timestamp: 1716170400000,
        updatedAt: '2024/05/21 14:30:00',
        status: 'running',
        hot: 9527
    },
    {
        id: 'AGT-FIX-002',
        name: 'Python 代码审查员',
        model: 'Claude 3.5 Sonnet',
        description: '资深 Python 开发工程师，专注于代码质量审查、性能优化建议和安全漏洞扫描。',
        knowledgeBase: ['技术规范', '最佳实践'],
        creator: 'User_1001',
        createdAt: '2024/05/18 09:15:00',
        timestamp: 1715994900000,
        updatedAt: '2024/05/20 11:20:00',
        status: 'running',
        hot: 8843
    },
    {
        id: 'AGT-FIX-003',
        name: '英文翻译专家',
        model: 'GPT-4 Turbo',
        description: '精通中英互译，擅长科技、法律、文学等多种文风的翻译，信达雅兼备。',
        knowledgeBase: ['专业术语库'],
        creator: 'User_1002',
        createdAt: '2024/05/15 16:45:00',
        timestamp: 1715762700000,
        updatedAt: '2024/05/19 09:10:00',
        status: 'running',
        hot: 7210
    },
    {
        id: 'AGT-FIX-004',
        name: 'SQL 查询生成器',
        model: 'DeepSeek V2',
        description: '根据自然语言描述生成复杂的 SQL 查询语句，支持 MySQL、PostgreSQL 和 Oracle。',
        knowledgeBase: ['数据库Schema', 'SQL优化指南'],
        creator: 'User_1001',
        createdAt: '2024/05/12 11:30:00',
        timestamp: 1715484600000,
        updatedAt: '2024/05/18 15:55:00',
        status: 'stopped',
        hot: 6532
    },
    {
        id: 'AGT-FIX-005',
        name: '周报自动生成助手',
        model: 'GPT-4o',
        description: '根据本周工作记录自动生成结构清晰、重点突出的周报，支持自定义模板。',
        knowledgeBase: ['员工手册'],
        creator: 'User_1003',
        createdAt: '2024/05/10 08:50:00',
        timestamp: 1715302200000,
        updatedAt: '2024/05/17 18:20:00',
        status: 'running',
        hot: 5421
    },
    {
        id: 'AGT-FIX-006',
        name: '产品文案润色',
        model: 'Claude 3.5 Sonnet',
        description: '为产品营销文案提供润色建议，提升吸引力和转化率，支持多种营销风格。',
        knowledgeBase: ['市场分析报告', '广告法合规库'],
        creator: 'Admin',
        createdAt: '2024/05/08 14:20:00',
        timestamp: 1715149200000,
        updatedAt: '2024/05/15 10:40:00',
        status: 'running',
        hot: 4980
    },
    {
        id: 'AGT-FIX-007',
        name: '旅游行程规划师',
        model: 'GPT-4 Turbo',
        description: '根据预算、时间和兴趣爱好，为您定制个性化的全球旅游行程规划。',
        knowledgeBase: ['全球景点库', '签证指南'],
        creator: 'User_1002',
        createdAt: '2024/05/05 13:10:00',
        timestamp: 1714885800000,
        updatedAt: '2024/05/12 09:30:00',
        status: 'stopped',
        hot: 3215
    },
    {
        id: 'AGT-FIX-008',
        name: '法律咨询顾问',
        model: 'DeepSeek V2',
        description: '提供基础的法律咨询服务，涵盖劳动法、合同法、婚姻法等常见领域。',
        knowledgeBase: ['民法典', '劳动法'],
        creator: 'Admin',
        createdAt: '2024/05/01 09:00:00',
        timestamp: 1714525200000,
        updatedAt: '2024/05/10 16:15:00',
        status: 'running',
        hot: 2890
    },
    {
        id: 'AGT-FIX-009',
        name: '前端组件生成器',
        model: 'Claude 3.5 Sonnet',
        description: '根据描述生成 React/Vue 组件代码，支持 TailwindCSS 样式。',
        knowledgeBase: ['技术规范', 'UI组件库'],
        creator: 'User_1001',
        createdAt: '2024/04/28 10:30:00',
        timestamp: 1714271400000,
        updatedAt: '2024/05/08 11:50:00',
        status: 'running',
        hot: 2560
    },
    {
        id: 'AGT-FIX-010',
        name: '招聘简历筛选助手',
        model: 'GPT-4o',
        description: '自动分析简历与职位的匹配度，提取关键信息并生成面试建议。',
        knowledgeBase: ['岗位JD库', '人才画像'],
        creator: 'User_1003',
        createdAt: '2024/04/25 15:00:00',
        timestamp: 1714028400000,
        updatedAt: '2024/05/05 14:20:00',
        status: 'running',
        hot: 2100
    }
];

// Generate initial mock data
function generateMockAgents(count) {
    // Return fixed list regardless of count to ensure consistency
    // If count is larger than list, we could loop, but for now just return the fixed list.
    return JSON.parse(JSON.stringify(FIXED_AGENT_LIST));
}

// Initialize
function initAgentPage() {
    console.log('Initializing Agent Page...');
    
    // Always reset to fixed data on initialization to prevent stale/random data persistence
    agentsData = generateMockAgents(10); 
    
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
        
        // Disable infinite scroll of random data as per user request for "Fixed Batch"
        // const newItems = generateMockAgents(5); 
        // agentsData = [...agentsData, ...newItems]; // Append to master list
        
        // renderAgentList(false); // Append/Re-render
        
        isLoading = false;
        hasMore = false; // Stop loading more
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
            label: '权限配置',
            icon: 'fa-solid fa-user-shield',
            onClick: () => {
                const agent = agentsData.find(a => a.id === id);
                if (window.navigateToPermissionConfig) {
                    window.navigateToPermissionConfig(id, 'agent', agent ? agent.name : 'Unknown Agent');
                }
            }
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

let experienceConfig;
let themeConfig;
let agentI18nConfig;
let agentI18nModalInitialSelectedCount = 0;

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
            agent.experience = JSON.parse(JSON.stringify(experienceConfig));
            agent.i18n = JSON.parse(JSON.stringify(agentI18nConfig));
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
            initThemeConfig(agent);

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
        initThemeConfig(null);
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
                // Special handling for analytics tab
                if (t === 'analytics' && window.renderAnalytics) {
                    // Delay slightly to ensure container is visible for size calculation
                    setTimeout(() => window.renderAnalytics(), 50);
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
    const users = ['陈思宇', '林志强', '王晓明', '张雅婷', '李子涵', '刘伟', '赵丽华', '孙建国', '周梦琪', '吴嘉豪', '郑雨萱', '徐浩然'];
    const departments = ['研发部', '产品部', '市场部', '销售部', '人力资源部', '财务部', '客服部'];
    const topics = ['如何重置密码', '查询订单状态', '产品使用咨询', '系统报错反馈', 'API接入问题', '账号权限申请', '数据导出请求'];
    const statuses = ['active', 'closed'];
    const platforms = ['WEB', 'OGW'];
    
    for (let i = 0; i < count; i++) {
        const date = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
        const status = statuses[Math.random() > 0.3 ? 1 : 0]; // 70% closed
        const msgCount = Math.floor(Math.random() * 20) + 2;
        
        logs.push({
            id: `sess_${Math.floor(Math.random() * 100000000)}`,
            user: users[Math.floor(Math.random() * users.length)],
            userId: `u_${Math.floor(Math.random() * 100000)}`,
            department: departments[Math.floor(Math.random() * departments.length)],
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            copyCount: Math.floor(Math.random() * 200),
            regenerateCount: Math.floor(Math.random() * 50),
            translateCount: Math.floor(Math.random() * 30),
            summarizeCount: Math.floor(Math.random() * 20),
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
        const baseMsg = interactions[i % interactions.length];
        const msg = {
            ...baseMsg,
            id: `msg_${Date.now()}_${i}`,
            likeCount: 0, // Counts are hidden but we keep structure
            dislikeCount: 0,
            userAction: null, // 'like', 'dislike', or null
            dislikeReason: null
        };
        
        // Randomly assign some initial state for AI messages
        if (msg.role === 'ai') {
            const rand = Math.random();
            // 80% chance to have an interaction for demo purposes (high density)
            if (rand > 0.2) {
                // Of the interactions: 60% like, 40% dislike
                if (Math.random() > 0.4) {
                    msg.userAction = 'like';
                    msg.likeCount = 1;
                } else {
                    msg.userAction = 'dislike';
                    msg.dislikeCount = 1;
                    
                    // Assign random reason
                    const reasons = [
                        '回答不准确',
                        '内容不相关',
                        '逻辑错误',
                        '信息过时',
                        '语气不当',
                        '代码无法运行'
                    ];
                    msg.dislikeReason = reasons[Math.floor(Math.random() * reasons.length)];
                }
            }
        }
        
        content.push(msg);
    }
    return content;
}

// --- Analytics Logic ---

function renderAnalytics() {
    if (typeof echarts === 'undefined') {
        console.warn('ECharts is not loaded');
        return;
    }

    // 1. Department Usage Chart (Bar)
    const deptChartDom = document.getElementById('analytics-chart-dept');
    if (deptChartDom) {
        // Dispose existing instance if any to prevent memory leaks or reuse issues
        const existingInstance = echarts.getInstanceByDom(deptChartDom);
        if (existingInstance) {
            existingInstance.dispose();
        }

        const deptChart = echarts.init(deptChartDom);
        const deptOption = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: [
                {
                    type: 'category',
                    data: ['研发部', '产品部', '市场部', '销售部', '客服部', '人力资源', '财务部'],
                    axisTick: {
                        alignWithLabel: true
                    }
                }
            ],
            yAxis: [
                {
                    type: 'value'
                }
            ],
            series: [
                {
                    name: '使用次数',
                    type: 'bar',
                    barWidth: '60%',
                    data: [320, 280, 220, 180, 150, 90, 60],
                    itemStyle: {
                        color: '#3b82f6'
                    }
                }
            ]
        };
        deptChart.setOption(deptOption);
        
        // Handle resize
        window.addEventListener('resize', () => {
            deptChart.resize();
        });
    }

    // 2. User Feedback Chart (Pie)
    const feedbackChartDom = document.getElementById('analytics-chart-feedback');
    if (feedbackChartDom) {
        // Dispose existing instance
        const existingInstance = echarts.getInstanceByDom(feedbackChartDom);
        if (existingInstance) {
            existingInstance.dispose();
        }

        const feedbackChart = echarts.init(feedbackChartDom);
        const feedbackOption = {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            legend: {
                bottom: '5%',
                left: 'center',
                itemGap: 20,
                textStyle: {
                    color: '#666'
                }
            },
            color: ['#22c55e', '#ef4444', '#9ca3af'],
            series: [
                {
                    name: '反馈分布',
                    type: 'pie',
                    radius: '70%',
                    center: ['50%', '45%'],
                    itemStyle: {
                        borderRadius: 8,
                        borderColor: '#fff',
                        borderWidth: 2,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.05)'
                    },
                    label: {
                        show: true,
                        formatter: '{b}\n{d}%',
                        color: '#4b5563',
                        fontSize: 14,
                        lineHeight: 20
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: 16,
                            fontWeight: 'bold'
                        },
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.2)'
                        }
                    },
                    data: [
                        { value: 735, name: '点赞' },
                        { value: 102, name: '点踩' },
                        { value: 367, name: '未评价' }
                    ]
                }
            ]
        };
        feedbackChart.setOption(feedbackOption);
        
        // Handle resize
        window.addEventListener('resize', () => {
            feedbackChart.resize();
        });
    }
}

// Expose
window.renderAnalytics = renderAnalytics;
window.renderLogList = renderLogList;

function renderLogList(reset = false) {
    if (reset || logsData.length === 0) {
        logsData = generateMockLogs(20); // Generate 20 items as requested
        
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
                              log.department.toLowerCase().includes(currentLogSearch) ||
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
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title="${log.topic}">
                    ${log.topic}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        ${log.user}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    ${log.userId}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                        ${log.department || '无部门'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs ${log.platform === 'WEB' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}">
                        ${log.platform || 'WEB'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.createdAt}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.updatedAt}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.messageCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(log.copyCount || 0).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(log.regenerateCount || 0).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(log.translateCount || 0).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(log.summarizeCount || 0).toLocaleString()}
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

    log.content.forEach((msg, index) => {
        const isUser = msg.role === 'user';
        const div = document.createElement('div');
        div.className = isUser ? 'flex gap-3 flex-row-reverse mb-6' : 'flex gap-3 mb-6';
        
        let feedbackHtml = '';
        if (!isUser) {
            const isLiked = msg.userAction === 'like';
            const isDisliked = msg.userAction === 'dislike';
            
            if (isLiked) {
                feedbackHtml = `
                    <div class="flex items-center gap-2 mt-2 ml-1">
                        <div class="flex items-center gap-1 text-xs text-green-600 font-medium select-none cursor-default">
                            <i class="fa-solid fa-thumbs-up"></i>
                        </div>
                    </div>
                `;
            } else if (isDisliked) {
                feedbackHtml = `
                    <div class="flex items-center gap-2 mt-2 ml-1">
                        <div class="flex items-center gap-1 text-xs text-red-600 font-medium select-none cursor-default">
                            <i class="fa-solid fa-thumbs-down"></i>
                        </div>
                        <span class="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 select-none">
                            ${msg.dislikeReason || '未知原因'}
                        </span>
                    </div>
                `;
            }
        }

        div.innerHTML = `
            <div class="w-8 h-8 rounded-full ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center text-xs flex-shrink-0">
                <i class="fa-solid fa-${isUser ? 'user' : 'robot'}"></i>
            </div>
            <div class="max-w-[80%]">
                <div class="${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'} rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                    ${msg.text}
                </div>
                ${feedbackHtml}
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

// --- Permission Management (Removed) ---

// --- Experience Configuration Logic ---

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

function initThemeConfig(agent) {
    // Default Config
    themeConfig = {
        background: { enabled: false, image: null, scope: 'chat', opacity: 100 },
        themeColor: '#2563EB' // Default Blue-600
    };

    if (agent) {
        // Migration Logic: Check if old experience background exists
        if (agent.experience && agent.experience.background) {
            themeConfig.background = JSON.parse(JSON.stringify(agent.experience.background));
        }
        
        // Load from theme if exists (overwrites migration)
        if (agent.theme) {
             if (agent.theme.background) themeConfig.background = {...themeConfig.background, ...agent.theme.background};
             if (agent.theme.themeColor) themeConfig.themeColor = agent.theme.themeColor;
        }
    }
    
    // Render UI
    const backgroundCheck = document.getElementById('background-check');
    const backgroundScopeChat = document.getElementById('bg-scope-chat');
    const backgroundScopeGlobal = document.getElementById('bg-scope-global');
    const backgroundOpacity = document.getElementById('bg-opacity-slider');
    const backgroundOpacityValue = document.getElementById('bg-opacity-value');
    
    // Theme Color UI
    const themeColorInput = document.getElementById('theme-color-input');
    const themeColorPreview = document.getElementById('theme-color-preview');
    
    if (backgroundCheck) backgroundCheck.checked = themeConfig.background?.enabled || false;
    if (backgroundScopeChat && themeConfig.background?.scope === 'chat') backgroundScopeChat.checked = true;
    if (backgroundScopeGlobal && themeConfig.background?.scope === 'global') backgroundScopeGlobal.checked = true;
    if (backgroundOpacity) {
        backgroundOpacity.value = themeConfig.background?.opacity || 100;
        if (backgroundOpacityValue) backgroundOpacityValue.textContent = `${backgroundOpacity.value}%`;
    }
    
    if (themeColorInput) themeColorInput.value = themeConfig.themeColor || '#2563EB';
    if (themeColorPreview) themeColorPreview.style.backgroundColor = themeConfig.themeColor || '#2563EB';

    updateBackgroundPreview(themeConfig.background?.image);
    
    // Toggle UI
    toggleThemeFeature('background', false);
}

function getAgentI18nLanguages() {
    return [
        { code: 'zh', label: '中文 (Chinese)' },
        { code: 'en', label: '英语 (English)' },
        { code: 'ja', label: '日语 (Japanese)' },
        { code: 'ko', label: '韩语 (Korean)' },
        { code: 'fr', label: '法语 (French)' },
        { code: 'de', label: '德语 (German)' },
        { code: 'es', label: '西班牙语 (Spanish)' }
    ];
}

function initAgentI18nConfig(agent) {
    agentI18nConfig = {
        enabled: false,
        languages: [],
        customInfo: {}
    };
    if (agent && agent.i18n) {
        if (typeof agent.i18n.enabled === 'boolean') agentI18nConfig.enabled = agent.i18n.enabled;
        if (Array.isArray(agent.i18n.languages)) agentI18nConfig.languages = [...agent.i18n.languages];
        if (agent.i18n.customInfo && typeof agent.i18n.customInfo === 'object') {
            agentI18nConfig.customInfo = JSON.parse(JSON.stringify(agent.i18n.customInfo));
        }
    }
    if (!Array.isArray(agentI18nConfig.languages) || !agentI18nConfig.languages.length) {
        agentI18nConfig.languages = ['zh'];
    } else if (!agentI18nConfig.languages.includes('zh')) {
        agentI18nConfig.languages = ['zh', ...agentI18nConfig.languages];
    }
    const switchEl = document.getElementById('agent-i18n-switch');
    const displayEl = document.getElementById('agent-i18n-display');
    if (switchEl) switchEl.checked = !!agentI18nConfig.enabled;
    if (displayEl) {
        if (agentI18nConfig.enabled) displayEl.classList.remove('hidden');
        else displayEl.classList.add('hidden');
    }
    updateAgentI18nSelectedLanguagesUI();
}

function updateAgentI18nSelectedLanguagesUI() {
    const container = document.getElementById('agent-i18n-selected-languages');
    if (!container) return;
    container.innerHTML = '';
    const langs = agentI18nConfig && Array.isArray(agentI18nConfig.languages) ? agentI18nConfig.languages : [];
    if (!langs.length) {
        const span = document.createElement('span');
        span.className = 'text-gray-400';
        span.textContent = '暂无选中语言';
        container.appendChild(span);
        return;
    }
    const all = getAgentI18nLanguages();
    langs.forEach(code => {
        const meta = all.find(l => l.code === code);
        const label = meta ? meta.label : code;
        const span = document.createElement('span');
        span.className = 'px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100';
        span.textContent = label;
        container.appendChild(span);
    });
}

function toggleAgentI18n() {
    const switchEl = document.getElementById('agent-i18n-switch');
    const displayEl = document.getElementById('agent-i18n-display');
    const enabled = switchEl && switchEl.checked;
    if (!agentI18nConfig) {
        agentI18nConfig = { enabled: false, languages: [], customInfo: {} };
    }
    agentI18nConfig.enabled = !!enabled;
    if (displayEl) {
        if (enabled) displayEl.classList.remove('hidden');
        else displayEl.classList.add('hidden');
    }
    if (enabled && (!agentI18nConfig.languages || !agentI18nConfig.languages.length)) {
        openAgentI18nLanguagesModal();
    }
    saveAgentConfig(true);
}

function openAgentI18nLanguagesModal() {
    const langs = agentI18nConfig && Array.isArray(agentI18nConfig.languages) ? agentI18nConfig.languages : [];
    agentI18nModalInitialSelectedCount = langs.filter(code => code !== 'zh').length;
    const searchInput = document.getElementById('agent-i18n-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = function (e) {
            renderAgentI18nLanguageList(e.target.value);
        };
    }
    renderAgentI18nLanguageList('');
    openModal('agent-i18n-modal');
}

function cancelAgentI18nSelection() {
    if (!agentI18nConfig) {
        closeModal('agent-i18n-modal');
        return;
    }
    if (agentI18nModalInitialSelectedCount === 0) {
        const switchEl = document.getElementById('agent-i18n-switch');
        const displayEl = document.getElementById('agent-i18n-display');
        if (switchEl) switchEl.checked = false;
        agentI18nConfig.enabled = false;
        if (displayEl) displayEl.classList.add('hidden');
        saveAgentConfig(true);
    }
    closeModal('agent-i18n-modal');
}

function openAgentI18nModalFromDisplay() {
    const switchEl = document.getElementById('agent-i18n-switch');
    if (switchEl && !switchEl.checked) {
        switchEl.checked = true;
        toggleAgentI18n();
    }
    openAgentI18nLanguagesModal();
}

function renderAgentI18nLanguageList(keyword) {
    const container = document.getElementById('agent-i18n-language-list');
    if (!container) return;
    const all = getAgentI18nLanguages();
    const selected = agentI18nConfig && Array.isArray(agentI18nConfig.languages) ? agentI18nConfig.languages : [];
    const kw = (keyword || '').toLowerCase();
    container.innerHTML = '';
    all.filter(l => {
        if (!kw) return true;
        return l.code.toLowerCase().includes(kw) || l.label.toLowerCase().includes(kw);
    }).forEach(lang => {
        const id = `agent-i18n-lang-${lang.code}`;
        const isFixed = lang.code === 'zh';
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer';
        const left = document.createElement('div');
        left.className = 'flex flex-col';
        const labelEl = document.createElement('span');
        labelEl.className = 'text-sm text-gray-800';
        labelEl.textContent = lang.label;
        const codeEl = document.createElement('span');
        codeEl.className = 'text-xs text-gray-400';
        codeEl.textContent = lang.code;
        left.appendChild(labelEl);
        left.appendChild(codeEl);
        const right = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'w-4 h-4 text-blue-600 border-gray-300 rounded';
        input.checked = isFixed || selected.includes(lang.code);
        if (isFixed) input.disabled = true;
        right.appendChild(input);
        wrapper.appendChild(left);
        wrapper.appendChild(right);
        wrapper.onclick = function (e) {
            if (isFixed) return;
            if (e.target.tagName !== 'INPUT') {
                input.checked = !input.checked;
            }
        };
        container.appendChild(wrapper);
    });
}

function confirmAgentI18nSelection() {
    const all = getAgentI18nLanguages();
    const selectedCodes = [];
    all.forEach(lang => {
        const input = document.getElementById(`agent-i18n-lang-${lang.code}`);
        if (input && input.checked) selectedCodes.push(lang.code);
    });
    if (!agentI18nConfig) {
        agentI18nConfig = { enabled: true, languages: [], customInfo: {} };
    }
    const existingCustom = agentI18nConfig.customInfo || {};
    const nextCustom = {};
    selectedCodes.forEach(code => {
        if (existingCustom[code]) nextCustom[code] = existingCustom[code];
    });
    agentI18nConfig.languages = selectedCodes;
    agentI18nConfig.customInfo = nextCustom;
    updateAgentI18nSelectedLanguagesUI();
    closeModal('agent-i18n-modal');
    saveAgentConfig(true);
}

function openAgentI18nCustomModal() {
    if (!agentI18nConfig || !agentI18nConfig.languages || !agentI18nConfig.languages.length) {
        showToast('请先选择语言', 'warning');
        return;
    }
    const container = document.getElementById('agent-i18n-custom-columns');
    if (!container) return;
    const langs = agentI18nConfig.languages;
    const custom = agentI18nConfig.customInfo || {};
    container.innerHTML = '';
    const gridTemplate = langs.length <= 3 ? `repeat(${langs.length}, minmax(0, 1fr))` : `repeat(${langs.length}, minmax(220px, 1fr))`;
    container.style.gridTemplateColumns = gridTemplate;
    const all = getAgentI18nLanguages();
    langs.forEach(code => {
        const meta = all.find(l => l.code === code);
        const title = meta ? meta.label : code;
        const values = custom[code] || {};
        const column = document.createElement('div');
        column.className = 'bg-white border border-gray-100 rounded-lg p-4 space-y-3';
        column.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-900">${title}</span>
                <span class="text-xs text-gray-400">${code}</span>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">名称</label>
                <input type="text" id="agent-i18n-name-${code}" value="${values.name || ''}" class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">描述</label>
                <textarea id="agent-i18n-desc-${code}" rows="2" class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none">${values.description || ''}</textarea>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">欢迎语</label>
                <textarea id="agent-i18n-welcome-${code}" rows="2" class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none">${values.welcomeMsg || ''}</textarea>
            </div>
        `;
        container.appendChild(column);
    });
    openModal('agent-i18n-custom-modal');
}

function confirmAgentI18nCustom() {
    if (!agentI18nConfig) return;
    const langs = agentI18nConfig.languages || [];
    const nextCustom = {};
    langs.forEach(code => {
        const nameInput = document.getElementById(`agent-i18n-name-${code}`);
        const descInput = document.getElementById(`agent-i18n-desc-${code}`);
        const welcomeInput = document.getElementById(`agent-i18n-welcome-${code}`);
        nextCustom[code] = {
            name: nameInput ? nameInput.value : '',
            description: descInput ? descInput.value : '',
            welcomeMsg: welcomeInput ? welcomeInput.value : ''
        };
    });
    agentI18nConfig.customInfo = nextCustom;
    closeModal('agent-i18n-custom-modal');
    saveAgentConfig(true);
}

function toggleThemeFeature(type, save = true) {
     if (type === 'background') {
        const check = document.getElementById('background-check');
        const section = document.getElementById('background-settings-section');
        if (check && section) {
            const enabled = check.checked;
            if (enabled) {
                section.classList.remove('hidden');
                applyBackgroundToPreview();
            } else {
                section.classList.add('hidden');
                clearBackgroundFromPreview();
            }
            themeConfig.background.enabled = enabled;
        }
    } else if (type === 'bg-scope-chat' || type === 'bg-scope-global') {
        themeConfig.background.scope = type === 'bg-scope-chat' ? 'chat' : 'global';
        applyBackgroundToPreview();
    }
    
    if (save) saveAgentConfig(true);
}

function updateThemeColor(color) {
    themeConfig.themeColor = color;
    const preview = document.getElementById('theme-color-preview');
    if (preview) preview.style.backgroundColor = color;
    saveAgentConfig(true);
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
    
    // Limit check (Welcome: 8, Response: 5 as per standard UI practice, though UI text says 1-8 for welcome)
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

// --- Background Settings Logic ---

function handleBackgroundUpload(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('仅支持 JPG, PNG, WEBP 格式', 'error');
        input.value = '';
        return;
    }
    
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过 2MB', 'error');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        themeConfig.background.image = dataUrl;
        updateBackgroundPreview(dataUrl);
        applyBackgroundToPreview();
        saveAgentConfig(true);
    };
    reader.readAsDataURL(file);
}

function updateBackgroundPreview(url) {
    const previewEl = document.getElementById('bg-image-preview');
    const placeholder = document.getElementById('bg-upload-placeholder');
    const imageContainer = document.getElementById('bg-preview-container');
    
    if (url) {
        if (placeholder) placeholder.classList.add('hidden');
        if (imageContainer) imageContainer.classList.remove('hidden');
        if (previewEl) previewEl.src = url;
    } else {
        if (placeholder) placeholder.classList.remove('hidden');
        if (imageContainer) imageContainer.classList.add('hidden');
        if (previewEl) previewEl.src = '';
    }
}

function removeBackground() {
    themeConfig.background.image = null;
    document.getElementById('bg-upload-input').value = '';
    updateBackgroundPreview(null);
    applyBackgroundToPreview();
    saveAgentConfig(true);
}

function updateBackgroundOpacity(value) {
    themeConfig.background.opacity = parseInt(value);
    const label = document.getElementById('bg-opacity-value');
    if (label) label.textContent = `${value}%`;
    applyBackgroundToPreview();
    saveAgentConfig(true); // Maybe debounce this in real app
}

function applyBackgroundToPreview() {
    // Apply to editor preview
    const previewContainer = document.getElementById('preview-chat-container');
    const previewWrapper = previewContainer ? previewContainer.parentElement : null;
    
    if (!previewContainer || !themeConfig.background.enabled || !themeConfig.background.image) {
        clearBackgroundFromPreview();
        return;
    }

    const { image, scope, opacity } = themeConfig.background;
    const styleString = `url('${image}')`;
    const opacityVal = opacity / 100;
    
    // Reset first
    if (previewWrapper) previewWrapper.style.backgroundImage = 'none';
    previewContainer.style.backgroundImage = 'none';
    previewContainer.style.backgroundColor = ''; // clear any bg color override if needed
    
    // Apply
    if (scope === 'global') {
        if (previewWrapper) {
            previewWrapper.style.backgroundImage = styleString;
            previewWrapper.style.backgroundSize = 'cover';
            previewWrapper.style.backgroundPosition = 'center';
            previewWrapper.style.position = 'relative';
            // Opacity is tricky for background image only without affecting content. 
            // Usually requires a pseudo-element overlay. 
            // For simplicity here, we might just set opacity on a pseudo element? 
            // Or use a background-color with alpha if it was color.
            // Since it's an image, standard CSS 'opacity' property affects content too.
            // Best practice is pseudo element.
            // Let's assume for this preview we use a simple approach: 
            // We can't easily do opacity on bg image only via JS inline styles without structure change.
            // Alternative: Use a before element class, but we are using inline styles for dynamic image.
            // Let's skip strict opacity visual in Editor Preview for now OR simply not support opacity perfectly in preview 
            // UNLESS we inject a style tag.
            // Actually, we can use linear-gradient hack for opacity:
            // linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url(...)
            
            const overlayAlpha = 1 - opacityVal;
            const overlayColor = `rgba(255, 255, 255, ${overlayAlpha})`;
            previewWrapper.style.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), ${styleString}`;
        }
    } else {
        // Chat scope
        const overlayAlpha = 1 - opacityVal;
        const overlayColor = `rgba(255, 255, 255, ${overlayAlpha})`;
        previewContainer.style.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), ${styleString}`;
        previewContainer.style.backgroundSize = 'cover';
        previewContainer.style.backgroundPosition = 'center';
        previewContainer.style.backgroundAttachment = 'local'; // Scrolls with content
    }
}

function clearBackgroundFromPreview() {
    const previewContainer = document.getElementById('preview-chat-container');
    const previewWrapper = previewContainer ? previewContainer.parentElement : null;
    
    if (previewContainer) previewContainer.style.backgroundImage = '';
    if (previewWrapper) previewWrapper.style.backgroundImage = '';
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
window.handleBackgroundUpload = handleBackgroundUpload;
window.removeBackground = removeBackground;
window.updateBackgroundOpacity = updateBackgroundOpacity;
window.updateThemeColor = updateThemeColor;
window.toggleThemeFeature = toggleThemeFeature;
window.initAgentI18nConfig = initAgentI18nConfig;
window.toggleAgentI18n = toggleAgentI18n;
window.openAgentI18nModalFromDisplay = openAgentI18nModalFromDisplay;
window.openAgentI18nCustomModal = openAgentI18nCustomModal;
window.confirmAgentI18nSelection = confirmAgentI18nSelection;
window.confirmAgentI18nCustom = confirmAgentI18nCustom;
window.cancelAgentI18nSelection = cancelAgentI18nSelection;

// --- Feedback Logic ---

let currentDislikeLogId = null;
let currentDislikeMsgId = null;

function toggleLike(logId, msgId) {
    const log = logsData.find(l => l.id === logId);
    if (!log) return;
    
    const msg = log.content.find(m => m.id === msgId);
    if (!msg) return;

    if (msg.userAction === 'like') {
        // Cancel Like
        msg.userAction = null;
        msg.likeCount--;
    } else {
        // Like (and cancel dislike if exists)
        if (msg.userAction === 'dislike') {
            msg.dislikeCount--;
            msg.dislikeReason = null; // Clear reason
        }
        msg.userAction = 'like';
        msg.likeCount++;
    }
    
    // Re-render
    openLogDetailModal(logId);
    showToast('操作成功');
}

function openDislikeModal(logId, msgId) {
    const log = logsData.find(l => l.id === logId);
    if (!log) return;
    
    const msg = log.content.find(m => m.id === msgId);
    if (!msg) return;

    // If already disliked, we might want to just cancel it or edit reason?
    // Let's assume clicking again cancels it for simplicity, OR opens modal to edit.
    // If we want to toggle:
    if (msg.userAction === 'dislike') {
        msg.userAction = null;
        msg.dislikeCount--;
        msg.dislikeReason = null; // Clear reason
        openLogDetailModal(logId);
        showToast('已取消点踩');
        return;
    }

    currentDislikeLogId = logId;
    currentDislikeMsgId = msgId;
    
    // Reset Modal
    const radios = document.getElementsByName('dislike-reason');
    radios.forEach(r => r.checked = false);
    document.getElementById('dislike-reason-custom').value = '';
    document.getElementById('dislike-reason-custom').classList.add('hidden');
    
    openModal('dislike-reason-modal');
}

function confirmDislike() {
    if (!currentDislikeLogId || !currentDislikeMsgId) return;

    const radios = document.getElementsByName('dislike-reason');
    let selectedReason = null;
    for (const r of radios) {
        if (r.checked) {
            selectedReason = r.value;
            break;
        }
    }
    
    if (!selectedReason) {
        showToast('请选择原因', 'warning');
        return;
    }
    
    if (selectedReason === 'other') {
        const customReason = document.getElementById('dislike-reason-custom').value.trim();
        if (!customReason) {
            showToast('请输入具体原因', 'warning');
            return;
        }
        selectedReason = customReason;
    }
    
    // Update Data
    const log = logsData.find(l => l.id === currentDislikeLogId);
    if (log) {
        const msg = log.content.find(m => m.id === currentDislikeMsgId);
        if (msg) {
            if (msg.userAction === 'like') {
                msg.likeCount--;
            }
            msg.userAction = 'dislike';
            msg.dislikeCount++;
            msg.dislikeReason = selectedReason;
        }
    }
    
    closeModal('dislike-reason-modal');
    openLogDetailModal(currentDislikeLogId);
    showToast('反馈已提交');
    
    currentDislikeLogId = null;
    currentDislikeMsgId = null;
}

// Bind radio change for custom reason visibility
document.addEventListener('change', (e) => {
    if (e.target.name === 'dislike-reason') {
        const customInput = document.getElementById('dislike-reason-custom');
        if (customInput) {
            if (e.target.value === 'other') {
                customInput.classList.remove('hidden');
            } else {
                customInput.classList.add('hidden');
            }
        }
    }
});

// Expose functions
window.toggleLike = toggleLike;
window.openDislikeModal = openDislikeModal;
window.confirmDislike = confirmDislike;
