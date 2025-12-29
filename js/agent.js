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
    
    // If it's a question input, we might need to trigger the onchange handler manually if it doesn't fire automatically
    // But onchange fires on blur usually. The dispatchEvent('input') handles listeners bound to input.
    // For the questions list, onchange="updateQuestion..." is used. We might need to trigger change event.
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
}
window.insertVariable = insertVariable;

// Agent Management Logic with Persistence

// Version Control for Data Templates
const DATA_VERSION = '1.0';

// Default Agent Templates (10 Representative Scenarios)
const DEFAULT_AGENTS = [
    {
        id: 'AGT-TEMPLATE-001',
        name: '电商客服助手',
        model: 'GPT-4o',
        avatar: 'fa-headset',
        color: 'bg-blue-100 text-blue-600',
        description: '专业的电商客服，负责处理用户咨询、售后服务和订单查询。能够礼貌、耐心地回答客户问题，并根据上下文推荐相关商品。',
        prompt: '你是一名专业的电商客服专员。你的职责是回答客户关于商品、订单和售后的问题。请保持礼貌、耐心，并使用亲切的语气。如果客户遇到问题，请先安抚情绪，然后提供具体的解决方案。',
        knowledge: ['产品文档库', '售后服务规范'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '您好！我是您的专属客服助手，请问有什么可以帮您？',
            welcomeQuestions: { enabled: true, list: ['查询订单状态', '如何申请退款', '查看最新优惠'] },
            responseQuestions: { enabled: true, list: [] }
        }
    },
    {
        id: 'AGT-TEMPLATE-002',
        name: 'Python 代码审查员',
        model: 'Claude 3.5 Sonnet',
        avatar: 'fa-code',
        color: 'bg-green-100 text-green-600',
        description: '资深 Python 工程师，专注于代码质量审查、Bug 修复和性能优化建议。能够识别潜在的逻辑错误并提供重构建议。',
        prompt: '你是一名拥有10年经验的 Python 资深工程师。请帮我审查代码，重点关注：1. 代码可读性与规范（PEP 8）；2. 潜在的 Bug 和逻辑错误；3. 性能优化空间；4. 安全性问题。请给出具体的修改建议和示例代码。',
        knowledge: ['技术规范'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 100000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '你好，请粘贴你需要审查的 Python 代码。',
            welcomeQuestions: { enabled: false, list: [] },
            responseQuestions: { enabled: true, list: ['解释这段代码的原理', '如何优化这段代码的性能', '生成对应的单元测试'] }
        }
    },
    {
        id: 'AGT-TEMPLATE-003',
        name: '英文翻译专家',
        model: 'GPT-4 Turbo',
        avatar: 'fa-language',
        color: 'bg-purple-100 text-purple-600',
        description: '精通中英文互译，擅长商务信函、技术文档和文学作品的翻译。追求信、达、雅的翻译境界。',
        prompt: '你是一名专业的翻译专家，精通中文和英文。请将用户输入的文本翻译成目标语言。翻译时请注意语境、专业术语的准确性以及表达的地道性。如果是商务场景，请保持正式语气；如果是日常对话，请保持自然。',
        knowledge: [],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 200000,
        updatedAt: new Date().toLocaleString(),
        status: 'stopped',
        experience: {
            welcomeMsg: 'Hello! I can help you translate between Chinese and English.',
            welcomeQuestions: { enabled: true, list: ['翻译商务邮件', '翻译技术文档', '润色英文简历'] },
            responseQuestions: { enabled: false, list: [] }
        }
    },
    {
        id: 'AGT-TEMPLATE-004',
        name: 'SQL 查询生成器',
        model: 'DeepSeek V2',
        avatar: 'fa-database',
        color: 'bg-orange-100 text-orange-600',
        description: '根据自然语言描述自动生成复杂的 SQL 查询语句，支持 MySQL、PostgreSQL 等多种数据库方言。',
        prompt: '你是一个 SQL 专家。请根据用户的自然语言描述，生成正确的 SQL 查询语句。默认使用 standard SQL，如果用户指定了数据库类型（如 MySQL, PostgreSQL），请适配相应的语法。请解释生成的 SQL 语句的逻辑。',
        knowledge: ['技术规范'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 300000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '请描述你想查询的数据，我来帮你写 SQL。',
            welcomeQuestions: { enabled: false, list: [] },
            responseQuestions: { enabled: true, list: ['优化这条 SQL', '解释执行计划', '添加索引建议'] }
        }
    },
    {
        id: 'AGT-TEMPLATE-005',
        name: '周报自动生成助手',
        model: 'GPT-4o',
        avatar: 'fa-file-lines',
        color: 'bg-teal-100 text-teal-600',
        description: '根据用户提供的工作碎片和数据，自动整理生成结构清晰、重点突出的工作周报。',
        prompt: '你是一个职场写作助手。请根据用户提供的本周工作内容、数据和下周计划，整理出一份结构清晰、重点突出的周报。周报结构应包含：1. 本周工作总结（Highlight）；2. 详细工作内容；3. 数据指标；4. 遇到的问题与解决方案；5. 下周工作计划。',
        knowledge: ['员工手册'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 400000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '辛苦了一周！请告诉我这周都做了什么，我帮你写周报。',
            welcomeQuestions: { enabled: true, list: ['生成研发周报', '生成销售周报', '润色已有周报'] },
            responseQuestions: { enabled: false, list: [] }
        }
    },
    {
        id: 'AGT-TEMPLATE-006',
        name: '产品文案润色',
        model: 'Claude 3.5 Sonnet',
        avatar: 'fa-pen-nib',
        color: 'bg-pink-100 text-pink-600',
        description: '擅长市场营销文案的润色和优化，能够提升文案的吸引力和转化率。',
        prompt: '你是一名资深的文案策划。请帮我润色以下产品文案，使其更具吸引力，更能打动用户。请注意使用情感化设计语言，突出产品痛点和解决方案。',
        knowledge: ['市场分析报告'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 500000,
        updatedAt: new Date().toLocaleString(),
        status: 'stopped',
        experience: {
            welcomeMsg: '请提供原始文案，我来帮你点石成金。',
            welcomeQuestions: { enabled: false, list: [] },
            responseQuestions: { enabled: true, list: ['提供更活泼的版本', '提供更专业的版本', '提取宣传Slogan'] }
        }
    },
    {
        id: 'AGT-TEMPLATE-007',
        name: '旅游行程规划师',
        model: 'GPT-4 Turbo',
        avatar: 'fa-plane',
        color: 'bg-cyan-100 text-cyan-600',
        description: '根据用户的预算、时间和兴趣，定制个性化的旅游行程安排。',
        prompt: '你是一名专业的旅游规划师。请根据用户的目的地、旅行时间、预算和兴趣偏好（如人文、自然、美食），规划一份详细的每日行程。行程应包含景点推荐、交通建议、住宿建议和美食推荐。',
        knowledge: [],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 600000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '想去哪里旅行？告诉我你的计划，我来帮你安排。',
            welcomeQuestions: { enabled: true, list: ['规划日本七日游', '推荐国内小众景点', '制定亲子游攻略'] },
            responseQuestions: { enabled: false, list: [] }
        }
    },
    {
        id: 'AGT-TEMPLATE-008',
        name: '法律咨询顾问',
        model: 'DeepSeek V2',
        avatar: 'fa-scale-balanced',
        color: 'bg-red-100 text-red-600',
        description: '提供基础的法律咨询服务，解读法律条文，草拟简单的法律文书。',
        prompt: '你是一名法律顾问助手。请根据用户描述的法律问题，提供相关的法律法规解读和建议。请注意，你的回答仅供参考，不构成正式的法律意见。在涉及复杂案件时，请建议用户咨询专业律师。',
        knowledge: [],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 700000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '您好，请简述您遇到的法律问题。',
            welcomeQuestions: { enabled: true, list: ['劳动合同纠纷咨询', '知识产权保护咨询', '拟定房屋租赁合同'] },
            responseQuestions: { enabled: true, list: ['查看相关法律条文', '生成法律函件模板'] }
        }
    },
    {
        id: 'AGT-TEMPLATE-009',
        name: '数据分析报告生成',
        model: 'GPT-4o',
        avatar: 'fa-chart-line',
        color: 'bg-indigo-100 text-indigo-600',
        description: '根据输入的数据集或描述，自动进行数据分析并生成洞察报告。',
        prompt: '你是一名数据分析师。请根据用户提供的数据（或数据描述），进行深入分析。请找出数据中的趋势、异常值和相关性，并生成一份包含图表建议和业务洞察的分析报告。',
        knowledge: ['市场分析报告'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 800000,
        updatedAt: new Date().toLocaleString(),
        status: 'stopped',
        experience: {
            welcomeMsg: '请提供您的数据，我来帮您挖掘价值。',
            welcomeQuestions: { enabled: false, list: [] },
            responseQuestions: { enabled: true, list: ['解释数据波动原因', '预测未来趋势', '生成汇报PPT大纲'] }
        }
    },
    {
        id: 'AGT-TEMPLATE-010',
        name: 'API 文档自动生成',
        model: 'Claude 3.5 Sonnet',
        avatar: 'fa-file-code',
        color: 'bg-yellow-100 text-yellow-600',
        description: '根据代码或简要描述，自动生成符合 OpenAPI 规范的 API 接口文档。',
        prompt: '你是一名技术文档工程师。请根据用户提供的代码片段（如 Controller 层代码）或接口描述，自动生成标准的 OpenAPI (Swagger) 格式文档。文档应包含接口路径、请求方法、请求参数、响应结构和示例。',
        knowledge: ['技术规范'],
        creator: 'System',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now() - 900000,
        updatedAt: new Date().toLocaleString(),
        status: 'running',
        experience: {
            welcomeMsg: '请粘贴接口代码，我来生成文档。',
            welcomeQuestions: { enabled: true, list: ['生成 RESTful API 文档', '生成 GraphQL Schema', '检查接口规范性'] },
            responseQuestions: { enabled: false, list: [] }
        }
    }
];

let agentsData = [];
let currentPage = 1;
const pageSize = 10;
let isLoading = false;
let hasMore = true;
let currentSearch = '';
let currentFilter = 'all';

// --- Data Persistence Layer ---

function loadAgentsFromStorage() {
    try {
        const storedData = localStorage.getItem('agentsData');
        const storedVersion = localStorage.getItem('agentDataVersion');

        if (!storedData || storedVersion !== DATA_VERSION) {
            console.log('Initializing default agent data...');
            // Initialize with default templates
            const initialData = JSON.parse(JSON.stringify(DEFAULT_AGENTS));
            saveAgentsToStorage(initialData);
            return initialData;
        }

        let data = JSON.parse(storedData);
        
        // Migration: Ensure avatar and color exist and diversify defaults
        const AVATAR_OPTIONS = ['fa-robot', 'fa-brain', 'fa-wand-magic-sparkles', 'fa-bolt', 'fa-comment-dots', 'fa-lightbulb', 'fa-code', 'fa-pen-nib', 'fa-plane', 'fa-scale-balanced', 'fa-chart-line', 'fa-file-code', 'fa-language', 'fa-shield-halved', 'fa-file-lines', 'fa-database'];
        const COLOR_OPTIONS = [
            'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 
            'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600', 
            'bg-teal-100 text-teal-600', 'bg-pink-100 text-pink-600',
            'bg-indigo-100 text-indigo-600', 'bg-cyan-100 text-cyan-600',
            'bg-red-100 text-red-600', 'bg-yellow-100 text-yellow-600'
        ];

        data = data.map((agent, index) => {
            let avatar = agent.avatar || 'fa-robot';
            let color = agent.color || 'bg-blue-100 text-blue-600';

            // If still using generic defaults, try to diversify based on ID/Index
            if (avatar === 'fa-robot' && color === 'bg-blue-100 text-blue-600') {
                 const seed = (agent.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
                 avatar = AVATAR_OPTIONS[seed % AVATAR_OPTIONS.length];
                 color = COLOR_OPTIONS[seed % COLOR_OPTIONS.length];
            }

            return {
                ...agent,
                avatar: avatar,
                color: color
            };
        });
        
        return data;
    } catch (e) {
        console.error('Failed to load agents from storage:', e);
        return JSON.parse(JSON.stringify(DEFAULT_AGENTS)); // Fallback
    }
}

function saveAgentsToStorage(data) {
    try {
        localStorage.setItem('agentsData', JSON.stringify(data));
        localStorage.setItem('agentDataVersion', DATA_VERSION);
        // Also update memory
        agentsData = data;
    } catch (e) {
        console.error('Failed to save agents to storage:', e);
        showToast('本地存储空间不足，数据保存失败', 'error');
    }
}

// Initialize
function initAgentPage() {
    console.log('Initializing Agent Page...');
    
    // Show loading state initially if needed
    const loader = document.getElementById('agent-list-loader');
    if (loader) loader.classList.remove('hidden');

    // Simulate async initialization for better UX perception
    setTimeout(() => {
        // Load data from storage
        agentsData = loadAgentsFromStorage();
        
        // Reset view state
        currentPage = 1;
        hasMore = true; // Simple logic: always true initially if we have data, pagination handles end
        isLoading = false;
        currentSearch = ''; 
        currentFilter = 'all';

        // Render initial list
        renderAgentList(true);
        updateStats();
        
        if (loader) loader.classList.add('hidden');
        
        // Show welcome toast if it was a fresh init (detected by checking if we just saved defaults)
        // For simplicity, just log it.
        console.log(`Loaded ${agentsData.length} agents.`);
    }, 500);
    
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
    if (!hasMore || isLoading) return;

    isLoading = true;
    const loader = document.getElementById('agent-list-loader');
    if (loader) loader.classList.remove('hidden');

    // Simulate network delay for realistic feel
    setTimeout(() => {
        const allFiltered = getFilteredAgents();
        const total = allFiltered.length;
        const currentDisplayed = currentPage * pageSize;
        
        if (currentDisplayed >= total) {
            hasMore = false;
            isLoading = false;
            if (loader) loader.classList.add('hidden');
            return;
        }

        currentPage++;
        renderAgentList(false); // Append
        
        isLoading = false;
        if (loader) loader.classList.add('hidden');
    }, 500);
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
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => editAgent(id)
        },
        {
            label: '配置权限',
            icon: 'fa-solid fa-user-lock',
            onClick: () => openPermissionConfig(id)
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

    // Randomize avatar and color
    const avatars = ['fa-robot', 'fa-brain', 'fa-wand-magic-sparkles', 'fa-bolt', 'fa-comment-dots', 'fa-lightbulb'];
    const colors = [
        'bg-blue-100 text-blue-600', 
        'bg-green-100 text-green-600', 
        'bg-purple-100 text-purple-600', 
        'bg-orange-100 text-orange-600', 
        'bg-teal-100 text-teal-600',
        'bg-pink-100 text-pink-600'
    ];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newAgent = {
        id: window.generateId ? window.generateId('AGT') : `AGT-${Date.now()}`,
        name: nameInput.value,
        model: modelInput.value,
        description: descInput.value,
        prompt: descInput.value, // Use description as initial prompt
        avatar: randomAvatar,
        color: randomColor,
        hot: 0,
        status: 'running',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        updatedAt: new Date().toLocaleString(),
        // Initialize empty experience config for new agent
        experience: {
            welcomeMsg: '',
            welcomeQuestions: { enabled: false, list: [] },
            responseQuestions: { enabled: false, list: [] }
        }
    };

    agentsData.unshift(newAgent); // Add to top
    saveAgentsToStorage(agentsData); // Persist changes
    
    closeModal('create-agent-modal');
    
    // Clear inputs
    nameInput.value = '';
    descInput.value = '';
    
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
        saveAgentsToStorage(agentsData); // Persist changes
        
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
            saveAgentsToStorage(agentsData); // Persist changes
            renderAgentList(false);
        }
    }
}

function confirmStopAgent() {
    if (agentToStopId) {
        const agent = agentsData.find(a => a.id === agentToStopId);
        if (agent) {
            agent.status = 'stopped';
            saveAgentsToStorage(agentsData); // Persist changes
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

// --- Permission Management Logic ---
let currentConfigAgentId = null;
let currentPermissions = []; // Array of { userId, role }
let permissionHistory = []; // Stack for undo
let permPagination = { page: 1, pageSize: 20 };
let permSelectedRows = new Set(); // For batch delete
let permSearchDebounceTimer = null;

function openPermissionConfig(id) {
    currentConfigAgentId = id;
    const agent = agentsData.find(a => a.id === id);
    if (!agent) return;
    
    // Reset State
    currentPermissions = agent.permissions ? JSON.parse(JSON.stringify(agent.permissions)) : [];
    permissionHistory = [];
    permPagination.page = 1;
    permSelectedRows.clear();
    
    // UI Setup
    const nameEl = document.getElementById('perm-agent-name');
    if (nameEl) nameEl.textContent = agent.name;
    
    // Reset Search & Inputs
    document.getElementById('perm-user-search').value = '';
    document.getElementById('perm-search-results').classList.add('hidden');
    document.getElementById('perm-dept-select').value = '';
    
    // Populate Departments
    const deptSelect = document.getElementById('perm-dept-select');
    if (deptSelect) {
        deptSelect.innerHTML = '<option value="">请选择部门...</option>';
        const depts = window.getAllDepartments ? window.getAllDepartments() : [];
        depts.forEach(d => {
            const option = document.createElement('option');
            option.value = d;
            option.textContent = d;
            deptSelect.appendChild(option);
        });
    }

    // Default to single add mode
    switchPermAddMode('single');
    
    renderPermissionList();
    openModal('permission-config-modal');
}

function switchPermAddMode(mode) {
    document.getElementById('perm-mode-single').classList.toggle('hidden', mode !== 'single');
    document.getElementById('perm-mode-single').classList.toggle('flex', mode === 'single');
    
    document.getElementById('perm-mode-dept').classList.toggle('hidden', mode !== 'dept');
    document.getElementById('perm-mode-dept').classList.toggle('flex', mode === 'dept');
    
    // Tab Styles
    const tabSingle = document.getElementById('perm-tab-single');
    const tabDept = document.getElementById('perm-tab-dept');
    
    const activeClass = ['bg-white', 'text-blue-600', 'shadow-sm'];
    const inactiveClass = ['text-gray-500', 'hover:text-gray-700'];
    
    if (mode === 'single') {
        tabSingle.classList.add(...activeClass);
        tabSingle.classList.remove(...inactiveClass);
        tabDept.classList.remove(...activeClass);
        tabDept.classList.add(...inactiveClass);
    } else {
        tabDept.classList.add(...activeClass);
        tabDept.classList.remove(...inactiveClass);
        tabSingle.classList.remove(...activeClass);
        tabSingle.classList.add(...inactiveClass);
    }
}

function debounceSearchUser(query) {
    clearTimeout(permSearchDebounceTimer);
    permSearchDebounceTimer = setTimeout(() => {
        performUserSearch(query);
    }, 300);
}

function performUserSearch(query) {
    const resultsContainer = document.getElementById('perm-search-results');
    if (!query.trim()) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    const users = window.getAllUsers ? window.getAllUsers() : [];
    const lowerQuery = query.toLowerCase();
    
    // Filter users not already added and matching query
    const matches = users.filter(u => {
        const isAdded = currentPermissions.some(p => p.userId == u.id);
        const matchesQuery = u.name.toLowerCase().includes(lowerQuery) || 
                           u.phone.includes(lowerQuery) || 
                           u.email.toLowerCase().includes(lowerQuery);
        return !isAdded && matchesQuery;
    }).slice(0, 10); // Limit results
    
    resultsContainer.innerHTML = '';
    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="px-4 py-2 text-xs text-gray-500">无匹配用户</div>';
    } else {
        matches.forEach(u => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm flex justify-between items-center border-b border-gray-50 last:border-0';
            div.innerHTML = `
                <div>
                    <div class="font-medium text-gray-900">${u.name}</div>
                    <div class="text-xs text-gray-500">${u.department || '无部门'} · ${u.email}</div>
                </div>
                <i class="fa-solid fa-plus text-gray-300"></i>
            `;
            div.onclick = () => selectUserForAdd(u);
            resultsContainer.appendChild(div);
        });
    }
    resultsContainer.classList.remove('hidden');
}

function selectUserForAdd(user) {
    const searchInput = document.getElementById('perm-user-search');
    searchInput.value = user.name;
    searchInput.dataset.selectedUserId = user.id;
    document.getElementById('perm-search-results').classList.add('hidden');
}

function saveSnapshot() {
    permissionHistory.push(JSON.parse(JSON.stringify(currentPermissions)));
    // Limit history stack size if needed
    if (permissionHistory.length > 20) permissionHistory.shift();
    updateUndoButton();
}

function updateUndoButton() {
    const btn = document.getElementById('perm-undo-btn');
    if (btn) {
        if (permissionHistory.length > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
}

function undoLastAction() {
    if (permissionHistory.length === 0) return;
    currentPermissions = permissionHistory.pop();
    updateUndoButton();
    renderPermissionList();
    autoSavePermissions(); // Save the reverted state
    showToast('已撤销上一步操作', 'success');
}

function addPermission() {
    const searchInput = document.getElementById('perm-user-search');
    const userId = searchInput.dataset.selectedUserId;
    const roleSelect = document.getElementById('perm-role-select-single');
    
    if (!userId) {
        // Try to find exact match by name if ID missing (edge case)
        showToast('请从下拉列表中选择用户', 'error'); // Or alert
        return;
    }
    
    saveSnapshot();
    
    const role = roleSelect.value;
    currentPermissions.push({ userId, role });
    
    // Reset Input
    searchInput.value = '';
    delete searchInput.dataset.selectedUserId;
    
    renderPermissionList();
    autoSavePermissions();
    showToast('用户添加成功', 'success');
}

function addDeptPermissions() {
    const deptSelect = document.getElementById('perm-dept-select');
    const roleSelect = document.getElementById('perm-role-select-dept');
    const dept = deptSelect.value;
    const role = roleSelect.value;
    
    if (!dept) {
        showToast('请选择部门', 'error');
        return;
    }
    
    saveSnapshot();
    
    const users = window.getAllUsers ? window.getAllUsers() : [];
    const deptUsers = users.filter(u => u.department === dept);
    
    let addedCount = 0;
    deptUsers.forEach(u => {
        if (!currentPermissions.some(p => p.userId == u.id)) {
            currentPermissions.push({ userId: u.id, role });
            addedCount++;
        }
    });
    
    if (addedCount > 0) {
        renderPermissionList();
        autoSavePermissions();
        showToast(`批量添加了 ${addedCount} 位用户`, 'success');
        // Reset
        deptSelect.value = '';
    } else {
        showToast('该部门用户均已在列表中', 'success'); // Not strictly an error
    }
}

function removePermission(index) {
    // Calculate actual index based on pagination
    const actualIndex = (permPagination.page - 1) * permPagination.pageSize + index;
    
    // Confirmation
    if(!confirm('确定要移除该用户的权限吗？')) return;
    
    saveSnapshot();
    currentPermissions.splice(actualIndex, 1);
    renderPermissionList();
    autoSavePermissions();
    showToast('权限已移除', 'success');
}

function batchRemovePermissions() {
    if (permSelectedRows.size === 0) return;
    
    if (!confirm(`确定要移除选中的 ${permSelectedRows.size} 位用户吗？`)) return;
    
    saveSnapshot();
    
    currentPermissions = currentPermissions.filter(p => !permSelectedRows.has(String(p.userId))); // Ensure type match
    permSelectedRows.clear();
    document.getElementById('perm-check-all').checked = false;
    
    renderPermissionList();
    autoSavePermissions();
    showToast('批量移除成功', 'success');
}

function updatePermissionRole(userId, newRole) {
    const perm = currentPermissions.find(p => p.userId == userId);
    if (perm && perm.role !== newRole) {
        saveSnapshot();
        perm.role = newRole;
        // No full re-render needed, just save
        autoSavePermissions();
        showToast('权限已更新', 'success');
    }
}

function autoSavePermissions() {
    if (currentConfigAgentId) {
        const agent = agentsData.find(a => a.id === currentConfigAgentId);
        if (agent) {
            agent.permissions = currentPermissions;
            saveAgentsToStorage(agentsData);
            
            // Show auto-save indicator
            const indicator = document.getElementById('perm-auto-save-indicator');
            if (indicator) {
                indicator.classList.remove('hidden');
                setTimeout(() => {
                    indicator.classList.add('hidden');
                }, 2000);
            }
        }
    }
}

function changePermPage(delta) {
    const maxPage = Math.ceil(currentPermissions.length / permPagination.pageSize) || 1;
    const newPage = permPagination.page + delta;
    
    if (newPage >= 1 && newPage <= maxPage) {
        permPagination.page = newPage;
        renderPermissionList();
    }
}

function togglePermCheckAll(checkbox) {
    const displayedPerms = getPaginatedPermissions();
    if (checkbox.checked) {
        displayedPerms.forEach(p => permSelectedRows.add(String(p.userId)));
    } else {
        displayedPerms.forEach(p => permSelectedRows.delete(String(p.userId)));
    }
    renderPermissionList();
}

function togglePermRowCheck(userId, checkbox) {
    if (checkbox.checked) {
        permSelectedRows.add(String(userId));
    } else {
        permSelectedRows.delete(String(userId));
    }
    // Update batch delete button visibility
    updateBatchActions();
}

function updateBatchActions() {
    const batchBtn = document.getElementById('perm-batch-del-btn');
    if (batchBtn) {
        if (permSelectedRows.size > 0) {
            batchBtn.classList.remove('hidden');
        } else {
            batchBtn.classList.add('hidden');
        }
    }
}

function getPaginatedPermissions() {
    const start = (permPagination.page - 1) * permPagination.pageSize;
    const end = start + permPagination.pageSize;
    return currentPermissions.slice(start, end);
}

function renderPermissionList() {
    const tbody = document.getElementById('perm-list-body');
    const emptyState = document.getElementById('perm-empty-state');
    const paginationEl = document.getElementById('perm-pagination');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const total = currentPermissions.length;
    document.getElementById('perm-total-count').textContent = total;
    
    if (total === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationEl) paginationEl.classList.add('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (paginationEl) paginationEl.classList.remove('hidden');
        
        // Pagination Logic
        const maxPage = Math.ceil(total / permPagination.pageSize) || 1;
        if (permPagination.page > maxPage) permPagination.page = maxPage;
        
        const pagePerms = getPaginatedPermissions();
        const users = window.getAllUsers ? window.getAllUsers() : [];
        
        // Update Pagination UI
        document.getElementById('perm-page-start').textContent = (permPagination.page - 1) * permPagination.pageSize + 1;
        document.getElementById('perm-page-end').textContent = Math.min(permPagination.page * permPagination.pageSize, total);
        document.getElementById('perm-page-total').textContent = total;
        document.getElementById('perm-prev-btn').disabled = permPagination.page === 1;
        document.getElementById('perm-next-btn').disabled = permPagination.page === maxPage;
        
        pagePerms.forEach((perm, index) => { // Index here is relative to page
            const user = users.find(u => u.id == perm.userId) || { name: `Unknown (${perm.userId})`, department: '-' };
            const isChecked = permSelectedRows.has(String(perm.userId));
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 group transition-colors";
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <input type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                        ${isChecked ? 'checked' : ''} 
                        onchange="togglePermRowCheck('${perm.userId}', this)">
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-medium text-gray-900">${user.name}</div>
                            <div class="text-xs text-gray-500">${user.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-gray-600">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                        ${user.department || '无部门'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <select onchange="updatePermissionRole('${perm.userId}', this.value)" 
                        class="text-xs border-none bg-transparent focus:ring-0 cursor-pointer font-medium ${
                            perm.role === 'manage' ? 'text-purple-700' : 
                            perm.role === 'edit' ? 'text-blue-700' : 'text-gray-700'
                        }">
                        <option value="view" ${perm.role === 'view' ? 'selected' : ''}>可查看</option>
                        <option value="edit" ${perm.role === 'edit' ? 'selected' : ''}>可编辑</option>
                        <option value="manage" ${perm.role === 'manage' ? 'selected' : ''}>可管理</option>
                    </select>
                </td>
                <td class="px-4 py-3 text-right">
                    <button onclick="removePermission(${index})" class="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    updateBatchActions();
}

// Expose Permission Functions
window.openPermissionConfig = openPermissionConfig;
window.addPermission = addPermission;
window.addDeptPermissions = addDeptPermissions;
window.removePermission = removePermission;
window.batchRemovePermissions = batchRemovePermissions;
window.updatePermissionRole = updatePermissionRole;
window.undoLastAction = undoLastAction;
window.switchPermAddMode = switchPermAddMode;
window.debounceSearchUser = debounceSearchUser;
window.selectUserForAdd = selectUserForAdd;
window.changePermPage = changePermPage;
window.togglePermCheckAll = togglePermCheckAll;
window.togglePermRowCheck = togglePermRowCheck;

// --- Agent Editor Logic ---

let currentEditorAgentId = null;
let experienceConfig = {};
let themeConfig = {};

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
            
            // Sync Experience Config from DOM
            const welcomeMsgInput = document.getElementById('welcome-msg-input');
            if (welcomeMsgInput) {
                experienceConfig.welcomeMsg = welcomeMsgInput.value;
            }

            // Save experience config
            agent.experience = JSON.parse(JSON.stringify(experienceConfig));
            agent.theme = JSON.parse(JSON.stringify(themeConfig));
            
            // Persist changes
            saveAgentsToStorage(agentsData);
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