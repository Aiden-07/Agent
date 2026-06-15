// State for Providers
let providersData = [];
let currentProviderPage = 1;
const PROVIDERS_PER_PAGE = 20;
let editProviderId = null;

// Mock Data Initializer for Providers
function generateMockProviders() {
    return Array.from({ length: 35 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: i === 0 ? 'OpenAI' : i === 1 ? 'Azure' : `服务商 ${i + 1}`,
        type: i === 0 ? 'OpenAI' : i === 1 ? 'Azure' : '自定义',
        modelCount: Math.floor(Math.random() * 10) + 1,
        apiKey: `sk-${Math.random().toString(36).substr(2, 16)}`,
        apiUrl: 'https://api.example.com/v1',
        status: i % 3 === 0 ? 'stopped' : 'running'
    }));
}

// State for Models
let currentProviderForModels = null;
let modelsData = {}; // keyed by provider id
let currentModelPage = 1;
const MODELS_PER_PAGE = 20;
let editModelId = null;

// Mock Data Initializer for Models
function generateMockModels(providerId) {
    const caps = ['vision', 'web_search', 'embedding', 'reasoning', 'tools'];
    return Array.from({ length: Math.floor(Math.random() * 25) + 5 }, (_, i) => {
        // Randomly pick 1-3 capabilities
        const shuffled = caps.sort(() => 0.5 - Math.random());
        const selectedCaps = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
        
        return {
            id: `m-${providerId}-${i + 1}`,
            providerId: providerId,
            name: `Model ${i + 1}`,
            type: i % 3 === 0 ? 'Embedding' : i % 4 === 0 ? 'Vision' : 'LLM',
            capabilities: selectedCaps,
            enabled: i % 5 !== 0
        };
    });
}

// --- Provider List Methods ---

window.initProviderList = async function() {
    if (providersData.length === 0) {
        providersData = generateMockProviders();
    }
    
    const loadingEl = document.getElementById('provider-skeleton');
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    // Simulate network delay for performance testing requirement
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const loadingEl2 = document.getElementById('provider-skeleton');
    if (loadingEl2) loadingEl2.classList.add('hidden');
    renderProviderTable();
}

function renderProviderTable() {
    const tbody = document.getElementById('provider-table-body');
    if (!tbody) return;
    
    const startIndex = (currentProviderPage - 1) * PROVIDERS_PER_PAGE;
    const endIndex = startIndex + PROVIDERS_PER_PAGE;
    const pageData = providersData.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">暂无数据</td></tr>';
    } else {
        pageData.forEach(provider => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-blue-50 transition-colors cursor-pointer group';
            // Click row to enter model list
            tr.onclick = (e) => {
                // Ignore clicks on action buttons
                if (e.target.closest('button') || e.target.closest('td:last-child')) return;
                openModelList(provider);
            };
            
            const maskedKey = '****************' + provider.apiKey.slice(-4);
            const statusClass = provider.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';
            const statusText = provider.status === 'running' ? '运行中' : '已停止';
            const toggleActionText = provider.status === 'running' ? '停止服务' : '启动服务';
            
            tr.innerHTML = `
                <td class="px-6 py-4">${provider.name}</td>
                <td class="px-6 py-4">${provider.modelCount}</td>
                <td class="px-6 py-4" title="${provider.apiKey}">${maskedKey}</td>
                <td class="px-6 py-4 truncate max-w-[200px]" title="${provider.apiUrl}">${provider.apiUrl}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-3">
                        <button onclick="toggleProviderStatus('${provider.id}', event)" class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">${toggleActionText}</button>
                        <button onclick="editProvider('${provider.id}', event)" class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">编辑</button>
                        <button onclick="confirmDeleteProvider('${provider.id}', event)" class="text-red-600 hover:text-red-800 text-sm font-medium transition-colors">删除</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    updateProviderPagination();
}

function updateProviderPagination() {
    const totalPages = Math.ceil(providersData.length / PROVIDERS_PER_PAGE);
    document.getElementById('provider-pagination-info').innerText = `共 ${providersData.length} 条数据，第 ${currentProviderPage}/${totalPages || 1} 页`;
    
    const prevBtn = document.getElementById('provider-prev-btn');
    const nextBtn = document.getElementById('provider-next-btn');
    if (prevBtn) prevBtn.disabled = currentProviderPage <= 1;
    if (nextBtn) nextBtn.disabled = currentProviderPage >= totalPages;
}

window.changeProviderPage = function(delta) {
    const totalPages = Math.ceil(providersData.length / PROVIDERS_PER_PAGE);
    currentProviderPage += delta;
    if (currentProviderPage < 1) currentProviderPage = 1;
    if (currentProviderPage > totalPages) currentProviderPage = totalPages;
    renderProviderTable();
};

window.toggleProviderStatus = async function(id, event) {
    if (event) event.stopPropagation();
    const provider = providersData.find(p => p.id === id);
    if (provider) {
        // Mock API Call
        showToast('处理中...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        provider.status = provider.status === 'running' ? 'stopped' : 'running';
        showToast(`${provider.status === 'running' ? '已启动' : '已停止'}服务`);
        renderProviderTable();
    }
};

window.handleProviderTypeChange = function(selectEl) {
    const customInput = document.getElementById('provider-custom-type');
    if (selectEl.value === '自定义') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.value = '';
        clearError('provider-type');
    }
};

window.openProviderModal = function() {
    editProviderId = null;
    document.getElementById('provider-modal-title').innerText = '新增服务商';
    document.getElementById('provider-form').reset();
    
    // Reset custom type field
    const customInput = document.getElementById('provider-custom-type');
    if (customInput) {
        customInput.classList.add('hidden');
        customInput.value = '';
    }
    
    // Clear errors
    ['name', 'apikey', 'url', 'type'].forEach(field => {
        const errEl = document.getElementById(`provider-${field}-error`);
        if (errEl) errEl.classList.add('hidden');
        const inputEl = document.getElementById(`provider-${field}`);
        if (inputEl) inputEl.classList.remove('border-red-500');
    });
    
    document.getElementById('provider-modal').classList.remove('hidden');
};

window.editProvider = function(id, event) {
    if (event) event.stopPropagation();
    const provider = providersData.find(p => p.id === id);
    if (provider) {
        editProviderId = id;
        document.getElementById('provider-modal-title').innerText = '编辑服务商';
        
        document.getElementById('provider-name').value = provider.name;
        
        const typeSelect = document.getElementById('provider-type');
        const customInput = document.getElementById('provider-custom-type');
        
        // Check if the provider type is one of the standard options
        const standardOptions = ['OpenAI', 'Azure', '百度千帆', '阿里通义'];
        if (standardOptions.includes(provider.type)) {
            typeSelect.value = provider.type;
            if (customInput) {
                customInput.classList.add('hidden');
                customInput.value = '';
            }
        } else {
            typeSelect.value = '自定义';
            if (customInput) {
                customInput.classList.remove('hidden');
                customInput.value = provider.type;
            }
        }
        
        document.getElementById('provider-apikey').value = provider.apiKey;
        document.getElementById('provider-url').value = provider.apiUrl;
        
        ['name', 'apikey', 'url', 'type'].forEach(field => {
            const errEl = document.getElementById(`provider-${field}-error`);
            if (errEl) errEl.classList.add('hidden');
            const inputEl = document.getElementById(`provider-${field}`);
            if (inputEl) inputEl.classList.remove('border-red-500');
        });
        
        document.getElementById('provider-modal').classList.remove('hidden');
    }
};

window.saveProvider = async function() {
    const nameInput = document.getElementById('provider-name');
    const typeInput = document.getElementById('provider-type');
    const apiKeyInput = document.getElementById('provider-apikey');
    const urlInput = document.getElementById('provider-url');
    
    let isValid = true;
    
    // Validate Name
    const nameVal = nameInput.value.trim();
    if (!nameVal || nameVal.length > 50) {
        showError('provider-name', '服务商名称必填且1-50字符');
        isValid = false;
    } else {
        const duplicate = providersData.find(p => p.name === nameVal && p.id !== editProviderId);
        if (duplicate) {
            showError('provider-name', '服务商名称已存在');
            isValid = false;
        } else {
            clearError('provider-name');
        }
    }
    
    // Validate Custom Type
    let finalType = typeInput.value;
    if (finalType === '自定义') {
        const customInput = document.getElementById('provider-custom-type');
        const customVal = customInput.value;
        // Trim leading/trailing spaces for saving, but check if it's completely empty
        if (!customVal.trim()) {
            showError('provider-type', '自定义类型不能为空或全空格');
            isValid = false;
        } else if (/[<>"'&%]/.test(customVal)) {
            // Basic special character check for safety/requirements
            showError('provider-type', '自定义类型包含不支持的特殊符号');
            isValid = false;
        } else if (customVal.length > 200) {
            showError('provider-type', '自定义类型不能超过200字符');
            isValid = false;
        } else {
            clearError('provider-type');
            finalType = customVal.trim();
        }
    } else {
        clearError('provider-type');
    }
    
    // Validate API-KEY
    const keyVal = apiKeyInput.value.trim();
    if (!keyVal || keyVal.length > 128) {
        showError('provider-apikey', 'API-KEY必填且128字符以内');
        isValid = false;
    } else {
        clearError('provider-apikey');
    }
    
    // Validate URL
    const urlVal = urlInput.value.trim();
    const urlPattern = /^(https?:\/\/)/;
    if (!urlVal || !urlPattern.test(urlVal)) {
        showError('provider-url', 'API URL必填且必须是有效的http/https链接');
        isValid = false;
    } else {
        clearError('provider-url');
    }
    
    if (!isValid) return;
    
    // Loading State
    const btn = document.getElementById('provider-submit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中';
    btn.disabled = true;
    
    // Mock API Delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (editProviderId) {
        const provider = providersData.find(p => p.id === editProviderId);
        provider.name = nameVal;
        provider.type = finalType;
        provider.apiKey = keyVal;
        provider.apiUrl = urlVal;
        showToast('更新成功');
    } else {
        providersData.unshift({
            id: `p-${Date.now()}`,
            name: nameVal,
            type: finalType,
            apiKey: keyVal,
            apiUrl: urlVal,
            modelCount: 0,
            status: 'stopped'
        });
        showToast('新增成功');
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    closeModal('provider-modal');
    renderProviderTable();
};

let deleteTargetProviderId = null;
window.confirmDeleteProvider = function(id, event) {
    if (event) event.stopPropagation();
    const provider = providersData.find(p => p.id === id);
    if (provider) {
        deleteTargetProviderId = id;
        document.getElementById('provider-delete-msg').innerText = `确定删除服务商【${provider.name}】？关联的模型配置将同步删除。`;
        
        document.getElementById('provider-confirm-delete-btn').onclick = async () => {
            const btn = document.getElementById('provider-confirm-delete-btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>删除中';
            btn.disabled = true;
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            providersData = providersData.filter(p => p.id !== deleteTargetProviderId);
            showToast('删除成功');
            
            btn.innerHTML = '确定删除';
            btn.disabled = false;
            closeModal('provider-delete-modal');
            renderProviderTable();
        };
        
        document.getElementById('provider-delete-modal').classList.remove('hidden');
    }
};

// --- Model List Methods ---

window.openModelList = function(provider) {
    currentProviderForModels = provider;
    switchView('model-list');
};

window.initModelList = async function() {
    if (!currentProviderForModels) {
        // Fallback if refreshed or direct link
        switchView('model-config');
        return;
    }
    
    document.getElementById('current-provider-name').innerText = currentProviderForModels.name;
    
    // Generate mock models for this provider if not exist
    if (!modelsData[currentProviderForModels.id]) {
        modelsData[currentProviderForModels.id] = generateMockModels(currentProviderForModels.id);
    }
    
    currentModelPage = 1;
    
    const loadingEl = document.getElementById('model-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const loadingEl2 = document.getElementById('model-loading');
    if (loadingEl2) loadingEl2.classList.add('hidden');
    
    renderModelTable();
}

function getCapabilityBadge(cap) {
    const capsConfig = {
        'vision': { label: '视觉', color: 'bg-blue-100 text-blue-700' },
        'web_search': { label: '联网', color: 'bg-green-100 text-green-700' },
        'embedding': { label: '嵌入', color: 'bg-orange-100 text-orange-700' },
        'reasoning': { label: '推理', color: 'bg-purple-100 text-purple-700' },
        'tools': { label: '工具', color: 'bg-gray-100 text-gray-700' }
    };
    const config = capsConfig[cap] || capsConfig['tools'];
    return `<span class="px-2 py-0.5 text-xs rounded-full ${config.color} mr-1 mb-1 inline-block">${config.label}</span>`;
}

function renderModelTable() {
    const tbody = document.getElementById('model-table-body');
    if (!tbody) return;
    
    const pModels = modelsData[currentProviderForModels.id] || [];
    
    const startIndex = (currentModelPage - 1) * MODELS_PER_PAGE;
    const endIndex = startIndex + MODELS_PER_PAGE;
    const pageData = pModels.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">暂无模型</td></tr>';
    } else {
        pageData.forEach(model => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-blue-50 transition-colors group';
            
            const capsHtml = model.capabilities.map(cap => getCapabilityBadge(cap)).join('');
            
            tr.innerHTML = `
                <td class="px-6 py-4">${model.name}</td>
                <td class="px-6 py-4">${model.type}</td>
                <td class="px-6 py-4 flex flex-wrap">${capsHtml}</td>
                <td class="px-6 py-4">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${model.enabled ? 'checked' : ''} onchange="toggleModelEnabled('${model.id}', this)">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-3">
                        <button onclick="editModelSettings('${model.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">设置</button>
                        <button onclick="confirmDeleteModel('${model.id}')" class="text-red-600 hover:text-red-800 text-sm font-medium transition-colors">删除</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    updateModelPagination();
}

function updateModelPagination() {
    const pModels = modelsData[currentProviderForModels.id] || [];
    const totalPages = Math.ceil(pModels.length / MODELS_PER_PAGE);
    document.getElementById('model-pagination-info').innerText = `共 ${pModels.length} 条数据，第 ${currentModelPage}/${totalPages || 1} 页`;
    
    const prevBtn = document.getElementById('model-prev-btn');
    const nextBtn = document.getElementById('model-next-btn');
    if (prevBtn) prevBtn.disabled = currentModelPage <= 1;
    if (nextBtn) nextBtn.disabled = currentModelPage >= totalPages;
}

window.changeModelPage = function(delta) {
    const pModels = modelsData[currentProviderForModels.id] || [];
    const totalPages = Math.ceil(pModels.length / MODELS_PER_PAGE);
    currentModelPage += delta;
    if (currentModelPage < 1) currentModelPage = 1;
    if (currentModelPage > totalPages) currentModelPage = totalPages;
    renderModelTable();
};

window.toggleModelEnabled = async function(id, checkbox) {
    const pModels = modelsData[currentProviderForModels.id] || [];
    const model = pModels.find(m => m.id === id);
    if (model) {
        model.enabled = checkbox.checked;
        showToast(model.enabled ? '模型已启用' : '模型已停用');
    }
};

window.openModelModal = function() {
    document.getElementById('model-modal-title').innerText = '新增模型';
    document.getElementById('model-form').reset();
    
    clearError('model-name');
    clearError('model-capabilities');
    
    document.getElementById('model-modal').classList.remove('hidden');
};

window.saveModel = async function() {
    const nameInput = document.getElementById('model-name');
    const typeInput = document.getElementById('model-type');
    const capsCheckboxes = document.querySelectorAll('input[name="model-capabilities"]:checked');
    
    let isValid = true;
    
    // Validate Name
    const nameVal = nameInput.value.trim();
    if (!nameVal || nameVal.length > 100) {
        showError('model-name', '模型名称必填且1-100字符');
        isValid = false;
    } else {
        const pModels = modelsData[currentProviderForModels.id] || [];
        const duplicate = pModels.find(m => m.name === nameVal);
        if (duplicate) {
            showError('model-name', '该服务商下已存在同名模型');
            isValid = false;
        } else {
            clearError('model-name');
        }
    }
    
    if (!isValid) return;
    
    const caps = Array.from(capsCheckboxes).map(cb => cb.value);
    
    const btn = document.getElementById('model-submit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中';
    btn.disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pModels = modelsData[currentProviderForModels.id] || [];
    pModels.unshift({
        id: `m-${currentProviderForModels.id}-${Date.now()}`,
        providerId: currentProviderForModels.id,
        name: nameVal,
        type: typeInput.value,
        capabilities: caps,
        enabled: true
    });
    
    // Update model count for provider
    currentProviderForModels.modelCount = pModels.length;
    
    showToast('模型新增成功');
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    closeModal('model-modal');
    renderModelTable();
};

window.editModelSettings = function(id) {
    showToast('即将进入模型详情配置页...', 'info');
};

let deleteTargetModelId = null;
window.confirmDeleteModel = function(id) {
    const pModels = modelsData[currentProviderForModels.id] || [];
    const model = pModels.find(m => m.id === id);
    if (model) {
        deleteTargetModelId = id;
        document.getElementById('model-delete-msg').innerText = `确定删除模型【${model.name}】？`;
        
        document.getElementById('model-confirm-delete-btn').onclick = async () => {
            const btn = document.getElementById('model-confirm-delete-btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>删除中';
            btn.disabled = true;
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            modelsData[currentProviderForModels.id] = pModels.filter(m => m.id !== deleteTargetModelId);
            currentProviderForModels.modelCount = modelsData[currentProviderForModels.id].length;
            
            showToast('模型删除成功');
            
            btn.innerHTML = '确定删除';
            btn.disabled = false;
            closeModal('model-delete-modal');
            renderModelTable();
        };
        
        document.getElementById('model-delete-modal').classList.remove('hidden');
    }
};

// --- Common Utils for these views ---

function showError(fieldId, msg) {
    const errEl = document.getElementById(`${fieldId}-error`);
    const inputEl = document.getElementById(fieldId);
    if (errEl) {
        errEl.innerText = msg;
        errEl.classList.remove('hidden');
    }
    if (inputEl) {
        inputEl.classList.add('border-red-500');
    }
}

function clearError(fieldId) {
    const errEl = document.getElementById(`${fieldId}-error`);
    const inputEl = document.getElementById(fieldId);
    if (errEl) errEl.classList.add('hidden');
    if (inputEl) inputEl.classList.remove('border-red-500');
}

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

// Intercept switchView from router to initialize our data
const originalSwitchView = window.switchView;
if (originalSwitchView && !window.switchViewPatched) {
    window.switchView = async function(viewName, params) {
        await originalSwitchView(viewName, params);
        if (viewName === 'model-config' && typeof window.initProviderList === 'function') {
            window.initProviderList();
        } else if (viewName === 'model-list' && typeof window.initModelList === 'function') {
            window.initModelList();
        }
    };
    window.switchViewPatched = true;
} else if (!originalSwitchView) {
    // If not loaded yet, wait and patch
    setTimeout(() => {
        if (window.switchView && !window.switchViewPatched) {
            const orig = window.switchView;
            window.switchView = async function(viewName, params) {
                await orig(viewName, params);
                if (viewName === 'model-config' && typeof window.initProviderList === 'function') {
                    window.initProviderList();
                } else if (viewName === 'model-list' && typeof window.initModelList === 'function') {
                    window.initModelList();
                }
            };
            window.switchViewPatched = true;
        }
    }, 1000);
}

// Handle global Keyboard events (Esc to close modals, Enter to submit)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = ['provider-modal', 'provider-delete-modal', 'model-modal', 'model-delete-modal'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) {
                closeModal(id);
            }
        });
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateMockProviders,
        generateMockModels,
        initProviderList: window.initProviderList,
        saveProvider: window.saveProvider,
        saveModel: window.saveModel
    };
}
