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
            id: 'agent', label: '智能体应用', children: [
                { 
                    id: 'agent.list', 
                    label: '查看',
                    children: [
                        { id: 'agent.list.all', label: '智能体列表' },
                        { id: 'agent.list.config', label: '基础配置' },
                        { id: 'agent.list.logs', label: '日志' },
                        { id: 'agent.list.analysis', label: '分析' }
                    ]
                },
                { id: 'agent.create', label: '新建智能体' },
                { id: 'agent.delete', label: '删除智能体' },
                { 
                    id: 'agent.edit', 
                    label: '编辑智能体',
                    children: [
                        { id: 'agent.edit.config', label: '基础配置' },
                        { id: 'agent.edit.publish', label: '发布' }
                    ]
                }
            ]
        },
        {
            id: 'orchestrator', label: '工作流应用', children: [
                { 
                    id: 'orchestrator.list', 
                    label: '查看',
                    children: [
                        { id: 'orchestrator.list.all', label: '工作流列表' },
                        { id: 'orchestrator.list.config', label: '基础配置' },
                        { id: 'orchestrator.list.logs', label: '日志' },
                        { id: 'orchestrator.list.analysis', label: '分析' }
                    ]
                },
                { id: 'orchestrator.create', label: '新建工作流' },
                { id: 'orchestrator.delete', label: '删除工作流' },
                { 
                    id: 'orchestrator.edit', 
                    label: '编辑工作流',
                    children: [
                        { id: 'orchestrator.edit.basic', label: '基础配置' },
                        { id: 'orchestrator.edit.node', label: '节点配置' },
                        { id: 'orchestrator.edit.publish', label: '发布' }
                    ]
                }
            ]
        },
        {
            id: 'knowledge', label: '知识库管理', children: [
                { 
                    id: 'knowledge.list', 
                    label: '查看',
                    children: [
                        { id: 'knowledge.list.all', label: '知识库列表' },
                        { id: 'knowledge.list.files', label: '文件列表' },
                        { id: 'knowledge.list.preview', label: '查看原文' },
                        { id: 'knowledge.list.result', label: '解析结果' }
                    ]
                },
                { id: 'knowledge.create', label: '新建知识库' },
                { id: 'knowledge.delete', label: '删除知识库' },
                { 
                    id: 'knowledge.edit', 
                    label: '编辑知识库',
                    children: [
                        { id: 'knowledge.edit.basic', label: '基础信息设置' },
                        { id: 'knowledge.edit.upload', label: '上传文件' },
                        { id: 'knowledge.edit.download', label: '下载' },
                        { id: 'knowledge.edit.delete_file', label: '删除文件' },
                        { id: 'knowledge.edit.submit_remove_parse', label: '提交解析/移除解析' },
                        { id: 'knowledge.edit.parse_edit', label: '解析编辑' },
                        { id: 'knowledge.edit.source_edit', label: '原文编辑' }
                    ]
                },
                { id: 'knowledge.tags', label: '标签设置' }
            ]
        },
        {
            id: 'component', label: '组件管理', children: [
                { id: 'component.list', label: '查看' },
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
            id: 'sys.user', label: '用户管理', children: [
                { id: 'sys.user.list', label: '查看' },
                { id: 'sys.user.create', label: '新建用户' },
                { id: 'sys.user.delete', label: '删除用户' },
                { id: 'sys.user.edit', label: '编辑用户' }
            ]
        },
        {
            id: 'sys.role', label: '角色管理', children: [
                { id: 'sys.role.list', label: '查看' },
                { id: 'sys.role.create', label: '新建角色' },
                { id: 'sys.role.delete', label: '删除角色' },
                { id: 'sys.role.edit', label: '编辑角色' }
            ]
        },
        {
            id: 'system', label: '系统设置', children: [
                { 
                    id: 'sys.menu', 
                    label: '菜单管理',
                    children: [
                        { id: 'sys.menu.create', label: '新增菜单' },
                        { id: 'sys.menu.delete', label: '删除菜单' },
                        { id: 'sys.menu.edit', label: '编辑菜单' },
                        { id: 'sys.menu.add_child', label: '新增子项' }
                    ]
                },
                { id: 'sys.log', label: '操作日志', children: [
                    { id: 'sys.log.list', label: '查看日志' },
                    { id: 'sys.log.export', label: '导出日志' }
                ]}
            ]
        }
    ];

    // Data Permission Configuration
    const dataResources = [
        { id: 'agent', label: '智能体应用' },
        { id: 'orchestrator', label: '工作流应用' },
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
    let currentStep = 1; // 1: Function, 2: Data
    let cancelSyncCallback = null;

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
        
        // Expose global callback for modal
        window.cancelSyncCallback = (confirmed) => {
            if (cancelSyncCallback) cancelSyncCallback(confirmed);
        };
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

    window.switchPermTab = function(tabName, force = false) {
        // Step 1 locks Data tab
        if (tabName === 'data' && currentStep === 1 && !force) {
            return;
        }

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
        
        // Reset Step
        currentStep = 1;
        updateStepUI();

        // Render both tabs
        renderPermissionTree(role.permissions);
        // Data permissions will be rendered/synced when moving to step 2, 
        // but we can render initial state (disabled) now.
        // We pass empty object or current permissions, but the UI will be grayed out in Step 1.
        renderDataPermissions(role.dataPermissions || {}); 
        
        openModal('permission-modal');
    };

    window.handlePermissionNextStep = function() {
        if (currentStep === 1) {
            // 1. Validate
            // Check if any "View List" (*.list) is unchecked but other ops are checked? 
            // Or simply if anything is checked.
            // Prompt says: "validate required fields, format, conflict".
            // Let's assume at least one permission is required.
            const checked = document.querySelectorAll('#permission-tree input[type="checkbox"]:checked');
            if (checked.length === 0) {
                showToast('请至少配置一项功能权限', 'error');
                return;
            }

            // 2. Mock API Call
            const btn = document.getElementById('btn-save-next');
            const originalText = btn.textContent;
            btn.textContent = '校验中...';
            btn.disabled = true;

            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                
                // Success -> Next Step
                currentStep = 2;
                updateStepUI();
                
                // Sync Data
                // We need to re-render data permissions based on current selection
                const role = roles.find(r => r.id === currentPermRoleId);
                syncDataPermissions(role ? role.dataPermissions : {});
                
            }, 300);
        } else {
            // Step 2 -> Save
            savePermissions();
        }
    };

    window.handlePermissionBackStep = function() {
        currentStep = 1;
        updateStepUI();
    };

    function updateStepUI() {
        const prevBtn = document.getElementById('btn-prev-step');
        const nextBtn = document.getElementById('btn-save-next');
        
        if (currentStep === 1) {
            prevBtn.classList.add('hidden');
            nextBtn.textContent = '保存-下一步';
            switchPermTab('func', true);
            
            // Re-render data perms to show locked state
            const role = roles.find(r => r.id === currentPermRoleId);
            if(role) renderDataPermissions(role.dataPermissions || {});

        } else {
            prevBtn.classList.remove('hidden');
            nextBtn.textContent = '保存配置';
            switchPermTab('data', true);
            
            // Re-render data perms to show unlocked state
            const role = roles.find(r => r.id === currentPermRoleId);
            if(role) syncDataPermissions(role.dataPermissions || {});
        }
    }
    
    function syncDataPermissions(currentDataPerms = null) {
        // 1. Get current data perms from UI if not provided
        if (!currentDataPerms) {
            currentDataPerms = {};
            // If table exists, try to read from it
            dataResources.forEach(res => {
                const radios = document.getElementsByName(`data_perm_${res.id}`);
                for (let radio of radios) {
                    if (radio.checked) {
                        currentDataPerms[res.id] = radio.value;
                        break;
                    }
                }
            });
            // If UI was empty (e.g. first load), maybe fallback to role? 
            // But usually we pass role perms on init.
            // If we are adding a permission, we want to keep existing selections.
        }

        // 2. Get all checked 'list' permissions
        const checkedListPerms = Array.from(document.querySelectorAll('#permission-tree input[type="checkbox"][value$=".list"]:checked'))
            .map(cb => cb.value); // e.g., 'agent.list'
        
        // 3. Extract modules (e.g., 'agent')
        const activeModules = checkedListPerms.map(p => p.split('.')[0]);
        
        // 4. Filter dataResources
        const activeResources = dataResources.filter(res => activeModules.includes(res.id));
        
        renderDataPermissions(currentDataPerms, activeResources);
    }

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
    
    // ... createTreeList ...

    // 2. Data Permissions Table
    function renderDataPermissions(currentDataPerms, activeResources = null) {
        const tbody = document.getElementById('data-perm-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // If activeResources not provided, show all? Or none?
        // Requirement: "sync... only when... checked"
        // If nothing checked, activeResources is empty.
        // On init, we might want to show based on existing role perms?
        // But the requirement says "sync".
        
        const resourcesToShow = activeResources || dataResources; 

        if (resourcesToShow.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-gray-400">请先在功能权限中勾选“查看列表”以配置数据权限</td></tr>`;
            return;
        }

        // Check if disabled (Step 1)
        const isDisabled = currentStep === 1;

        resourcesToShow.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 relative'; // Relative for overlay if needed

            const nameTd = document.createElement('td');
            nameTd.className = 'px-6 py-4 font-medium text-gray-800';
            nameTd.textContent = res.label;

            const scopeTd = document.createElement('td');
            scopeTd.className = 'px-6 py-4';
            
            const scopeContainer = document.createElement('div');
            scopeContainer.className = 'flex gap-4';

            dataScopes.forEach(scope => {
                const label = document.createElement('label');
                label.className = `inline-flex items-center ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`;
                
                // Tooltip wrapper if disabled
                if (isDisabled) {
                   label.title = "请先完成功能权限配置并点击‘保存-下一步’";
                   // label.classList.add('perm-tooltip'); // Removed to avoid hiding content due to CSS opacity: 0
                   label.classList.add('opacity-50'); // Ensure visual disabled state if not covered by other classes
                }

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `data_perm_${res.id}`;
                radio.value = scope.value;
                radio.className = 'form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed';
                radio.disabled = isDisabled;

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
        
        // If disabled, we can also add a full overlay if we want to block the whole table visual
        // But disabling inputs is usually enough. 
        // Requirement: "整个面板 button 保持灰色禁用状态... 禁用状态通过统一的 disabled 类名控制"
        // Maybe add a class to the table or tbody?
        if (isDisabled) {
             tbody.classList.add('disabled-area'); 
             // Note: 'disabled-area' might need to be defined in CSS or use Tailwind classes
        } else {
             tbody.classList.remove('disabled-area');
        }
    }

    function createTreeList(nodes, currentPerms, level = 0) {
        const ul = document.createElement('ul');
        if (level === 0) {
             ul.className = 'tree-root space-y-1';
             ul.setAttribute('role', 'tree');
        } else {
             ul.className = 'tree-group pl-6 relative';
             ul.setAttribute('role', 'group');
        }

        nodes.forEach(node => {
            const li = document.createElement('li');
            li.className = 'tree-node relative';
            li.setAttribute('role', 'treeitem');
            
            const hasChildren = node.children && node.children.length > 0;
            const isChecked = currentPerms.includes('ALL') || currentPerms.includes(node.id);
            
            if (hasChildren) {
                li.setAttribute('aria-expanded', 'true');
            }

            // Row content
            const row = document.createElement('div');
            row.className = 'tree-content flex items-center py-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors relative';
            row.tabIndex = 0; // Keyboard focusable
            
            // Handle Keyboard Navigation
            row.onkeydown = (e) => {
                if (['Enter', ' '].includes(e.key)) {
                    e.preventDefault();
                    const cb = row.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                } else if (e.key === 'ArrowRight') {
                    if (hasChildren && li.getAttribute('aria-expanded') === 'false') {
                        toggleTreeNode(li);
                    }
                } else if (e.key === 'ArrowLeft') {
                    if (hasChildren && li.getAttribute('aria-expanded') === 'true') {
                        toggleTreeNode(li);
                    }
                }
            };

            // Expander
            const expander = document.createElement('span');
            expander.className = 'tree-expander w-6 h-6 flex items-center justify-center text-gray-400 mr-1 transition-transform z-10';
            
            if (hasChildren) {
                // Determine icon based on state (default expanded)
                expander.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
                expander.onclick = (e) => {
                    e.stopPropagation();
                    toggleTreeNode(li);
                };
            } else {
                expander.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-200"></span>'; // Dot for leaf? Or just empty.
                expander.classList.add('invisible');
            }

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = node.id;
            checkbox.className = 'perm-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer mr-2 z-10';
            checkbox.checked = isChecked;
            checkbox.dataset.id = node.id;
            
            checkbox.onclick = (e) => e.stopPropagation();
            checkbox.onchange = (e) => handlePermissionChange(e.target);

            // Label
            const label = document.createElement('span');
            label.className = 'text-gray-700 text-sm font-medium truncate flex-1';
            label.textContent = node.label;
            label.title = node.label; // Tooltip for truncation
            
            row.appendChild(expander);
            row.appendChild(checkbox);
            row.appendChild(label);
            
            // Row click toggles checkbox
            row.onclick = (e) => {
                if (!e.target.closest('.tree-expander') && e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            };

            li.appendChild(row);

            // Children
            if (hasChildren) {
                const childrenContainer = createTreeList(node.children, currentPerms, level + 1);
                // Animation wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'tree-children-wrapper overflow-hidden transition-all duration-300 ease-in-out';
                wrapper.style.maxHeight = '1000px'; // Initial max height, or calculated
                wrapper.appendChild(childrenContainer);
                li.appendChild(wrapper);
                
                // Deep nodes logic (progressive expansion)
                // If depth > 3, we might want different animation or state
                if (level >= 3) {
                   // Apply specific class if needed for slower animation? 
                   // User asked for "animation duration 200-300ms". CSS default is fine.
                }
            }

            ul.appendChild(li);
        });

        return ul;
    }

    // Tree Helpers
    window.toggleTreeNode = function(liOrExpander) {
        // Support passing li or expander for backward compat if needed, 
        // but new code passes li
        let li = liOrExpander;
        if (!li.classList.contains('tree-node')) {
            li = li.closest('li.tree-node');
        }
        
        const wrapper = li.querySelector('.tree-children-wrapper');
        const expanderIcon = li.querySelector('.tree-expander i');
        
        if (!wrapper) return;

        const isExpanded = li.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            // Collapse
            wrapper.style.maxHeight = '0px';
            wrapper.classList.add('opacity-0');
            li.setAttribute('aria-expanded', 'false');
            if(expanderIcon) expanderIcon.style.transform = 'rotate(-90deg)';
        } else {
            // Expand
            wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
            wrapper.classList.remove('opacity-0');
            li.setAttribute('aria-expanded', 'true');
            if(expanderIcon) expanderIcon.style.transform = 'rotate(0deg)';
            
            // Reset height to auto after animation? Or keep specific height?
            // Keeping max-height large is safer for nested changes. 
            // Better: use a large number or set to auto after timeout.
            setTimeout(() => {
                if (li.getAttribute('aria-expanded') === 'true') {
                     wrapper.style.maxHeight = '2000px'; // ample space
                }
            }, 300);
        }
    };

    // Expose for testing
    window.roleMgmtTestHelpers = {
        createTreeList: createTreeList,
        handlePermissionChange: handlePermissionChange
    };

    function handlePermissionChange(checkbox) {
        const isChecked = checkbox.checked;
        const li = checkbox.closest('li');
        const permId = checkbox.value;

        // 2. Sync Logic for "View List" (*.list)
        if (permId.endsWith('.list')) {
            if (isChecked) {
                // Add
                syncDataPermissions();
            } else {
                // Remove - Confirmation
                // Revert first to wait for confirmation
                checkbox.checked = true; 
                
                // Show Modal
                cancelSyncCallback = (confirmed) => {
                    if (confirmed) {
                        checkbox.checked = false;
                        // Cascade logic for functional perms
                        const childrenContainer = li.querySelector('ul');
                        if (childrenContainer) {
                            const childCheckboxes = childrenContainer.querySelectorAll('input[type="checkbox"]');
                            childCheckboxes.forEach(cb => cb.checked = false);
                        }
                        updateAncestors(li);
                        
                        // Sync Data (Remove)
                        syncDataPermissions();
                    }
                    // If not confirmed, do nothing (it remains checked)
                };
                openModal('sync-confirm-modal');
                return; // Stop further propagation until confirmed
            }
        }
        
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
        
        // If it's a list permission change (add), we already synced. 
        // If it's other permissions, we might not need to sync unless they affect visibility?
        // Requirement says "Only when 'View List' is checked".
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