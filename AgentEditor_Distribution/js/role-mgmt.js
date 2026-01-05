/**
 * Role Management Logic
 */

(function() {
    // Mock Roles Data
    let roles = [
        { id: 1, name: '超级管理员', description: '拥有系统所有权限', userCount: 1, permissions: ['ALL'] },
        { id: 2, name: '开发者', description: '负责智能体构建与调试', userCount: 5, permissions: ['agent.build', 'agent.operate'] },
        { id: 3, name: '只读访客', description: '仅可查看数据报表', userCount: 0, permissions: ['dashboard.read'] }
    ];

    // Mock Permissions Tree
    const permissionTree = [
        {
            id: 'dashboard', label: '数据看板', children: [
                { id: 'dashboard.read', label: '查看报表' },
                { id: 'dashboard.export', label: '导出数据' }
            ]
        },
        {
            id: 'agent', label: '智能体管理', children: [
                { id: 'agent.view', label: '查看智能体' },
                { id: 'agent.create', label: '创建智能体' },
                { id: 'agent.edit', label: '编辑智能体' },
                { id: 'agent.delete', label: '删除智能体' },
                { id: 'agent.publish', label: '发布版本' }
            ]
        },
        {
            id: 'user', label: '用户管理', children: [
                { id: 'user.view', label: '查看用户列表' },
                { id: 'user.edit', label: '编辑用户信息' },
                { id: 'user.delete', label: '删除用户' }
            ]
        },
        {
            id: 'role', label: '角色管理', children: [
                { id: 'role.view', label: '查看角色' },
                { id: 'role.edit', label: '编辑角色' }
            ]
        }
    ];

    let currentEditingRoleId = null;
    let currentPermRoleId = null;

    // Listen for view load
    document.addEventListener('view-loaded', (e) => {
        if (e.detail.view === 'role-mgmt') {
            initRoleMgmt();
        }
    });

    function initRoleMgmt() {
        renderRoleTable();
        
        // Search listener
        const searchInput = document.getElementById('role-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderRoleTable(e.target.value);
            });
        }
    }

    function renderRoleTable(searchTerm = '') {
        const tbody = document.getElementById('role-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        const filteredRoles = roles.filter(role => 
            role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            role.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredRoles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">暂无角色数据</td></tr>`;
            return;
        }

        filteredRoles.forEach(role => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 group transition-colors';

            // Format permissions badge
            let permBadge = '';
            if (role.permissions.includes('ALL')) {
                permBadge = '<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">ALL ACCESS</span>';
            } else {
                permBadge = `<div class="flex gap-1 flex-wrap">
                    ${role.permissions.slice(0, 3).map(p => `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">${p}</span>`).join('')}
                    ${role.permissions.length > 3 ? `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">+${role.permissions.length - 3}</span>` : ''}
                </div>`;
            }

            // Action Button logic
            let actionBtn = '';
            if (role.name === '超级管理员') {
                 actionBtn = '<span class="text-gray-400 text-xs bg-gray-100 px-2 py-1 rounded">系统默认</span>';
            } else {
                 actionBtn = `<button onclick="window.openRoleActions(event, ${role.id})" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>`;
            }

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-800">${role.name}</td>
                <td class="px-6 py-4 text-gray-500">${role.description}</td>
                <td class="px-6 py-4">${role.userCount}</td>
                <td class="px-6 py-4">${permBadge}</td>
                <td class="px-6 py-4 text-right">${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Actions Menu ---
    window.openRoleActions = function(event, roleId) {
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        const actions = [
            {
                label: '配置权限',
                icon: 'fa-solid fa-key',
                onClick: () => openPermissionModal(roleId)
            },
            {
                label: '编辑角色',
                icon: 'fa-solid fa-pen',
                onClick: () => openRoleModal(roleId)
            },
            {
                label: '删除角色',
                icon: 'fa-solid fa-trash',
                className: 'text-red-600 hover:bg-red-50',
                iconClass: 'text-red-500',
                onClick: () => confirmDeleteRole(roleId)
            }
        ];

        window.showActionMenu(event, actions);
    };

    // --- Add/Edit Role ---
    window.openRoleModal = function(roleId = null) {
        currentEditingRoleId = roleId;
        const modal = document.getElementById('role-modal');
        const title = document.getElementById('role-modal-title');
        const nameInput = document.getElementById('role-name');
        const descInput = document.getElementById('role-desc');

        if (roleId) {
            const role = roles.find(r => r.id === roleId);
            if (!role) return;
            title.textContent = '编辑角色';
            nameInput.value = role.name;
            descInput.value = role.description;
        } else {
            title.textContent = '新增角色';
            nameInput.value = '';
            descInput.value = '';
        }
        
        openModal('role-modal');
    };

    window.saveRole = function() {
        const nameInput = document.getElementById('role-name');
        const descInput = document.getElementById('role-desc');
        const name = nameInput.value.trim();
        const desc = descInput.value.trim();

        if (!name) {
            showToast('请输入角色名称', 'error');
            return;
        }

        if (currentEditingRoleId) {
            // Edit
            const role = roles.find(r => r.id === currentEditingRoleId);
            if (role) {
                role.name = name;
                role.description = desc;
                showToast('角色更新成功', 'success');
            }
        } else {
            // Add
            const newRole = {
                id: Date.now(),
                name: name,
                description: desc,
                userCount: 0,
                permissions: []
            };
            roles.push(newRole);
            showToast('角色创建成功', 'success');
        }

        closeModal('role-modal');
        renderRoleTable();
    };

    // --- Permissions ---
    window.openPermissionModal = function(roleId) {
        currentPermRoleId = roleId;
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        document.getElementById('perm-role-name').textContent = role.name;
        renderPermissionTree(role.permissions);
        openModal('permission-modal');
    };

    function renderPermissionTree(currentPerms) {
        const container = document.getElementById('permission-tree');
        if (!container) return;
        container.innerHTML = '';

        permissionTree.forEach(module => {
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'bg-white border border-gray-200 rounded-lg p-4';
            
            const header = document.createElement('div');
            header.className = 'font-medium text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center justify-between';
            
            // Module Checkbox logic could be complex (select all), keeping simple for now
            header.innerHTML = `<span>${module.label}</span>`;
            
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 md:grid-cols-3 gap-3';

            module.children.forEach(perm => {
                const isChecked = currentPerms.includes('ALL') || currentPerms.includes(perm.id);
                const label = document.createElement('label');
                label.className = 'flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors';
                label.innerHTML = `
                    <input type="checkbox" value="${perm.id}" class="perm-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${isChecked ? 'checked' : ''}>
                    <span class="text-sm text-gray-600">${perm.label}</span>
                `;
                grid.appendChild(label);
            });

            moduleDiv.appendChild(header);
            moduleDiv.appendChild(grid);
            container.appendChild(moduleDiv);
        });
    }

    window.savePermissions = function() {
        if (!currentPermRoleId) return;
        const role = roles.find(r => r.id === currentPermRoleId);
        if (!role) return;

        const checkboxes = document.querySelectorAll('.perm-checkbox:checked');
        const selectedPerms = Array.from(checkboxes).map(cb => cb.value);

        role.permissions = selectedPerms;
        
        showToast('权限配置已保存', 'success');
        closeModal('permission-modal');
        renderRoleTable();
    };

    // --- Delete Role ---
    window.confirmDeleteRole = function(roleId) {
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        // Check Association (Mock Check)
        // In real app, we would check against users list
        // Since we can't easily access `users` from user-mgmt.js here without exposing it,
        // we use the mock `userCount` property on the role itself which simulates this.
        
        if (role.userCount > 0) {
            showToast('该角色正在被使用，无法删除', 'error');
            return;
        }

        const msgEl = document.getElementById('delete-role-msg');
        const confirmBtn = document.getElementById('confirm-delete-role-btn');
        
        if (msgEl) msgEl.textContent = `确认删除角色 "${role.name}"？此操作无法撤销。`;
        
        // Unbind previous listeners to avoid duplicates
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        
        newBtn.onclick = () => {
            executeDeleteRole(roleId);
        };

        openModal('delete-role-modal');
    };

    function executeDeleteRole(roleId) {
        const index = roles.findIndex(r => r.id === roleId);
        if (index > -1) {
            roles.splice(index, 1);
            showToast('角色已删除', 'success');
            renderRoleTable();
        }
        closeModal('delete-role-modal');
    }

})();
