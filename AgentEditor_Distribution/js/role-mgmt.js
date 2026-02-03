/**
 * Role Management Logic
 */

(function() {
    // Mock Roles Data
    // permissions: Functional permissions (list of IDs)
    // dataPermissions: Data scope permissions { resourceId: scopeValue }
    let roles = [
        { 
            id: 1, 
            name: '超级管理员', 
            description: '拥有系统所有权限', 
            userCount: 1, 
            permissions: ['ALL'],
            dataPermissions: { 'ALL': 'all' } 
        },
        { 
            id: 2, 
            name: '开发者', 
            description: '负责智能体构建与调试', 
            userCount: 5, 
            permissions: [
                'agent.list', 'agent.create', 'agent.edit',
                'orchestrator.list', 'orchestrator.create'
            ],
            dataPermissions: {
                'agent': 'dept',
                'orchestrator': 'dept',
                'parser': 'self',
                'knowledge': 'self',
                'component': 'all'
            }
        },
        { 
            id: 3, 
            name: '只读访客', 
            description: '仅可查看数据报表', 
            userCount: 0, 
            permissions: ['dashboard.read'],
            dataPermissions: {
                'agent': 'all' // Can see all agents but maybe only read-only based on functional perms
            }
        }
    ];

    // Granular Functional Permissions Tree
    const permissionTree = [
        {
            id: 'agent', label: '智能体管理', children: [
                { id: 'agent.list', label: '查看列表' },
                { id: 'agent.create', label: '新建智能体' },
                { id: 'agent.edit', label: '编辑智能体' },
                { id: 'agent.delete', label: '删除智能体' }
            ]
        },
        {
            id: 'orchestrator', label: '工作流管理', children: [
                { id: 'orchestrator.list', label: '查看列表' },
                { id: 'orchestrator.create', label: '新建工作流' },
                { id: 'orchestrator.edit', label: '编辑工作流' },
                { id: 'orchestrator.delete', label: '删除工作流' }
            ]
        },
        {
            id: 'knowledge', label: '知识库管理', children: [
                { id: 'knowledge.list', label: '查看列表' },
                { id: 'knowledge.create', label: '新建知识库' },
                { id: 'knowledge.edit', label: '编辑知识库' },
                { id: 'knowledge.delete', label: '删除知识库' }
            ]
        },
        {
            id: 'parser', label: '解析器管理', children: [
                { id: 'parser.list', label: '查看列表' },
                { id: 'parser.create', label: '新建解析器' },
                { id: 'parser.edit', label: '编辑解析器' },
                { id: 'parser.delete', label: '删除解析器' }
            ]
        },
        {
            id: 'component', label: '组件管理', children: [
                { id: 'component.list', label: '查看列表' },
                { id: 'component.create', label: '新建组件' },
                { id: 'component.edit', label: '编辑组件' },
                { id: 'component.delete', label: '删除组件' }
            ]
        },
        {
            id: 'evaluation', label: '效果测评', children: [
                { id: 'evaluation.list', label: '查看测评任务' },
                { id: 'evaluation.create', label: '新建测评' },
                { id: 'evaluation.report', label: '查看报告' }
            ]
        },
        {
            id: 'system', label: '系统设置', children: [
                { id: 'sys.log', label: '操作日志', children: [
                    { id: 'sys.log.list', label: '查看日志' }
                ]}
            ]
        },
        {
            id: 'sys.user', label: '用户管理', children: [
                { id: 'sys.user.list', label: '查看列表' },
                { id: 'sys.user.create', label: '新建用户' },
                { id: 'sys.user.edit', label: '编辑用户' },
                { id: 'sys.user.delete', label: '删除用户' }
            ]
        },
        {
            id: 'sys.role', label: '角色管理', children: [
                { id: 'sys.role.list', label: '查看列表' },
                { id: 'sys.role.create', label: '新建角色' },
                { id: 'sys.role.edit', label: '编辑角色' },
                { id: 'sys.role.delete', label: '删除角色' }
            ]
        }
    ];

    // Data Permission Configuration
    const dataResources = [
        { id: 'agent', label: '智能体' },
        { id: 'orchestrator', label: '工作流' },
        { id: 'parser', label: '解析器' },
        { id: 'knowledge', label: '知识库' },
        { id: 'knowledge_graph', label: '知识图谱' },
        { id: 'component', label: '组件' },
        { id: 'evaluation', label: '效果测评' }
    ];

    const dataScopes = [
        { value: 'all', label: '全部数据' },
        { value: 'self_authorized', label: '仅本人创建' }
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
                permBadge = `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">${count} 项功能权限</span>`;
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
                permissions: [],
                dataPermissions: {}
            };
            roles.push(newRole);
            showToast('角色创建成功', 'success');
        }

        closeModal('role-modal');
        renderRoleTable();
    };

    // --- Permissions Modal Logic ---

    window.switchPermTab = function(tabName) {
        const funcBtn = document.getElementById('tab-btn-func');
        const dataBtn = document.getElementById('tab-btn-data');
        const funcContent = document.getElementById('perm-content-func');
        const dataContent = document.getElementById('perm-content-data');

        if (tabName === 'func') {
            funcBtn.classList.add('text-blue-600', 'border-blue-600');
            funcBtn.classList.remove('text-gray-500', 'border-transparent');
            dataBtn.classList.remove('text-blue-600', 'border-blue-600');
            dataBtn.classList.add('text-gray-500', 'border-transparent');
            
            funcContent.classList.remove('hidden');
            funcContent.classList.add('block');
            dataContent.classList.remove('block');
            dataContent.classList.add('hidden');
        } else {
            dataBtn.classList.add('text-blue-600', 'border-blue-600');
            dataBtn.classList.remove('text-gray-500', 'border-transparent');
            funcBtn.classList.remove('text-blue-600', 'border-blue-600');
            funcBtn.classList.add('text-gray-500', 'border-transparent');
            
            dataContent.classList.remove('hidden');
            dataContent.classList.add('block');
            funcContent.classList.remove('block');
            funcContent.classList.add('hidden');
        }
    };

    window.openPermissionModal = function(roleId) {
        currentPermRoleId = roleId;
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        document.getElementById('perm-role-name').textContent = role.name;
        
        // Render both tabs
        renderPermissionTree(role.permissions);
        renderDataPermissions(role.dataPermissions || {});
        
        // Reset to first tab
        switchPermTab('func');
        
        openModal('permission-modal');
    };

    // 1. Functional Permissions Tree
    function renderPermissionTree(currentPerms) {
        const container = document.getElementById('permission-tree');
        if (!container) return;
        container.innerHTML = '';
        container.className = 'space-y-1';

        const treeRoot = createTreeList(permissionTree, currentPerms);
        container.appendChild(treeRoot);
        
        updateAllParentStates();
    }

    function createTreeList(nodes, currentPerms, level = 0) {
        const ul = document.createElement('ul');
        ul.className = level === 0 ? '' : 'pl-6 border-l border-gray-100 ml-2';

        nodes.forEach(node => {
            const li = document.createElement('li');
            li.className = 'select-none';
            
            const hasChildren = node.children && node.children.length > 0;
            const isChecked = currentPerms.includes('ALL') || currentPerms.includes(node.id);
            
            // Row
            const row = document.createElement('div');
            row.className = 'flex items-center py-2 hover:bg-gray-50 rounded px-2 transition-colors cursor-pointer group';
            row.onclick = (e) => {
                if (e.target.type !== 'checkbox' && !e.target.closest('.tree-expander')) {
                    const cb = row.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            };

            // Expander
            const expander = document.createElement('span');
            expander.className = 'tree-expander w-6 h-6 flex items-center justify-center text-gray-400 mr-1 transition-transform cursor-pointer hover:text-gray-600';
            if (hasChildren) {
                expander.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
                expander.onclick = (e) => {
                    e.stopPropagation();
                    toggleTreeNode(e.currentTarget);
                };
            } else {
                expander.innerHTML = '';
            }

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = node.id;
            checkbox.className = 'perm-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer mr-3';
            checkbox.checked = isChecked;
            checkbox.dataset.id = node.id;
            
            checkbox.onchange = (e) => {
                e.stopPropagation();
                handlePermissionChange(e.target);
            };

            // Label
            const label = document.createElement('span');
            label.className = 'text-gray-700 text-sm font-medium';
            label.textContent = node.label;

            row.appendChild(expander);
            row.appendChild(checkbox);
            row.appendChild(label);
            li.appendChild(row);

            // Children
            if (hasChildren) {
                const childrenContainer = createTreeList(node.children, currentPerms, level + 1);
                // Default expanded for better UX on deeper trees? Or keep collapsed?
                // Let's keep collapsed by default except first level maybe? 
                // For now, simple implementation: default visible.
                li.appendChild(childrenContainer);
            }

            ul.appendChild(li);
        });

        return ul;
    }

    // Tree Helpers
    window.toggleTreeNode = function(expander) {
        const icon = expander.querySelector('i');
        const row = expander.parentElement;
        const childrenUl = row.nextElementSibling;

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
        
        // Cascade Down
        const childrenContainer = li.querySelector('ul');
        if (childrenContainer) {
            const childCheckboxes = childrenContainer.querySelectorAll('input[type="checkbox"]');
            childCheckboxes.forEach(cb => {
                cb.checked = isChecked;
                cb.indeterminate = false;
            });
        }

        // Cascade Up
        updateAncestors(li);
    }

    function updateAncestors(liElement) {
        const parentUl = liElement.parentElement;
        if (!parentUl) return;
        
        const parentLi = parentUl.closest('li');
        if (!parentLi) return;

        const parentRow = parentLi.querySelector('div');
        const parentCheckbox = parentRow.querySelector('input[type="checkbox"]');
        
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

        updateAncestors(parentLi);
    }

    function updateAllParentStates() {
        const checkboxes = document.querySelectorAll('#permission-tree input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const li = cb.closest('li');
            if (!li.querySelector('ul')) {
                updateAncestors(li);
            }
        });
    }

    // 2. Data Permissions Table
    function renderDataPermissions(currentDataPerms) {
        const tbody = document.getElementById('data-perm-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        dataResources.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';

            const nameTd = document.createElement('td');
            nameTd.className = 'px-6 py-4 font-medium text-gray-800';
            nameTd.textContent = res.label;

            const scopeTd = document.createElement('td');
            scopeTd.className = 'px-6 py-4';
            
            const scopeContainer = document.createElement('div');
            scopeContainer.className = 'flex gap-4';

            dataScopes.forEach(scope => {
                const label = document.createElement('label');
                label.className = 'inline-flex items-center cursor-pointer';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `data_perm_${res.id}`;
                radio.value = scope.value;
                radio.className = 'form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500';
                
                // Check logic: if exists in map, use it. If 'ALL' role, default to all?
                // For now just use map. Default to 'self' if not set? Or none?
                // Let's assume if not set, no selection (or implicit None/Self). 
                // For UI, if value matches, check it.
                const currentVal = currentDataPerms[res.id];
                if (currentVal === scope.value || (!currentVal && scope.value === 'all')) {
                    radio.checked = true;
                }
                
                const span = document.createElement('span');
                span.className = 'ml-2 text-sm text-gray-700';
                span.textContent = scope.label;

                label.appendChild(radio);
                label.appendChild(span);
                scopeContainer.appendChild(label);
            });

            scopeTd.appendChild(scopeContainer);
            tr.appendChild(nameTd);
            tr.appendChild(scopeTd);
            tbody.appendChild(tr);
        });
    }

    // Save
    window.savePermissions = function() {
        if (!currentPermRoleId) return;
        const role = roles.find(r => r.id === currentPermRoleId);
        if (!role) return;

        // 1. Collect Functional Perms
        const checkboxes = document.querySelectorAll('.perm-checkbox');
        const selectedPerms = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedPerms.push(cb.value);
            }
        });
        role.permissions = selectedPerms;

        // 2. Collect Data Perms
        const newDataPerms = {};
        dataResources.forEach(res => {
            const radios = document.getElementsByName(`data_perm_${res.id}`);
            for (let radio of radios) {
                if (radio.checked) {
                    newDataPerms[res.id] = radio.value;
                    break;
                }
            }
        });
        role.dataPermissions = newDataPerms;
        
        showToast('权限配置已保存', 'success');
        closeModal('permission-modal');
        renderRoleTable();
    };

    // --- Delete Role ---
    window.confirmDeleteRole = function(roleId) {
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        if (role.userCount > 0) {
            showToast('该角色正在被使用，无法删除', 'error');
            return;
        }

        const msgEl = document.getElementById('delete-role-msg');
        const confirmBtn = document.getElementById('confirm-delete-role-btn');
        
        if (msgEl) msgEl.textContent = `确认删除角色 "${role.name}"？此操作无法撤销。`;
        
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