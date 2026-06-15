// Mock Data for Permissions
const MOCK_USERS = [
    { id: 'u1001', name: '张三', dept: '研发部', empId: '1001' },
    { id: 'u1002', name: '李四', dept: '产品部', empId: '1002' },
    { id: 'u1003', name: '王五', dept: '运营部', empId: '1003' },
    { id: 'u1004', name: '赵六', dept: '研发部', empId: '1004' },
    { id: 'u1005', name: '钱七', dept: '人事部', empId: '1005' },
    { id: 'u1006', name: '孙八', dept: '市场部', empId: '1006' },
    { id: 'u1007', name: '周九', dept: '财务部', empId: '1007' },
    { id: 'u1008', name: '吴十', dept: '法务部', empId: '1008' },
    { id: 'u1009', name: '郑十一', dept: '安全部', empId: '1009' },
    { id: 'u1010', name: '陈十二', dept: '研发部', empId: '1010' },
    { id: 'u1011', name: '林十三', dept: '产品部', empId: '1011' },
    { id: 'u1012', name: '黄十四', dept: '运营部', empId: '1012' },
    { id: 'u1013', name: '周十五', dept: '市场部', empId: '1013' },
    { id: 'u1014', name: '吴十六', dept: '销售部', empId: '1014' },
    { id: 'u1015', name: '郑十七', dept: '客服部', empId: '1015' }
];

const MOCK_ROLES = [
    { id: 'r1', name: '超级管理员', description: '拥有系统所有权限' },
    { id: 'r2', name: '开发者', description: '负责智能体构建与调试' },
    { id: 'r3', name: '只读访客', description: '仅可查看数据报表' },
    { id: 'r4', name: '运营人员', description: '负责效果测评与运营' },
    { id: 'r5', name: '产品经理', description: '负责需求分析与设计' }
];

// --- Permission Definitions ---
let permissionDefinitions = [
    { id: 'manage', name: '可管理', type: 'edit', desc: '系统管理员权限，包含所有读写操作及授权管理功能', isSystem: true, rules: [] },
    { id: 'edit', name: '可编辑', type: 'edit', desc: '内容协作者，可新建、编辑、删除数据，但无法管理成员授权', isSystem: true, rules: [] },
    { id: 'view', name: '可查看', type: 'view', desc: '普通访客，仅拥有只读访问权限', isSystem: true, rules: [] }
];

// State
let currentResourceId = null;
let currentResourceType = 'agent'; // Default
let resourcePermissions = {}; // { resourceType_resourceId: [ { type: 'user'|'role', id, name, deptPath/desc, role } ] }

// Selector State
let selectorState = {
    isOpen: false,
    tab: 'role', 
    selectedItems: new Set(), // Set<string> "type:id"
    keyword: ''
};

// --- Page Navigation Entry Point ---

window.navigateToPermissionConfig = function(resourceId, resourceType, resourceName) {
    currentResourceId = resourceId;
    currentResourceType = resourceType || 'agent';
    const name = resourceName || 'Unknown Resource';
    
    // Init Mock Permissions if needed
    const permKey = `${currentResourceType}_${currentResourceId}`;
    if (!resourcePermissions[permKey]) {
        resourcePermissions[permKey] = [
            { type: 'user', id: 'u1001', name: 'Admin', dept: '研发部', role: 'manage' },
            { type: 'role', id: 'r2', name: '开发者', description: '负责智能体构建与调试', role: 'edit' }
        ];
    }
    
    openPermissionConfigModal(name);
};

// --- Modal Management ---

function openPermissionConfigModal(resourceName) {
    const modal = document.getElementById('permission-config-modal');
    if (!modal) return;
    
    // Update Header
    const titleEl = document.getElementById('perm-agent-name');
    if (titleEl) titleEl.textContent = resourceName;
    
    // Render Content
    renderPermissionList();
    
    // Show Modal
    modal.classList.remove('hidden');
}

window.renderPermissionList = function() {
    const permKey = `${currentResourceType}_${currentResourceId}`;
    const list = resourcePermissions[permKey] || [];
    
    // Update Count
    const countEl = document.getElementById('perm-total-count');
    if (countEl) countEl.textContent = list.length;
    
    // Toggle Empty State
    const emptyState = document.getElementById('perm-empty-state');
    const tableContainer = document.querySelector('#perm-list-body').closest('div');
    
    if (list.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden'); // Hide table wrapper if needed, or just leave empty body
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
    }
    
    const tbody = document.getElementById('perm-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 group transition-colors';
        
        let iconClass = '';
        let iconBg = '';
        let subText = '';
        
        if (item.type === 'user') {
            iconClass = 'fa-user text-white';
            iconBg = 'bg-blue-400';
            subText = item.dept || '未知部门';
        } else {
            iconClass = 'fa-user-shield text-white';
            iconBg = 'bg-purple-400';
            subText = item.description || '角色';
        }
        
        // Build options for select
        const options = permissionDefinitions.map(d => 
            `<option value="${d.id}" ${item.role === d.id ? 'selected' : ''}>${d.name}</option>`
        ).join('');
        
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid ${iconClass} text-xs"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-medium text-gray-900 truncate">${item.name}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-500">
                ${subText}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <select onchange="updatePermissionRole('${item.type}', '${item.id}', this.value)" class="text-xs border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 cursor-pointer py-1 pl-2 pr-8 bg-gray-50 hover:bg-white transition-colors w-full max-w-[120px]">
                    ${options}
                </select>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-right">
                <button onclick="removePermission('${item.type}', '${item.id}')" class="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-red-50" title="移除授权">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.updatePermissionRole = function(type, id, newRole) {
    const permKey = `${currentResourceType}_${currentResourceId}`;
    const list = resourcePermissions[permKey];
    if (list) {
        const item = list.find(p => p.type === type && p.id === id);
        if (item) {
            item.role = newRole;
            // No full re-render needed, just save
            saveToBackend();
        }
    }
};

window.removePermission = function(type, id) {
    // if (!confirm('确定要移除该授权吗？')) return; // Optional confirmation
    
    const permKey = `${currentResourceType}_${currentResourceId}`;
    if (resourcePermissions[permKey]) {
        resourcePermissions[permKey] = resourcePermissions[permKey].filter(p => !(p.type === type && p.id === id));
        renderPermissionList();
        saveToBackend();
    }
};

// --- Selector Modal Integration ---

window.openPermissionSelector = function() {
    selectorState = {
        isOpen: true,
        tab: 'role', // Default to role tab in selector
        selectedItems: new Set(),
        keyword: ''
    };
    
    // Reset UI
    const searchInput = document.getElementById('selector-search-input');
    if (searchInput) searchInput.value = '';
    
    // Update Role Select Options in Selector
    const roleSelect = document.getElementById('selector-role');
    if (roleSelect) {
        roleSelect.innerHTML = permissionDefinitions.map(d => 
            `<option value="${d.id}">${d.name}</option>`
        ).join('');
        roleSelect.value = 'view';
    }
    
    switchSelectorTab('role');
    updateSelectorSummary();
    
    // Show Modal
    const modal = document.getElementById('perm-selector-modal');
    if (modal) {
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        
        const content = document.getElementById('perm-selector-content');
        if (content) {
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }
        
        setTimeout(() => {
            if(searchInput) searchInput.focus();
        }, 350);
        
        if (searchInput) {
            searchInput.oninput = (e) => {
                selectorState.keyword = e.target.value.trim();
                debounceRenderSelector();
            };
        }
    }
};

window.closeSelectorModal = function() {
    const modal = document.getElementById('perm-selector-modal');
    const content = document.getElementById('perm-selector-content');
    
    if (modal) {
        modal.classList.add('opacity-0');
        if (content) {
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
        }
        
        setTimeout(() => {
            modal.classList.add('hidden');
            selectorState.isOpen = false;
        }, 300);
    }
};

window.switchSelectorTab = function(tab) {
    selectorState.tab = tab;
    const userTab = document.getElementById('selector-tab-user');
    const roleTab = document.getElementById('selector-tab-role');
    const userContent = document.getElementById('selector-content-user');
    const roleContent = document.getElementById('selector-content-role');
    
    if (!userTab || !roleTab) return;

    if (tab === 'user') {
        userTab.classList.add('border-blue-600', 'text-blue-600');
        userTab.classList.remove('border-transparent', 'text-gray-500');
        roleTab.classList.remove('border-blue-600', 'text-blue-600');
        roleTab.classList.add('border-transparent', 'text-gray-500');
        
        if (userContent) userContent.classList.remove('hidden');
        if (roleContent) roleContent.classList.add('hidden');
    } else {
        roleTab.classList.add('border-blue-600', 'text-blue-600');
        roleTab.classList.remove('border-transparent', 'text-gray-500');
        userTab.classList.remove('border-blue-600', 'text-blue-600');
        userTab.classList.add('border-transparent', 'text-gray-500');
        
        if (roleContent) roleContent.classList.remove('hidden');
        if (userContent) userContent.classList.add('hidden');
    }
    
    renderSelectorContent();
};

let renderTimeout;
function debounceRenderSelector() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        renderSelectorContent();
    }, 300);
}

function renderSelectorContent() {
    const loader = document.getElementById('selector-loading');
    const empty = document.getElementById('selector-empty');
    if (loader) loader.classList.remove('hidden');
    
    setTimeout(() => {
        if (loader) loader.classList.add('hidden');
        
        if (selectorState.tab === 'user') {
            renderUserList();
        } else {
            renderRoleList();
        }
        
        const container = selectorState.tab === 'user' ? 
            document.getElementById('selector-content-user') : 
            document.getElementById('selector-content-role');
            
        if (container && empty) {
            if (container.children.length === 0) {
                empty.classList.remove('hidden');
            } else {
                empty.classList.add('hidden');
            }
        }
    }, 300);
}

function renderUserList() {
    const container = document.getElementById('selector-content-user');
    if (!container) return;
    container.innerHTML = '';
    
    const filtered = MOCK_USERS.filter(u => 
        !selectorState.keyword || 
        u.name.includes(selectorState.keyword) || 
        u.dept.includes(selectorState.keyword) ||
        u.empId.includes(selectorState.keyword)
    );
    
    filtered.forEach(user => {
        const key = `user:${user.id}`;
        const isSelected = selectorState.selectedItems.has(key);
        const isDisabled = isAlreadyAuthorized('user', user.id);
        
        const div = document.createElement('div');
        div.className = `flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`;
        if (!isDisabled) {
            div.onclick = () => toggleSelection('user', user.id);
        }
        
        div.innerHTML = `
            <div class="mr-3">
                <input type="checkbox" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled checked' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none">
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">${user.name}</span>
                    <span class="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">${user.empId}</span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${user.dept}</div>
            </div>
            ${isDisabled ? '<span class="text-xs text-green-600">已添加</span>' : ''}
        `;
        container.appendChild(div);
    });
}

function renderRoleList() {
    const container = document.getElementById('selector-content-role');
    if (!container) return;
    container.innerHTML = '';
    
    const filtered = MOCK_ROLES.filter(r => 
        !selectorState.keyword || 
        r.name.includes(selectorState.keyword) || 
        r.description.includes(selectorState.keyword)
    );
    
    filtered.forEach(role => {
        const key = `role:${role.id}`;
        const isSelected = selectorState.selectedItems.has(key);
        const isDisabled = isAlreadyAuthorized('role', role.id);
        
        const div = document.createElement('div');
        div.className = `flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`;
        if (!isDisabled) {
            div.onclick = () => toggleSelection('role', role.id);
        }
        
        div.innerHTML = `
            <div class="mr-3">
                <input type="checkbox" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled checked' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none">
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">${role.name}</span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${role.description}</div>
            </div>
            ${isDisabled ? '<span class="text-xs text-green-600">已添加</span>' : ''}
        `;
        container.appendChild(div);
    });
}

function toggleSelection(type, id) {
    const key = `${type}:${id}`;
    if (selectorState.selectedItems.has(key)) {
        selectorState.selectedItems.delete(key);
    } else {
        selectorState.selectedItems.add(key);
    }
    
    updateSelectorUI(key);
    updateSelectorSummary();
}

function updateSelectorUI(key) {
    if (selectorState.tab === 'user') renderUserList();
    else renderRoleList();
}

function updateSelectorSummary() {
    const count = document.getElementById('selector-count');
    if (count) count.textContent = selectorState.selectedItems.size;
}

function isAlreadyAuthorized(type, id) {
    const permKey = `${currentResourceType}_${currentResourceId}`;
    const list = resourcePermissions[permKey] || [];
    return list.some(p => p.type === type && p.id === id);
}

window.confirmSelection = function() {
    const permKey = `${currentResourceType}_${currentResourceId}`;
    const roleInput = document.getElementById('selector-role');
    const role = roleInput ? roleInput.value : 'view';
    let addedCount = 0;
    
    if (!resourcePermissions[permKey]) resourcePermissions[permKey] = [];

    selectorState.selectedItems.forEach(key => {
        const [type, id] = key.split(':');
        
        let itemData;
        if (type === 'user') {
            itemData = MOCK_USERS.find(u => u.id === id);
        } else {
            itemData = MOCK_ROLES.find(r => r.id === id);
        }
        
        if (itemData) {
             resourcePermissions[permKey].push({
                type: type,
                id: id,
                name: itemData.name,
                dept: type === 'user' ? itemData.dept : null,
                description: type === 'role' ? itemData.description : null,
                role: role,
                addedAt: new Date().toLocaleString()
            });
            addedCount++;
        }
    });
    
    if (addedCount > 0) {
        // Update Page Content
        renderPermissionList();
        
        saveToBackend();
        showToast(`成功添加 ${addedCount} 个授权`, 'success');
        closeSelectorModal();
    } else {
        showToast('未选择任何新项目', 'info');
    }
};

// --- Mock Backend Save & Audit ---
function saveToBackend() {
    // Try to find page indicator first
    let indicator = document.getElementById('perm-auto-save-indicator');
    
    if (indicator) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>保存中...';
        
        setTimeout(() => {
            indicator.innerHTML = '<i class="fa-solid fa-check mr-1"></i>已实时保存';
            console.log(`[Audit Log] Resource ${currentResourceType}:${currentResourceId} permissions updated at ${new Date().toISOString()}`);
            
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 2000);
        }, 600);
    }
}
