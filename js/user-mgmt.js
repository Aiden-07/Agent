/**
 * User Management Logic
 */

(function() {
    // Mock Data
    let users = [
        { id: 1, name: 'Product Manager', phone: '13800000001', email: 'pm@vagent.ai', role: '管理员', status: 'normal', joinDate: '2023-10-01' },
        { id: 2, name: 'John Doe', phone: '13900000002', email: 'john@vagent.ai', role: '开发者', status: 'normal', joinDate: '2023-11-15' },
        { id: 3, name: 'Alice Smith', phone: '13700000003', email: 'alice@vagent.ai', role: '普通用户', status: 'resigned', joinDate: '2023-12-01' }
    ];

    let currentEditingId = null;

    // Listen for view load
    document.addEventListener('view-loaded', (e) => {
        if (e.detail.view === 'user-mgmt') {
            initUserMgmt();
        }
    });

    function initUserMgmt() {
        renderUserTable();
        setupEventListeners();
        setupSmartContactInput();
    }

    function setupEventListeners() {
        // Search
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderUserTable(e.target.value);
            });
        }
        
        // Role Filter
        const roleFilter = document.getElementById('user-role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => {
                renderUserTable(searchInput ? searchInput.value : '');
            });
        }
    }

    function setupSmartContactInput() {
        const combinedInput = document.getElementById('user-combined-contact');
        if (combinedInput) {
            combinedInput.addEventListener('input', function() {
                const val = this.value.trim();
                const errorEl = document.getElementById('user-combined-contact-error');
                
                if (!val) {
                    errorEl.classList.add('hidden');
                    return;
                }

                // Check if Phone
                const isPhone = /^\d+$/.test(val);
                // Check if Email (contains @)
                const isEmail = val.includes('@');

                if (isPhone) {
                    if (!/^1[3-9]\d{9}$/.test(val)) {
                         if (val.length > 11) {
                            showError('user-combined-contact-error', '手机号格式错误（长度过长）');
                         } else if (val.length === 11) {
                            // Valid length, maybe invalid prefix?
                             hideError('user-combined-contact-error'); // Optimistic
                         } else {
                             // Typing...
                             hideError('user-combined-contact-error');
                         }
                    } else {
                        hideError('user-combined-contact-error');
                    }
                } else if (isEmail) {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                        showError('user-combined-contact-error', '邮箱格式错误');
                    } else {
                        hideError('user-combined-contact-error');
                    }
                } else {
                    // Neither
                    if (val.length > 0) {
                         showError('user-combined-contact-error', '请输入有效的手机号或邮箱');
                    }
                }
            });
        }
    }

    function renderUserTable(searchTerm = '') {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;

        const roleFilter = document.getElementById('user-role-filter');
        const selectedRole = roleFilter ? roleFilter.value : '所有角色';

        tbody.innerHTML = '';

        const filteredUsers = users.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                  (user.phone && user.phone.includes(searchTerm));
            const matchesRole = selectedRole === '所有角色' || user.role === selectedRole;
            return matchesSearch && matchesRole;
        });

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">暂无用户数据</td></tr>`;
            return;
        }

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 group transition-colors';
            
            // Status Badge
            let statusBadge = '';
            if (user.status === 'normal') {
                statusBadge = '<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">正常</span>';
            } else {
                statusBadge = '<span class="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium">离职</span>';
            }

            // Avatar Initials
            const initials = user.name.substring(0, 2).toUpperCase();
            const avatarColor = user.status === 'normal' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500';

            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-bold text-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="font-medium text-gray-800">${user.name}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-600">${user.phone || '-'}</td>
                <td class="px-6 py-4 text-gray-600">${user.email || '-'}</td>
                <td class="px-6 py-4">
                    <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">${user.role}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.openUserActions(event, ${user.id}, '${user.status}')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.openUserActions = function(event, id, status) {
        const statusLabel = status === 'normal' ? '离职' : '激活';
        const statusIcon = status === 'normal' ? 'fa-solid fa-ban' : 'fa-solid fa-check';
        const statusClass = status === 'normal' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50';
        const statusIconClass = status === 'normal' ? 'text-red-500' : 'text-green-500';
        const newStatus = status === 'normal' ? 'resigned' : 'normal';

        window.showActionMenu(event, [
            {
                label: '编辑',
                icon: 'fa-solid fa-pen',
                onClick: () => openEditUserModal(id)
            },
            {
                label: statusLabel,
                icon: statusIcon,
                className: statusClass,
                iconClass: statusIconClass,
                onClick: () => changeUserStatus(id, newStatus)
            }
        ]);
    }

    // Expose to window
    window.renderUserTable = renderUserTable;

    // --- Add User ---
    window.openAddUserModal = function() {
        currentEditingId = null;
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const passwordField = document.getElementById('user-password-field');
        const addGroup = document.getElementById('user-contact-add-group');
        const editGroup = document.getElementById('user-contact-edit-group');
        
        // Reset Form
        document.getElementById('user-form').reset();
        document.querySelectorAll('.error-msg').forEach(el => el.classList.add('hidden'));
        
        // UI State
        title.textContent = '新增用户';
        passwordField.classList.remove('hidden');
        addGroup.classList.remove('hidden');
        editGroup.classList.add('hidden');
        
        openModal('user-modal');
    };

    // --- Edit User ---
    window.openEditUserModal = function(id) {
        currentEditingId = id;
        const user = users.find(u => u.id === id);
        if (!user) return;

        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const passwordField = document.getElementById('user-password-field');
        const addGroup = document.getElementById('user-contact-add-group');
        const editGroup = document.getElementById('user-contact-edit-group');

        // Fill Form
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-role').value = user.role;
        
        document.querySelectorAll('.error-msg').forEach(el => el.classList.add('hidden'));

        // UI State
        title.textContent = '编辑用户';
        passwordField.classList.add('hidden');
        addGroup.classList.add('hidden');
        editGroup.classList.remove('hidden');

        openModal('user-modal');
    };

    // --- Save User (Add/Edit) ---
    window.saveUser = function() {
        const name = document.getElementById('user-name').value.trim();
        const role = document.getElementById('user-role').value;
        const password = document.getElementById('user-password').value;
        
        let phone = '';
        let email = '';

        // Validation
        let isValid = true;

        // Name
        if (!name) {
            showError('user-name-error', '请输入姓名');
            isValid = false;
        } else {
            hideError('user-name-error');
        }

        if (currentEditingId) {
            // Edit Mode (Split Fields)
            phone = document.getElementById('user-phone').value.trim();
            email = document.getElementById('user-email').value.trim();

            if (!phone && !email) {
                showError('user-phone-error', '手机号或邮箱至少填写一项'); // Show on phone field
                isValid = false;
            } else {
                hideError('user-phone-error');
                
                if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
                    showError('user-phone-error', '手机号格式不正确');
                    isValid = false;
                }
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    showError('user-email-error', '邮箱格式不正确');
                    isValid = false;
                }
            }

        } else {
            // Add Mode (Combined Field)
            const combinedVal = document.getElementById('user-combined-contact').value.trim();
            
            if (!combinedVal) {
                showError('user-combined-contact-error', '请输入手机号或邮箱');
                isValid = false;
            } else {
                const isPhone = /^1[3-9]\d{9}$/.test(combinedVal);
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(combinedVal);

                if (isPhone) {
                    phone = combinedVal;
                    hideError('user-combined-contact-error');
                } else if (isEmail) {
                    email = combinedVal;
                    hideError('user-combined-contact-error');
                } else {
                    showError('user-combined-contact-error', '格式不正确，请输入有效的手机号或邮箱');
                    isValid = false;
                }
            }
        }

        // Password (Only for Add)
        if (!currentEditingId) {
            if (!password) {
                showError('user-password-error', '请输入密码');
                isValid = false;
            } else {
                // Complexity: >= 8 chars, letters + numbers
                const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
                if (!passwordRegex.test(password)) {
                    showError('user-password-error', '密码需至少8位，包含字母和数字');
                    isValid = false;
                } else {
                    hideError('user-password-error');
                }
            }
        }

        if (!isValid) return;

        if (currentEditingId) {
            // Update
            const userIndex = users.findIndex(u => u.id === currentEditingId);
            if (userIndex > -1) {
                users[userIndex] = { 
                    ...users[userIndex], 
                    name, phone, email, role 
                };
                showToast('用户更新成功', 'success');
                logOperation('更新用户', `更新了用户 ${name} 的信息`);
            }
        } else {
            // Add
            const newUser = {
                id: Date.now(),
                name,
                phone,
                email,
                role,
                password, // In real app, hash this
                status: 'normal',
                joinDate: new Date().toISOString().split('T')[0]
            };
            users.unshift(newUser); // Add to top
            showToast('用户创建成功', 'success');
            logOperation('新增用户', `创建了新用户 ${name}`);
        }

        closeModal('user-modal');
        renderUserTable();
    };

    // --- Status Management ---
    window.changeUserStatus = function(id, newStatus) {
        const user = users.find(u => u.id === id);
        if (!user) return;

        const actionText = newStatus === 'normal' ? '激活' : '离职';
        const confirmMsg = `确定要将用户 "${user.name}" 设置为${actionText}状态吗？`;

        if (confirm(confirmMsg)) {
            user.status = newStatus;
            renderUserTable();
            showToast(`用户已${actionText}`, 'success');
            logOperation('修改状态', `将用户 ${user.name} 状态修改为 ${actionText}`);
        }
    };

    // --- Helpers ---
    function showError(elementId, msg) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    function hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.classList.add('hidden');
        }
    }

    // Mock Logger
    function logOperation(action, detail) {
        console.log(`[LOG] ${new Date().toLocaleString()} - ${action}: ${detail}`);
    }

    // Mock Toast (if not in utils)
    // Note: Assuming utils.js provides showToast or we reuse the one if present globally.
    // If not, simple fallback:
    if (!window.showToast) {
        window.showToast = function(message) { alert(message); };
    }

})();
