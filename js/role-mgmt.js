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

    // Mock Permissions Tree (Multi-level)
    const permissionTree = [
        {
            id: 'build', label: '构建', children: [
                { id: 'agent', label: '智能体' },
                { id: 'orchestrator', label: '编排器' },
                { id: 'parser', label: '解析器' },
                {
                    id: 'knowledge', label: '知识库', children: [
                        { id: 'knowledge.detail', label: '知识库详情列表' }
                    ]
                },
                { id: 'component', label: '组件' }
            ]
        },
        {
            id: 'operate', label: '运营', children: [
                { id: 'debug_eval', label: '调试与评测' }
            ]
        },
        {
            id: 'settings', label: '设置', children: [
                { id: 'sys_setting', label: '系统设置' },
                { id: 'user_mgmt', label: '用户管理' },
                { id: 'role_mgmt', label: '角色管理' },
                { id: 'menu_mgmt', label: '菜单管理' },
                { id: 'sys_log', label: '系统日志' }
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
                const count = countPermissions(role.permissions);
                permBadge = `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">${count} 项权限</span>`;
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

    function countPermissions(perms) {
        // Simple count for now, could be recursive based on tree but raw count is fine
        return perms.length;
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
        container.className = 'space-y-1'; // Minimal spacing for clean tree look

        // Recursive render
        const treeRoot = createTreeList(permissionTree, currentPerms);
        container.appendChild(treeRoot);
        
        // Post-render: Update indeterminate states based on children
        updateAllParentStates();
    }

    function createTreeList(nodes, currentPerms, level = 0) {
        const ul = document.createElement('ul');
        ul.className = level === 0 ? '' : 'pl-6 border-l border-gray-100 ml-2'; // Indentation guide

        nodes.forEach(node => {
            const li = document.createElement('li');
            li.className = 'select-none';
            
            const hasChildren = node.children && node.children.length > 0;
            const isChecked = currentPerms.includes('ALL') || currentPerms.includes(node.id);
            
            // Row Container
            const row = document.createElement('div');
            row.className = 'flex items-center py-2 hover:bg-gray-50 rounded px-2 transition-colors cursor-pointer group';
            row.onclick = (e) => {
                // Clicking row toggles checkbox, unless clicking expander or the checkbox itself
                if (e.target.type !== 'checkbox' && !e.target.closest('.tree-expander')) {
                    const cb = row.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            };

            // 1. Expander (or spacer)
            const expander = document.createElement('span');
            expander.className = 'tree-expander w-6 h-6 flex items-center justify-center text-gray-400 mr-1 transition-transform cursor-pointer hover:text-gray-600';
            if (hasChildren) {
                expander.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
                expander.onclick = (e) => {
                    e.stopPropagation();
                    toggleTreeNode(e.currentTarget);
                };
            } else {
                expander.innerHTML = ''; // Spacer
            }

            // 2. Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = node.id;
            checkbox.className = 'perm-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer mr-3';
            checkbox.checked = isChecked;
            checkbox.dataset.id = node.id;
            // Recursively collect all descendant IDs for the 'all' check logic
            const descendantIds = getAllDescendantIds(node);
            checkbox.dataset.descendants = JSON.stringify(descendantIds);
            
            checkbox.onchange = (e) => {
                e.stopPropagation();
                handlePermissionChange(e.target);
            };

            // 3. Label
            const label = document.createElement('span');
            label.className = 'text-gray-700 text-sm font-medium';
            label.textContent = node.label;

            row.appendChild(expander);
            row.appendChild(checkbox);
            row.appendChild(label);
            li.appendChild(row);

            // 4. Children
            if (hasChildren) {
                const childrenContainer = createTreeList(node.children, currentPerms, level + 1);
                childrenContainer.className += ' overflow-hidden transition-all duration-300'; // For animation
                li.appendChild(childrenContainer);
            }

            ul.appendChild(li);
        });

        return ul;
    }

    function getAllDescendantIds(node) {
        let ids = [];
        if (node.children) {
            node.children.forEach(child => {
                ids.push(child.id);
                ids = ids.concat(getAllDescendantIds(child));
            });
        }
        return ids;
    }

    // --- Tree Interactions ---

    window.toggleTreeNode = function(expander) {
        const icon = expander.querySelector('i');
        const row = expander.parentElement;
        const childrenUl = row.nextElementSibling; // The UL containing children

        if (childrenUl) {
            if (childrenUl.style.display === 'none' || childrenUl.classList.contains('hidden')) {
                childrenUl.style.display = 'block';
                childrenUl.classList.remove('hidden');
                icon.style.transform = 'rotate(0deg)';
            } else {
                childrenUl.style.display = 'none';
                childrenUl.classList.add('hidden');
                icon.style.transform = 'rotate(-90deg)';
            }
        }
    };

    function handlePermissionChange(checkbox) {
        const isChecked = checkbox.checked;
        const li = checkbox.closest('li');
        
        // 1. Cascade Down: Check/Uncheck all children
        const childrenContainer = li.querySelector('ul');
        if (childrenContainer) {
            const childCheckboxes = childrenContainer.querySelectorAll('input[type="checkbox"]');
            childCheckboxes.forEach(cb => {
                cb.checked = isChecked;
                cb.indeterminate = false;
            });
        }

        // 2. Cascade Up: Update parent indeterminate state
        updateAncestors(li);
    }

    function updateAncestors(liElement) {
        const parentUl = liElement.parentElement;
        if (!parentUl) return;
        
        const parentLi = parentUl.closest('li'); // Grandparent LI
        if (!parentLi) return; // Reached root

        const parentRow = parentLi.querySelector('div'); // The row containing parent checkbox
        const parentCheckbox = parentRow.querySelector('input[type="checkbox"]');
        
        // Check siblings
        const siblings = parentUl.querySelectorAll(':scope > li > div > input[type="checkbox"]');
        let checkedCount = 0;
        let indeterminateCount = 0;
        
        siblings.forEach(cb => {
            if (cb.checked) checkedCount++;
            if (cb.indeterminate) indeterminateCount++;
        });

        if (checkedCount === siblings.length) {
            parentCheckbox.checked = true;
            parentCheckbox.indeterminate = false;
        } else if (checkedCount === 0 && indeterminateCount === 0) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = false;
        } else {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = true;
        }

        // Recursively go up
        updateAncestors(parentLi);
    }

    function updateAllParentStates() {
        // Find all lowest-level inputs and trigger update upwards? 
        // Or simpler: iterate all nodes with children bottom-up.
        // Actually, just running updateAncestors for all leaf nodes is safe.
        const checkboxes = document.querySelectorAll('#permission-tree input[type="checkbox"]');
        checkboxes.forEach(cb => {
            // If it's a leaf node (no children UL sibling in its LI), trigger update up
            const li = cb.closest('li');
            if (!li.querySelector('ul')) {
                updateAncestors(li);
            }
        });
    }

    window.savePermissions = function() {
        if (!currentPermRoleId) return;
        const role = roles.find(r => r.id === currentPermRoleId);
        if (!role) return;

        const checkboxes = document.querySelectorAll('.perm-checkbox');
        const selectedPerms = [];
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedPerms.push(cb.value);
            } else if (cb.indeterminate) {
                // Optional: Store indeterminate nodes if backend needs to know partial selection
                // For now we only store explicitly selected items or implied items
            }
        });
        
        // Optimization: If a node is selected, and we know its children are auto-included, 
        // we might just store the parent ID. But for this mock, storing all checked IDs is safest.
        
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
