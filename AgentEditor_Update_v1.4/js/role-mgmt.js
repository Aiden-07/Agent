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
                { id: 'orchestrator.list', label: '查询工作流' },
                { id: 'orchestrator.create', label: '新建工作流' }
            ]
        },
        {
            id: 'knowledge', label: '知识库管理', children: [
                { id: 'knowledge.list', label: '查询知识库' },
                { id: 'knowledge.create', label: '新建知识库' },
                { 
                    id: 'knowledge.tags', 
                    label: '设置标签按钮',
                    children: [
                        { id: 'knowledge.tags.list', label: '查询知识库标签' },
                        { id: 'knowledge.tags.create', label: '新建知识库标签' },
                        { id: 'knowledge.tags.edit', label: '编辑知识库标签' },
                        { id: 'knowledge.tags.delete', label: '删除知识库标签' }
                    ]
                }
            ]
        },
        {
            id: 'knowledge_graph', label: '知识图谱', children: [
                { id: 'knowledge_graph.list', label: '查询知识图谱' },
                { id: 'knowledge_graph.create', label: '新建知识图谱' },
                { 
                    id: 'knowledge_graph.edit', 
                    label: '实体类型设置',
                    children: [
                        { id: 'knowledge_graph.edit.list', label: '查询实体类型' },
                        { id: 'knowledge_graph.edit.create', label: '新建实体类型' },
                        { id: 'knowledge_graph.edit.update', label: '编辑实体类型' },
                        { id: 'knowledge_graph.edit.delete', label: '删除实体类型' }
                    ]
                }
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
        { id: 'orchestrator', label: '工作流应用' },
        { id: 'knowledge', label: '知识库' },
        { id: 'knowledge_graph', label: '知识图谱' },
        { id: 'report_file', label: '报告文件' }
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
        
        // Default to func tab
        switchPermTab('func');
        
        openModal('permission-modal');
    };

    window.handlePermissionSave = function() {
        // Validate Functional Perms (at least one check?)
        // Requirement: "Add appropriate error handling"
        const checked = document.querySelectorAll('#permission-tree input[type="checkbox"]:checked');
        if (checked.length === 0) {
            showToast('请至少配置一项功能权限', 'error');
            return;
        }

        savePermissions();
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
    
    // ... createTreeList ...

    // 2. Data Permissions Table
    function renderDataPermissions(currentDataPerms) {
        const tbody = document.getElementById('data-perm-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const resourcesToShow = dataResources; 

        if (resourcesToShow.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-gray-400">暂无数据权限配置项</td></tr>`;
        }

        resourcesToShow.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 relative'; 

            const nameTd = document.createElement('td');
            nameTd.className = 'px-6 py-4 font-medium text-gray-800';
            nameTd.textContent = res.label;

            const scopeTd = document.createElement('td');
            scopeTd.className = 'px-6 py-4';
            
            const scopeContainer = document.createElement('div');
            scopeContainer.className = 'flex gap-4';

            let currentScopes = dataScopes;
            // Custom scopes for specific resources
            if (['orchestrator', 'knowledge', 'knowledge_graph'].includes(res.id)) {
                currentScopes = [
                    { value: 'all', label: '全部数据', warning: '“全部数据”包括所有操作数据权限，请谨慎选择' },
                    { value: 'dependent', label: '依赖对象中设置权限' }
                ];
            } else if (res.id === 'report_file') {
                currentScopes = [
                    { value: 'all', label: '全部数据', warning: '“全部数据”包括所有操作数据权限，请谨慎选择' }
                ];
            }

            currentScopes.forEach(scope => {
                const label = document.createElement('label');
                label.className = 'inline-flex items-center cursor-pointer';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `data_perm_${res.id}`;
                radio.value = scope.value;
                radio.className = 'form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500';

                const currentVal = currentDataPerms[res.id];
                if (currentVal === scope.value || (!currentVal && scope.value === 'all' && !['orchestrator', 'knowledge', 'knowledge_graph'].includes(res.id))) {
                    // Default to 'all' for normal resources if not set
                    radio.checked = true;
                } else if (!currentVal && ['orchestrator', 'knowledge', 'knowledge_graph'].includes(res.id) && scope.value === 'dependent') {
                    // Default to 'dependent' for special resources if not set (safer default)
                    radio.checked = true;
                } else if (!currentVal && scope.value === 'all') {
                     // Fallback default
                     radio.checked = true;
                }
                
                // Override check if explicit match
                if (currentVal === scope.value) {
                    radio.checked = true;
                }
                
                // Toggle Logic for Radio Buttons
                // Initialize state
                radio.dataset.wasChecked = radio.checked;
                radio.classList.add('transition-all', 'duration-200');

                const captureState = function() {
                     this.dataset.wasChecked = this.checked;
                };
                radio.addEventListener('mousedown', captureState);
                radio.addEventListener('keydown', function(e) {
                     if (e.key === ' ') captureState.call(this);
                });
                
                radio.addEventListener('click', function(e) {
                     // Standard radio behavior checks it before click event. 
                     // If it was checked (dataset.wasChecked), we uncheck it.
                     if (this.dataset.wasChecked === 'true') {
                         this.checked = false;
                         this.dataset.wasChecked = 'false';
                     } else {
                         this.dataset.wasChecked = 'true';
                     }
                });

                const span = document.createElement('span');
                span.className = 'ml-2 text-sm text-gray-700 flex items-center gap-1';
                span.textContent = scope.label;

                // Add warning tooltip if present
                if (scope.warning) {
                    const warnIcon = document.createElement('i');
                    warnIcon.className = 'fa-solid fa-circle-info text-gray-400 text-xs hover:text-orange-500 transition-colors ml-1';
                    warnIcon.title = scope.warning; // Simple tooltip
                    span.appendChild(warnIcon);
                }

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

    function createTreeList(nodes, currentPerms, level = 0, forceCheck = false) {
        const ul = document.createElement('ul');
        if (level === 0) {
             ul.className = 'tree-root space-y-1';
             ul.setAttribute('role', 'tree');
        } else {
             ul.className = 'tree-group pl-6 relative';
             ul.setAttribute('role', 'group');
        }

        const autoSelectExpandIds = [
            'knowledge', 
            'knowledge_graph', 
            'orchestrator',
            'knowledge.tags',
            'knowledge_graph.edit'
        ];

        nodes.forEach(node => {
            const li = document.createElement('li');
            li.className = 'tree-node relative';
            li.setAttribute('role', 'treeitem');
            
            const hasChildren = node.children && node.children.length > 0;
            const isAutoTarget = autoSelectExpandIds.includes(node.id);
            const shouldExpand = hasChildren && isAutoTarget;
            const effectiveForceCheck = forceCheck || isAutoTarget;
            const isChecked = currentPerms.includes('ALL') || currentPerms.includes(node.id) || effectiveForceCheck;
            
            if (hasChildren) {
                li.setAttribute('aria-expanded', String(shouldExpand));
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
                if (!shouldExpand) {
                     // Initial state: collapsed (-90deg)
                     const icon = expander.querySelector('i');
                     if(icon) icon.style.transform = 'rotate(-90deg)';
                }

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
            label.className = 'text-gray-700 text-sm font-medium truncate';
            if (!node.id.endsWith('.full_auth')) {
                label.classList.add('flex-1');
            }
            label.textContent = node.label;
            label.title = node.label; // Tooltip for truncation
            
            row.appendChild(expander);
            row.appendChild(checkbox);
            row.appendChild(label);

            // Warning for full_auth
            if (node.id.endsWith('.full_auth')) {
                const warning = document.createElement('span');
                warning.className = 'text-xs text-orange-500 ml-2 flex-1 truncate';
                warning.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1"></i>该选项拥有所有操作和数据权限，请谨慎选择';
                row.appendChild(warning);
            }
            
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
                const childrenContainer = createTreeList(node.children, currentPerms, level + 1, effectiveForceCheck);
                // Animation wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'tree-children-wrapper overflow-hidden transition-all duration-300 ease-in-out';
                
                if (shouldExpand) {
                    wrapper.style.maxHeight = '1000px'; 
                    wrapper.classList.remove('opacity-0');
                } else {
                    wrapper.style.maxHeight = '0px'; 
                    wrapper.classList.add('opacity-0');
                }

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
        handlePermissionChange: handlePermissionChange,
        testRadioToggle: function() {
            // Find a radio button (e.g., first one in data perms)
            const radio = document.querySelector('#data-perm-table-body input[type="radio"]');
            if (!radio) {
                console.warn('No radio button found for testing.');
                return;
            }

            console.group('Radio Toggle Test');
            console.log('Target Radio:', radio.name, radio.value);

            // Helper to simulate interaction
            const simulateClick = (el) => {
                el.dispatchEvent(new MouseEvent('mousedown'));
                el.click(); // This triggers click event
            };

            // 1. Initial State
            const initialState = radio.checked;
            console.log('Initial State:', initialState);

            // 2. First Click (Toggle)
            simulateClick(radio);
            const stateAfterClick1 = radio.checked;
            console.log('State after Click 1:', stateAfterClick1);

            if (initialState) {
                if (stateAfterClick1 === false) console.log('✅ PASS: Checked -> Unchecked');
                else console.error('❌ FAIL: Should be unchecked');
            } else {
                if (stateAfterClick1 === true) console.log('✅ PASS: Unchecked -> Checked');
                else console.error('❌ FAIL: Should be checked');
            }

            // 3. Second Click (Toggle Back)
            simulateClick(radio);
            const stateAfterClick2 = radio.checked;
            console.log('State after Click 2:', stateAfterClick2);
            
            if (stateAfterClick2 === initialState) console.log('✅ PASS: Toggled back to initial state');
            else console.error('❌ FAIL: State mismatch');

            console.groupEnd();
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