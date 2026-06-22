/**
 * User Management Logic
 */

(function() {
    let organizations = [
        { id: 'company', name: '示例科技公司', parentId: null, ownerId: 1 },
        { id: 'strategy', name: '战略运营部', parentId: 'company', ownerId: 2 },
        { id: 'city', name: '销售中心', parentId: 'company', ownerId: 9 },
        { id: 'property-bg', name: '客户成功中心', parentId: 'company', ownerId: 6 },
        { id: 'research', name: '产品中心', parentId: 'company', ownerId: 3 },
        { id: 'tech', name: '研发中心', parentId: 'company', ownerId: 4 },
        { id: 'info', name: '数字化中心', parentId: 'company', ownerId: 12 },
        { id: 'digital', name: '业务系统部', parentId: 'info', ownerId: 8 },
        { id: 'platform', name: '平台产品组', parentId: 'digital', ownerId: 8 },
        { id: 'data-team', name: '数据分析组', parentId: 'digital', ownerId: 12 },
        { id: 'testing', name: '质量保障部', parentId: 'tech', ownerId: 10 },
        { id: 'lab', name: '用户研究组', parentId: 'research', ownerId: 7 },
        { id: 'beijing', name: '华北销售组', parentId: 'city', ownerId: 11 },
        { id: 'shanghai', name: '华东销售组', parentId: 'city', ownerId: null }
    ];

    let users = [
        { id: 1, name: '员工一', phone: '13800000001', email: 'pm@vagent.ai', role: ['主管理员'], department: '示例科技公司', departmentId: 'company', status: 'normal', title: '总经理', employeeNo: '60001', managerId: null, accountType: '个人账号', joinDate: '2023-10-01' },
        { id: 2, name: '员工二', phone: '13900000002', email: 'chen@vagent.ai', role: ['主管理员'], department: '战略运营部', departmentId: 'strategy', status: 'normal', title: '运营负责人', employeeNo: '60021', managerId: 1, accountType: '个人账号', joinDate: '2023-11-15' },
        { id: 3, name: '员工三', phone: '13700000003', email: 'gu@vagent.ai', role: ['普通用户'], department: '产品中心', departmentId: 'research', status: 'normal', title: '产品负责人', employeeNo: '', managerId: 1, accountType: '个人账号', joinDate: '2023-12-01' },
        { id: 4, name: '员工四', phone: '13600000004', email: 'gu.luping@vagent.ai', role: ['管理员'], department: '研发中心', departmentId: 'tech', status: 'normal', title: '技术负责人', employeeNo: '', managerId: 1, accountType: '个人账号', joinDate: '2024-01-10' },
        { id: 5, name: '员工五', phone: '13500000005', email: 'zhou@vagent.ai', role: ['普通用户'], department: '业务系统部', departmentId: 'digital', status: 'normal', title: '产品经理', employeeNo: '63429', managerId: 8, accountType: '个人账号', joinDate: '2024-01-15' },
        { id: 6, name: '员工六', phone: '13400000006', email: 'lai@vagent.ai', role: ['普通用户'], department: '客户成功中心', departmentId: 'property-bg', status: 'normal', title: '客户成功经理', employeeNo: '70785', managerId: 1, accountType: '个人账号', joinDate: '2024-02-01' },
        { id: 7, name: '员工七', phone: '13300000007', email: 'wang@vagent.ai', role: ['普通用户'], department: '用户研究组', departmentId: 'lab', status: 'normal', title: '用户研究员', employeeNo: '70112', managerId: 3, accountType: '个人账号', joinDate: '2024-02-20' },
        { id: 8, name: '员工八', phone: '13200000008', email: 'james@vagent.ai', role: ['开发者'], department: '平台产品组', departmentId: 'platform', status: 'normal', title: '前端负责人', employeeNo: '70231', managerId: 4, accountType: '个人账号', joinDate: '2024-03-05' },
        { id: 9, name: '员工九', phone: '13100000009', email: 'olivia@vagent.ai', role: ['管理员'], department: '销售中心', departmentId: 'city', status: 'normal', title: '销售负责人', employeeNo: '70562', managerId: 1, accountType: '个人账号', joinDate: '2024-03-10' },
        { id: 10, name: '员工十', phone: '13000000010', email: 'william@vagent.ai', role: ['普通用户'], department: '质量保障部', departmentId: 'testing', status: 'normal', title: '测试工程师', employeeNo: '70619', managerId: 4, accountType: '个人账号', joinDate: '2024-03-15' },
        { id: 11, name: '员工十一', phone: '13800000011', email: 'sophia@vagent.ai', role: ['普通用户'], department: '华北销售组', departmentId: 'beijing', status: 'locked', title: '区域销售', employeeNo: '70688', managerId: 9, accountType: '个人账号', joinDate: '2024-03-20' },
        { id: 12, name: '员工十二', phone: '13900000012', email: 'robert@vagent.ai', role: ['开发者'], department: '数字化中心', departmentId: 'info', status: 'normal', title: '运维工程师', employeeNo: '70701', managerId: 4, accountType: '个人账号', joinDate: '2024-04-01' },
        { id: 13, name: '员工十三', phone: '13800000013', email: 'data01@vagent.ai', role: ['普通用户'], department: '数据分析组', departmentId: 'data-team', status: 'normal', title: '数据分析师', employeeNo: '70713', managerId: 12, accountType: '个人账号', joinDate: '2024-04-12' },
        { id: 14, name: '员工十四', phone: '13800000014', email: 'data02@vagent.ai', role: ['开发者'], department: '数据分析组', departmentId: 'data-team', status: 'normal', title: '数据工程师', employeeNo: '70714', managerId: 12, accountType: '个人账号', joinDate: '2024-04-18' },
        { id: 15, name: '员工十五', phone: '13800000015', email: 'sales.east@vagent.ai', role: ['普通用户'], department: '华东销售组', departmentId: 'shanghai', status: 'normal', title: '区域销售', employeeNo: '70715', managerId: 9, accountType: '个人账号', joinDate: '2024-05-06' }
    ];

    let currentEditingId = null;
    let selectedOrgId = 'company';
    let editingDepartmentId = null;
    let collapsedOrgIds = new Set();

    window.getAllUsers = function() {
        return users;
    };

    window.getAllDepartments = function() {
        return organizations.map(org => org.name);
    };

    document.addEventListener('view-loaded', (e) => {
        if (e.detail.view === 'user-mgmt') {
            initUserMgmt();
        }
    });

    function initUserMgmt() {
        selectedOrgId = localStorage.getItem('userMgmtSelectedOrg') || 'company';
        collapsedOrgIds = new Set(JSON.parse(localStorage.getItem('userMgmtCollapsedOrgs') || '[]'));
        restoreFilters();
        renderDepartmentOptions();
        renderOrgTree();
        renderUserTable();
        setupEventListeners();
        setupSmartContactInput();
        setupRoleSelect();
        updateBatchSelectedCount();
    }

    function setupEventListeners() {
        const orgSearch = document.getElementById('org-search-input');
        if (orgSearch) {
            orgSearch.addEventListener('input', renderUserTable);
            orgSearch.addEventListener('input', renderOrgTree);
            orgSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') renderUserTable();
            });
        }

        ['user-role-filter', 'user-status-filter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => {
                persistFilters();
                renderUserTable();
            });
        });

        const selectAll = document.getElementById('select-all-users');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                document.querySelectorAll('.user-row-check').forEach(cb => cb.checked = selectAll.checked);
                updateBatchSelectedCount();
            });
        }

        if (!document.body.dataset.userMgmtBatchMenuBound) {
            document.body.dataset.userMgmtBatchMenuBound = 'true';
            document.addEventListener('click', (e) => {
                const dropdown = document.getElementById('batch-actions-dropdown');
                if (!dropdown || !dropdown.open) return;
                if (!e.target.closest('#batch-actions-dropdown')) dropdown.removeAttribute('open');
            });
        }
    }

    function setupRoleSelect() {
        const roleSelect = document.getElementById('user-role');
        if (!roleSelect || roleSelect.dataset.bound === 'true') return;
        roleSelect.dataset.bound = 'true';
        roleSelect.addEventListener('change', () => hideError('user-role-error'));
    }

    function setupSmartContactInput() {
        const combinedInput = document.getElementById('user-combined-contact');
        if (!combinedInput || combinedInput.dataset.bound === 'true') return;
        combinedInput.dataset.bound = 'true';
        combinedInput.addEventListener('input', function() {
            const val = this.value.trim();
            if (!val) {
                hideError('user-combined-contact-error');
                return;
            }
            const isPhone = /^\d+$/.test(val);
            const isEmail = val.includes('@');
            if (isPhone && val.length > 11) {
                showError('user-combined-contact-error', '手机号格式错误（长度过长）');
            } else if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                showError('user-combined-contact-error', '邮箱格式错误');
            } else if (!isPhone && !isEmail) {
                showError('user-combined-contact-error', '请输入有效的手机号或邮箱');
            } else {
                hideError('user-combined-contact-error');
            }
        });
    }

    function persistFilters() {
        const params = {
            role: document.getElementById('user-role-filter')?.value || '所有角色',
            status: document.getElementById('user-status-filter')?.value || '所有状态'
        };
        localStorage.setItem('userMgmtFilters', JSON.stringify(params));
    }

    function restoreFilters() {
        try {
            const saved = localStorage.getItem('userMgmtFilters');
            if (!saved) return;
            const params = JSON.parse(saved);
            if (document.getElementById('user-role-filter')) document.getElementById('user-role-filter').value = params.role || '所有角色';
            if (document.getElementById('user-status-filter')) document.getElementById('user-status-filter').value = params.status || '所有状态';
        } catch (e) {
            console.error('Failed to restore filters', e);
        }
    }

    function getRoleDisplayName(role) {
        return role === '普通用户' ? '普通用户（无登录权限）' : role;
    }

    function getRoleDisplayText(roles) {
        return (Array.isArray(roles) ? roles : [roles])
            .filter(Boolean)
            .map(getRoleDisplayName)
            .join('、');
    }

    function getOrgById(id) {
        return organizations.find(org => org.id === id);
    }

    function getOrgChildren(parentId) {
        return organizations.filter(org => org.parentId === parentId);
    }

    function getDescendantOrgIds(orgId) {
        const ids = [orgId];
        getOrgChildren(orgId).forEach(child => {
            ids.push(...getDescendantOrgIds(child.id));
        });
        return ids;
    }

    function getOrgPath(orgId) {
        const names = [];
        let current = getOrgById(orgId);
        while (current) {
            names.unshift(current.name);
            current = getOrgById(current.parentId);
        }
        return names.join(' / ');
    }

    function getOrgMemberCount(orgId) {
        const ids = getDescendantOrgIds(orgId);
        return users.filter(user => ids.includes(user.departmentId)).length;
    }

    function getDirectOrgMemberCount(orgId) {
        return users.filter(user => user.departmentId === orgId).length;
    }

    function getOwnerName(ownerId) {
        const owner = users.find(user => user.id === ownerId);
        return owner ? owner.name : '未指定';
    }

    function isDescendantOrg(candidateId, parentId) {
        if (!candidateId || !parentId) return false;
        let current = getOrgById(candidateId);
        while (current) {
            if (current.parentId === parentId) return true;
            current = getOrgById(current.parentId);
        }
        return false;
    }

    function getManagerName(managerId) {
        const manager = users.find(user => user.id === managerId);
        return manager ? manager.name : '-';
    }

    function renderOrgTree() {
        const tree = document.getElementById('org-tree');
        if (!tree) return;
        const keyword = (document.getElementById('org-search-input')?.value || '').trim().toLowerCase();
        const esc = window.escapeHtml || function(s) { return String(s == null ? '' : s); };

        function matchesOrg(org) {
            if (!keyword) return true;
            const nameMatch = org.name.toLowerCase().includes(keyword);
            const memberMatch = users.some(user => user.departmentId === org.id && (
                user.name.toLowerCase().includes(keyword) ||
                (user.email || '').toLowerCase().includes(keyword) ||
                (user.role || []).join(' ').toLowerCase().includes(keyword) ||
                getRoleDisplayText(user.role).toLowerCase().includes(keyword)
            ));
            const childMatch = getOrgChildren(org.id).some(matchesOrg);
            return nameMatch || memberMatch || childMatch;
        }

        function renderNode(org, level) {
            if (!matchesOrg(org)) return '';
            const orgChildren = getOrgChildren(org.id);
            const hasChildren = orgChildren.length > 0;
            const isCollapsed = hasChildren && collapsedOrgIds.has(org.id) && !keyword;
            const children = isCollapsed ? '' : orgChildren.map(child => renderNode(child, level + 1)).join('');
            const isActive = selectedOrgId === org.id;
            const count = getOrgMemberCount(org.id);
            const toggleButton = hasChildren
                ? `<button type="button" onclick="toggleOrganization('${org.id}', event)" class="w-5 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 flex-shrink-0" aria-label="${isCollapsed ? '展开' : '折叠'}${esc(org.name)}">
                        <span class="org-toggle-caret ${isCollapsed ? '' : 'org-toggle-caret-expanded'}"></span>
                   </button>`
                : `<span class="w-5 h-8 flex-shrink-0"></span>`;
            return `
                <div class="group/org">
                    <div class="w-full flex items-center gap-1 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-white hover:text-blue-600'}">
                        <div class="flex items-center flex-shrink-0" style="padding-left:${8 + level * 16}px">
                            ${toggleButton}
                        </div>
                        <button type="button" onclick="selectOrganization('${org.id}')" class="min-w-0 flex-1 flex items-center gap-2 pr-3 py-2 text-left">
                            <span class="flex-1 min-w-0 truncate text-sm font-medium" title="${esc(getOrgPath(org.id))}">${esc(org.name)}</span>
                            <span class="text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}">${count}人</span>
                        </button>
                        <div class="flex items-center pr-1 opacity-0 group-hover/org:opacity-100 transition-opacity">
                            <button type="button" onclick="addChildDepartment('${org.id}')" class="w-6 h-6 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="添加子部门">
                                <i class="fa-solid fa-plus text-xs"></i>
                            </button>
                            <button type="button" onclick="openDepartmentModal('${org.id}')" class="w-6 h-6 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="编辑部门">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                        </div>
                    </div>
                    ${children ? `<div class="mt-1 space-y-1">${children}</div>` : ''}
                </div>
            `;
        }

        const root = getOrgById('company') || organizations[0];
        tree.innerHTML = renderNode(root, 0);
    }

    window.toggleOrganization = function(orgId, event) {
        if (event) event.stopPropagation();
        if (collapsedOrgIds.has(orgId)) {
            collapsedOrgIds.delete(orgId);
        } else {
            collapsedOrgIds.add(orgId);
        }
        localStorage.setItem('userMgmtCollapsedOrgs', JSON.stringify(Array.from(collapsedOrgIds)));
        renderOrgTree();
    };

    window.selectOrganization = function(orgId) {
        selectedOrgId = orgId;
        localStorage.setItem('userMgmtSelectedOrg', orgId);
        renderOrgTree();
        renderUserTable();
    };

    window.syncOrganizationFromThirdParty = function() {
        const button = document.getElementById('sync-org-button');
        if (button?.dataset.syncing === 'true') return;
        const originalHtml = button ? button.innerHTML : '';
        if (button) {
            button.dataset.syncing = 'true';
            button.disabled = true;
            button.classList.add('opacity-70', 'cursor-not-allowed');
            button.innerHTML = '<i class="fa-solid fa-rotate fa-spin mr-2 text-blue-500"></i>同步中';
        }
        showToast('正在同步第三方组织架构...', 'info');
        setTimeout(() => {
            renderDepartmentOptions();
            renderOrgTree();
            renderUserTable();
            if (button) {
                button.innerHTML = originalHtml;
                button.disabled = false;
                button.dataset.syncing = 'false';
                button.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            showToast('第三方组织架构已同步到平台', 'success');
            logOperation('同步组织架构', '从第三方组织架构同步部门与成员数据');
        }, 800);
    };

    function getFilteredUsers() {
        const keyword = (document.getElementById('org-search-input')?.value || '').trim().toLowerCase();
        const selectedRole = document.getElementById('user-role-filter')?.value || '所有角色';
        const selectedStatus = document.getElementById('user-status-filter')?.value || '所有状态';
        const visibleOrgIds = getDescendantOrgIds(selectedOrgId);

        return users.filter(user => {
            const roles = Array.isArray(user.role) ? user.role : [user.role];
            const orgPath = getOrgPath(user.departmentId).toLowerCase();
            const matchesOrg = visibleOrgIds.includes(user.departmentId);
            const matchesKeyword = !keyword ||
                user.name.toLowerCase().includes(keyword) ||
                (user.email || '').toLowerCase().includes(keyword) ||
                (user.phone || '').includes(keyword) ||
                (user.title || '').toLowerCase().includes(keyword) ||
                roles.join(' ').toLowerCase().includes(keyword) ||
                getRoleDisplayText(roles).toLowerCase().includes(keyword) ||
                orgPath.includes(keyword);
            const matchesRole = selectedRole === '所有角色' || roles.includes(selectedRole);
            const matchesStatus = selectedStatus === '所有状态' || user.status === selectedStatus;
            return matchesOrg && matchesKeyword && matchesRole && matchesStatus;
        });
    }

    function renderUserTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        const esc = window.escapeHtml || function(s) { return String(s == null ? '' : s); };
        const filteredUsers = getFilteredUsers();
        const org = getOrgById(selectedOrgId);
        const currentTitle = document.getElementById('current-org-title');
        const currentCount = document.getElementById('current-org-count');

        if (currentTitle) currentTitle.textContent = org ? org.name : '全部成员';
        if (currentCount) currentCount.textContent = `${getOrgMemberCount(selectedOrgId)}人`;

        tbody.innerHTML = '';
        const selectAll = document.getElementById('select-all-users');
        if (selectAll) selectAll.checked = false;
        updateBatchSelectedCount();

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-10 text-center text-gray-400">暂无成员数据</td></tr>`;
            if (window.syncDataTable) window.syncDataTable('user-data-table', { storageKey: 'dt-colwidths-users-org' });
            return;
        }

        filteredUsers.forEach(user => {
            const roles = Array.isArray(user.role) ? user.role : [user.role];
            const roleDisplay = getRoleDisplayText(roles);
            const initials = user.name.substring(0, 2).toUpperCase();
            const avatarColor = user.status === 'normal' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500';
            const statusBadge = getStatusBadge(user.status);
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 group transition-colors';
            tr.innerHTML = `
                <td class="px-4 py-3"><input type="checkbox" class="user-row-check w-4 h-4 text-blue-600 border-gray-300 rounded" value="${user.id}"></td>
                <td class="px-4 py-3 min-w-[160px]">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg ${avatarColor} flex items-center justify-center font-bold text-xs flex-shrink-0">${esc(initials)}</div>
                        <div class="min-w-0 flex-1">
                            <p class="font-medium text-gray-900 dt-cell-ellipsis" title="${esc(user.name)}">${esc(user.name)}</p>
                            <p class="text-xs text-gray-400 dt-cell-ellipsis" title="${esc(roleDisplay || '-')}">${esc(roleDisplay || '-')}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap"><span class="inline-flex px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">${esc(roleDisplay || '-')}</span></td>
                <td class="px-4 py-3 whitespace-nowrap">${statusBadge}</td>
                <td class="px-4 py-3 min-w-[180px]"><span class="dt-cell-ellipsis inline-block max-w-full" title="${esc(getOrgPath(user.departmentId))}">${esc(getOrgPath(user.departmentId))}</span></td>
                <td class="px-4 py-3 text-gray-700 whitespace-nowrap">${esc(user.title || '-')}</td>
                <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${esc(user.employeeNo || '-')}</td>
                <td class="px-4 py-3 text-gray-600 whitespace-nowrap">${esc(user.phone || '-')}</td>
                <td class="px-4 py-3 text-gray-600 min-w-[180px]"><span class="dt-cell-ellipsis" title="${esc(user.email || '-')}">${esc(user.email || '-')}</span></td>
                <td class="px-4 py-3 text-right min-w-[132px] action-td"></td>
            `;
            tbody.appendChild(tr);

            const actionsTd = tr.querySelector('.action-td');
            const statusLabel = user.status === 'normal' ? '停用' : '激活';
            const newStatus = user.status === 'normal' ? 'locked' : 'normal';
            const actions = [
                { label: '编辑', onClick: () => openEditUserModal(user.id) },
                { label: statusLabel, className: user.status === 'normal' ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800', onClick: () => changeUserStatus(user.id, newStatus) },
                { label: '删除', className: 'text-red-600 hover:text-red-800', onClick: () => deleteUser(user.id) }
            ];
            const container = document.createElement('div');
            container.className = 'flex items-center justify-end gap-3';
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors ${action.className || ''}`;
                btn.textContent = action.label;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    action.onClick();
                };
                container.appendChild(btn);
            });
            actionsTd.appendChild(container);
        });

        document.querySelectorAll('.user-row-check').forEach(cb => {
            cb.addEventListener('change', updateBatchSelectedCount);
        });
        updateBatchSelectedCount();

        if (window.syncDataTable) window.syncDataTable('user-data-table', { storageKey: 'dt-colwidths-users-org' });
    }

    window.renderUserTable = renderUserTable;

    function getStatusBadge(status) {
        if (status === 'normal') {
            return '<span class="inline-flex items-center gap-1 text-gray-700"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>正常</span>';
        }
        if (status === 'locked') {
            return '<span class="inline-flex items-center gap-1 text-orange-600"><span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span>锁定</span>';
        }
        return '<span class="inline-flex items-center gap-1 text-gray-500"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>离职</span>';
    }

    function renderDepartmentOptions() {
        const departmentSelect = document.getElementById('user-department');
        const parentSelect = document.getElementById('department-parent');
        const esc = window.escapeHtml || function(s) { return String(s == null ? '' : s); };

        const optionHtml = organizations.map(org => `<option value="${org.id}">${esc(getOrgPath(org.id))}</option>`).join('');
        if (departmentSelect) departmentSelect.innerHTML = `<option value="">请选择所属部门</option>${optionHtml}`;
        if (parentSelect) parentSelect.innerHTML = optionHtml;

    }

    window.openAddUserModal = function() {
        currentEditingId = null;
        document.getElementById('user-form')?.reset();
        renderDepartmentOptions();
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) roleSelect.value = '普通用户';
        const statusSelect = document.getElementById('user-status');
        if (statusSelect) statusSelect.value = 'normal';
        document.querySelectorAll('.error-msg').forEach(el => el.classList.add('hidden'));
        document.getElementById('user-modal-title').textContent = '新增成员';
        document.getElementById('user-password-field').classList.remove('hidden');
        document.getElementById('user-contact-add-group').classList.remove('hidden');
        document.getElementById('user-contact-edit-group').classList.remove('hidden');
        const dept = document.getElementById('user-department');
        if (dept) dept.value = selectedOrgId || 'company';
        openModal('user-modal');
    };

    window.openEditUserModal = function(id) {
        currentEditingId = id;
        const user = users.find(u => u.id === id);
        if (!user) return;
        renderDepartmentOptions();
        document.getElementById('user-form')?.reset();
        document.getElementById('user-name').value = user.name || '';
        document.getElementById('user-department').value = user.departmentId || '';
        document.getElementById('user-title').value = user.title || '';
        document.getElementById('user-employee-no').value = user.employeeNo || '';
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-email').value = user.email || '';

        const userRoles = Array.isArray(user.role) ? user.role : [user.role];
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) roleSelect.value = userRoles.filter(Boolean)[0] || '普通用户';
        const statusSelect = document.getElementById('user-status');
        if (statusSelect) statusSelect.value = user.status || 'normal';
        document.querySelectorAll('.error-msg').forEach(el => el.classList.add('hidden'));
        document.getElementById('user-modal-title').textContent = '编辑成员';
        document.getElementById('user-password-field').classList.add('hidden');
        document.getElementById('user-contact-add-group').classList.add('hidden');
        document.getElementById('user-contact-edit-group').classList.remove('hidden');
        openModal('user-modal');
    };

    window.saveUser = function() {
        const name = document.getElementById('user-name').value.trim();
        const departmentId = document.getElementById('user-department').value;
        const departmentOrg = getOrgById(departmentId);
        const title = document.getElementById('user-title').value.trim();
        const employeeNo = document.getElementById('user-employee-no').value.trim();
        const selectedRole = document.getElementById('user-role').value;
        const selectedRoles = selectedRole ? [selectedRole] : [];
        const status = document.getElementById('user-status')?.value || 'normal';
        const password = document.getElementById('user-password').value;
        const phone = document.getElementById('user-phone').value.trim();
        const email = document.getElementById('user-email').value.trim();
        let isValid = true;

        if (!name) {
            showError('user-name-error', '请输入姓名');
            isValid = false;
        } else {
            hideError('user-name-error');
        }

        if (!departmentOrg) {
            showError('user-department-error', '请选择所属部门');
            isValid = false;
        } else {
            hideError('user-department-error');
        }

        if (selectedRoles.length === 0) {
            showError('user-role-error', '请至少选择一个角色');
            isValid = false;
        } else {
            hideError('user-role-error');
        }

        if (!phone && !email) {
            showError('user-phone-error', '手机号或邮箱至少填写一项');
            isValid = false;
        } else {
            hideError('user-phone-error');
            hideError('user-email-error');
            if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
                showError('user-phone-error', '手机号格式不正确');
                isValid = false;
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showError('user-email-error', '邮箱格式不正确');
                isValid = false;
            }
        }

        let loginAccount = '';
        if (!currentEditingId) {
            const combinedVal = document.getElementById('user-combined-contact').value.trim();
            loginAccount = combinedVal;
            if (!combinedVal) {
                showError('user-combined-contact-error', '请输入手机号或邮箱');
                isValid = false;
            } else if (/^1[3-9]\d{9}$/.test(combinedVal)) {
                hideError('user-combined-contact-error');
            } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(combinedVal)) {
                hideError('user-combined-contact-error');
            } else {
                showError('user-combined-contact-error', '格式不正确，请输入有效的手机号或邮箱');
                isValid = false;
            }

            if (!password) {
                showError('user-password-error', '请输入密码');
                isValid = false;
            } else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
                showError('user-password-error', '密码需至少8位，包含字母和数字');
                isValid = false;
            } else {
                hideError('user-password-error');
            }
        }

        if (!isValid) return;

        if (currentEditingId) {
            const userIndex = users.findIndex(u => u.id === currentEditingId);
            if (userIndex > -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    name,
                    department: departmentOrg.name,
                    departmentId,
                    title,
                    employeeNo,
                    phone,
                    email,
                    role: selectedRoles,
                    status
                };
                showToast('成员更新成功', 'success');
                logOperation('更新成员', `更新了成员 ${name} 的组织关系与基础信息`);
            }
        } else {
            users.unshift({
                id: Date.now(),
                name,
                department: departmentOrg.name,
                departmentId,
                title,
                employeeNo: employeeNo || String(Date.now()).slice(-6),
                phone,
                email,
                loginAccount,
                role: selectedRoles,
                password,
                status,
                joinDate: new Date().toISOString().split('T')[0]
            });
            showToast('成员创建成功', 'success');
            logOperation('新增成员', `创建了新成员 ${name}，所属部门：${departmentOrg.name}`);
        }

        closeModal('user-modal');
        renderDepartmentOptions();
        renderOrgTree();
        renderUserTable();
    };

    window.changeUserStatus = function(id, newStatus) {
        const user = users.find(u => u.id === id);
        if (!user) return;
        const actionText = newStatus === 'normal' ? '激活' : '停用';
        if (confirm(`确定要将成员 "${user.name}" ${actionText}吗？`)) {
            user.status = newStatus;
            renderUserTable();
            showToast(`成员已${actionText}`, 'success');
            logOperation('修改状态', `将成员 ${user.name} 状态修改为 ${actionText}`);
        }
    };

    function deleteUser(id) {
        const user = users.find(u => u.id === id);
        if (!user) return;
        if (confirm(`确定要删除成员 "${user.name}" 吗？`)) {
            users = users.filter(u => u.id !== id);
            organizations.forEach(org => {
                if (org.ownerId === id) org.ownerId = null;
            });
            renderDepartmentOptions();
            renderOrgTree();
            renderUserTable();
            showToast('成员已删除', 'success');
        }
    }

    window.addChildDepartment = function(parentId) {
        selectedOrgId = parentId || selectedOrgId || 'company';
        collapsedOrgIds.delete(selectedOrgId);
        localStorage.setItem('userMgmtCollapsedOrgs', JSON.stringify(Array.from(collapsedOrgIds)));
        localStorage.setItem('userMgmtSelectedOrg', selectedOrgId);
        renderOrgTree();
        renderUserTable();
        openDepartmentModal();
    };

    window.openDepartmentModal = function(departmentId, editCurrent) {
        editingDepartmentId = editCurrent ? selectedOrgId : (departmentId || null);
        renderDepartmentOptions();
        document.getElementById('department-form')?.reset();
        document.querySelectorAll('.error-msg').forEach(el => el.classList.add('hidden'));
        const title = document.getElementById('department-modal-title');
        const nameInput = document.getElementById('department-name');
        const parentSelect = document.getElementById('department-parent');

        if (editingDepartmentId) {
            const org = getOrgById(editingDepartmentId);
            if (!org) return;
            title.textContent = '编辑部门';
            nameInput.value = org.name;
            parentSelect.value = org.parentId || org.id;
            parentSelect.disabled = org.id === 'company';
            Array.from(parentSelect.options).forEach(option => {
                option.disabled = option.value === org.id || isDescendantOrg(option.value, org.id);
            });
        } else {
            title.textContent = '添加子部门';
            nameInput.value = '';
            parentSelect.value = selectedOrgId || 'company';
            parentSelect.disabled = false;
            Array.from(parentSelect.options).forEach(option => {
                option.disabled = false;
            });
        }

        openModal('department-modal');
    };

    window.saveDepartment = function() {
        const name = document.getElementById('department-name').value.trim();
        const parentId = document.getElementById('department-parent').value;

        if (!name) {
            showError('department-name-error', '请输入部门名称');
            return;
        }

        if (!parentId || !getOrgById(parentId)) {
            showError('department-name-error', '请选择有效的上级部门');
            return;
        }

        if (editingDepartmentId && (parentId === editingDepartmentId || isDescendantOrg(parentId, editingDepartmentId))) {
            showError('department-name-error', '上级部门不能选择当前部门或其下级部门');
            return;
        }

        const duplicate = organizations.some(org =>
            org.id !== editingDepartmentId &&
            org.parentId === parentId &&
            org.name.trim() === name
        );
        if (duplicate) {
            showError('department-name-error', '同一上级下已存在同名部门');
            return;
        }
        hideError('department-name-error');

        if (editingDepartmentId) {
            const org = getOrgById(editingDepartmentId);
            if (org) {
                org.name = name;
                if (org.id !== 'company') org.parentId = parentId;
                users.forEach(user => {
                    if (user.departmentId === org.id) user.department = org.name;
                });
                showToast('部门已更新', 'success');
            }
        } else {
            const id = `org-${Date.now()}`;
            organizations.push({ id, name, parentId, ownerId: null });
            selectedOrgId = id;
            collapsedOrgIds.delete(parentId);
            localStorage.setItem('userMgmtSelectedOrg', selectedOrgId);
            localStorage.setItem('userMgmtCollapsedOrgs', JSON.stringify(Array.from(collapsedOrgIds)));
            showToast('部门已添加', 'success');
        }

        closeModal('department-modal');
        renderDepartmentOptions();
        renderOrgTree();
        renderUserTable();
    };

    function getSelectedUserIds() {
        return Array.from(document.querySelectorAll('.user-row-check:checked')).map(cb => Number(cb.value));
    }

    function closeBatchActionsMenu() {
        document.getElementById('batch-actions-dropdown')?.removeAttribute('open');
    }

    function updateBatchSelectedCount() {
        const count = getSelectedUserIds().length;
        const badge = document.getElementById('batch-selected-count');
        if (!badge) return;
        badge.textContent = String(count);
        badge.classList.toggle('hidden', count === 0);
    }

    window.batchUpdateUserStatus = function(newStatus) {
        closeBatchActionsMenu();
        const selectedIds = getSelectedUserIds();
        const actionText = newStatus === 'normal' ? '启用' : '停用';
        if (selectedIds.length === 0) {
            showToast(`请先选择需要${actionText}的成员`, 'warning');
            return;
        }
        if (!confirm(`确定${actionText}已选 ${selectedIds.length} 位成员吗？`)) return;
        users.forEach(user => {
            if (selectedIds.includes(user.id)) user.status = newStatus;
        });
        renderUserTable();
        showToast(`已${actionText} ${selectedIds.length} 位成员`, 'success');
        logOperation(`批量${actionText}`, `批量${actionText} ${selectedIds.length} 位成员`);
    };

    window.batchDeleteUsers = function() {
        closeBatchActionsMenu();
        const selectedIds = getSelectedUserIds();
        if (selectedIds.length === 0) {
            showToast('请先选择需要删除的成员', 'warning');
            return;
        }
        if (!confirm(`删除后不可恢复，确定删除已选 ${selectedIds.length} 位成员吗？`)) return;
        users = users.filter(user => !selectedIds.includes(user.id));
        organizations.forEach(org => {
            if (selectedIds.includes(org.ownerId)) org.ownerId = null;
        });
        renderDepartmentOptions();
        renderOrgTree();
        renderUserTable();
        showToast(`已删除 ${selectedIds.length} 位成员`, 'success');
        logOperation('批量删除成员', `批量删除 ${selectedIds.length} 位成员`);
    };

    window.batchExportUsers = function() {
        closeBatchActionsMenu();
        const selectedIds = getSelectedUserIds();
        const exportUsers = selectedIds.length
            ? users.filter(user => selectedIds.includes(user.id))
            : getFilteredUsers();
        if (exportUsers.length === 0) {
            showToast('当前没有可导出的成员', 'warning');
            return;
        }
        const rows = [
            ['姓名', '角色', '账号状态', '所属部门', '职位', '工号', '手机号', '邮箱'],
            ...exportUsers.map(user => [
                user.name,
                getRoleDisplayText(user.role),
                user.status === 'normal' ? '正常' : (user.status === 'locked' ? '锁定' : '离职'),
                getOrgPath(user.departmentId),
                user.title || '',
                user.employeeNo || '',
                user.phone || '',
                user.email || ''
            ])
        ];
        const csv = rows.map(row => row.map(cell => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = selectedIds.length ? '已选成员导出.csv' : '当前成员列表导出.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`已导出 ${exportUsers.length} 位成员`, 'success');
    };

    window.openBatchImportModal = function() {
        closeBatchActionsMenu();
        const input = document.getElementById('batch-import-file');
        const info = document.getElementById('batch-import-file-info');
        if (input) input.value = '';
        if (info) {
            info.textContent = '';
            info.classList.add('hidden');
        }
        openModal('batch-import-modal');
    };

    window.downloadUserImportTemplate = function() {
        const rows = [
            ['姓名', '登录账号', '所属部门', '角色', '职位', '工号'],
            ['员工示例', 'sample@vagent.ai', getOrgPath(selectedOrgId || 'company'), '普通用户（无登录权限）', '产品经理', '80001']
        ];
        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '成员批量导入模板.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('模板已下载', 'success');
    };

    window.handleBatchImportFileChange = function(input) {
        const file = input.files && input.files[0];
        const info = document.getElementById('batch-import-file-info');
        if (!info) return;
        if (!file) {
            info.textContent = '';
            info.classList.add('hidden');
            return;
        }
        const sizeKb = Math.max(1, Math.round(file.size / 1024));
        info.innerHTML = `<i class="fa-solid fa-file-lines text-blue-500 mr-2"></i>已选择：${file.name}（${sizeKb} KB）`;
        info.classList.remove('hidden');
    };

    window.confirmBatchImport = function() {
        const input = document.getElementById('batch-import-file');
        const file = input && input.files && input.files[0];
        if (!file) {
            showToast('请先上传成员文件', 'warning');
            return;
        }
        closeModal('batch-import-modal');
        showToast(`已读取 ${file.name}，导入校验功能可继续接入后端接口。`, 'success');
    };

    window.openBatchUserActions = function() {
        const dropdown = document.getElementById('batch-actions-dropdown');
        if (dropdown) dropdown.open = !dropdown.open;
    };

    window.executeUserSearch = function() {
        persistFilters();
        renderUserTable();
        renderOrgTree();
    };

    function showError(elementId, msg) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    function hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.add('hidden');
    }

    function logOperation(action, detail) {
        console.log(`[LOG] ${new Date().toLocaleString()} - ${action}: ${detail}`);
    }

    if (!window.showToast) {
        window.showToast = function(message) { alert(message); };
    }
})();
