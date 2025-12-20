/**
 * Role Management Logic
 */

(function() {
    window.openRoleActions = function(event, roleName) {
        // Define actions based on role or generic actions
        const actions = [
            {
                label: '配置权限',
                icon: 'fa-solid fa-key',
                onClick: () => showToast(`配置 ${roleName} 权限 (模拟)`, 'info')
            },
            {
                label: '编辑',
                icon: 'fa-solid fa-pen',
                onClick: () => showToast(`编辑 ${roleName} (模拟)`, 'info')
            },
            {
                label: '删除',
                icon: 'fa-solid fa-trash',
                className: 'text-red-600 hover:bg-red-50',
                iconClass: 'text-red-500',
                onClick: () => showToast(`删除 ${roleName} (模拟)`, 'error')
            }
        ];

        // Disable delete for "System Default" roles if needed, but for now just show all
        if (roleName === '超级管理员') {
             // Maybe restrict actions for super admin
        }

        window.showActionMenu(event, actions);
    };

    // Initialize if needed
    document.addEventListener('view-loaded', (e) => {
        if (e.detail.view === 'role-mgmt') {
            console.log('Role Management View Loaded');
        }
    });

})();
