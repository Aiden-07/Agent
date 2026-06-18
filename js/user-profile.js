// ============ 头像相关 ============
window.handleProfileAvatarUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('文件大小不能超过 5MB', 'error');
        return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showToast('仅支持 JPG、PNG 格式', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        // Update main avatar
        const preview = document.getElementById('avatarPreview');
        preview.innerHTML = `<img src="${dataUrl}" alt="头像" class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-camera text-white text-xl"></i></div>`;
        // Update sidebar avatar
        const sidebarAvatar = document.querySelector('aside#main-sidebar .flex.items-center.gap-3 .rounded-full');
        if (sidebarAvatar) {
            sidebarAvatar.innerHTML = `<img src="${dataUrl}" alt="头像" class="w-full h-full rounded-full object-cover">`;
        }
        showToast('头像上传成功', 'success');
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    event.target.value = '';
};

window.removeAvatar = function() {
    const preview = document.getElementById('avatarPreview');
    const initial = (document.getElementById('profileUsername').value || 'P').trim().charAt(0).toUpperCase() || 'P';
    preview.innerHTML = `<span id="avatarText">${initial}</span><div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-camera text-white text-xl"></i></div>`;

    const sidebarAvatar = document.querySelector('aside#main-sidebar .flex.items-center.gap-3 .rounded-full');
    if (sidebarAvatar) {
        sidebarAvatar.textContent = initial;
        sidebarAvatar.innerHTML = initial;
    }
    showToast('头像已删除', 'success');
};

// ============ 用户名编辑 ============
window.isProfileUsernameEditing = false;

window.toggleProfileUsernameEdit = function() {
    const input = document.getElementById('profileUsername');
    const btn = document.getElementById('usernameBtn');
    const btnText = document.getElementById('usernameBtnText');

    if (!window.isProfileUsernameEditing) {
        input.disabled = false;
        input.classList.remove('bg-gray-50', 'disabled:opacity-70');
        input.classList.add('bg-white');
        input.focus();
        input.select();
        btnText.textContent = '保存';
        btn.classList.remove('border-blue-600', 'text-blue-600', 'hover:bg-blue-50');
        btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'border-blue-600');
        window.isProfileUsernameEditing = true;
    } else {
        const username = input.value.trim();
        if (!username) {
            showToast('请输入用户名', 'error');
            return;
        }

        // 同步侧边栏用户名
        const sidebarName = document.querySelector('aside#main-sidebar .user-info-text .text-sm.font-medium');
        if (sidebarName) sidebarName.textContent = username;

        // 同步头像首字
        const firstChar = username.charAt(0).toUpperCase();
        const avatarTextEl = document.getElementById('avatarText');
        if (avatarTextEl) avatarTextEl.textContent = firstChar;

        // 持久化到 localStorage 中保存的 user 信息
        try {
            const userRaw = localStorage.getItem('vagent_user');
            if (userRaw) {
                const user = JSON.parse(userRaw);
                user.name = username;
                localStorage.setItem('vagent_user', JSON.stringify(user));
            }
        } catch (e) { /* ignore */ }

        input.disabled = true;
        input.classList.add('bg-gray-50');
        input.classList.remove('bg-white');
        btnText.textContent = '编辑';
        btn.classList.add('border-blue-600', 'text-blue-600', 'hover:bg-blue-50');
        btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'border-blue-600');
        window.isProfileUsernameEditing = false;

        showToast('用户名已保存', 'success');
    }
};

// ============ 邮箱编辑 ============
window.isProfileEmailEditing = false;

window.toggleProfileEmailEdit = function() {
    const input = document.getElementById('profileEmail');
    const btn = document.getElementById('emailBtn');
    const btnText = document.getElementById('emailBtnText');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!window.isProfileEmailEditing) {
        input.disabled = false;
        input.classList.remove('bg-gray-50');
        input.classList.add('bg-white');
        input.focus();
        input.select();
        btnText.textContent = '保存';
        btn.classList.remove('border-blue-600', 'text-blue-600', 'hover:bg-blue-50');
        btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'border-blue-600');
        window.isProfileEmailEditing = true;
    } else {
        const email = input.value.trim();
        if (email && !emailRegex.test(email)) {
            showToast('请输入有效的邮箱地址', 'error');
            return;
        }

        try {
            const userRaw = localStorage.getItem('vagent_user');
            if (userRaw) {
                const user = JSON.parse(userRaw);
                user.email = email;
                localStorage.setItem('vagent_user', JSON.stringify(user));
            }
        } catch (e) { /* ignore */ }

        // 同步侧边栏邮箱显示
        const sidebarEmail = document.querySelector('aside#main-sidebar .user-info-text .text-xs.text-gray-500');
        if (sidebarEmail) sidebarEmail.textContent = email;

        input.disabled = true;
        input.classList.add('bg-gray-50');
        input.classList.remove('bg-white');
        btnText.textContent = '编辑';
        btn.classList.add('border-blue-600', 'text-blue-600', 'hover:bg-blue-50');
        btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'border-blue-600');
        window.isProfileEmailEditing = false;

        showToast('邮箱已保存', 'success');
    }
};

// ============ 密码弹窗相关 ============
window.openProfilePasswordModal = function() {
    const modal = document.getElementById('profilePasswordModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.getElementById('oldPassword').value = '';
    document.getElementById('modalNewPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    resetProfilePasswordStrength();
};

window.closeProfilePasswordModal = function() {
    const modal = document.getElementById('profilePasswordModal');
    if (modal) modal.classList.add('hidden');
};

window.toggleProfilePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

function resetProfilePasswordStrength() {
    const segments = ['modal-seg1', 'modal-seg2', 'modal-seg3'].map(function(id) { return document.getElementById(id); });
    segments.forEach(function(s) { if (s) s.className = 'h-1 flex-1 rounded bg-gray-200 transition-colors'; });
    const text = document.getElementById('modalStrengthText');
    if (text) text.textContent = '密码强度：请输入密码';
}

window.checkProfilePasswordStrength = function(password) {
    const segments = ['modal-seg1', 'modal-seg2', 'modal-seg3'].map(function(id) { return document.getElementById(id); });
    const text = document.getElementById('modalStrengthText');
    if (!text) return;

    // Reset
    segments.forEach(function(s) { if (s) s.className = 'h-1 flex-1 rounded bg-gray-200 transition-colors'; });

    if (!password) {
        text.textContent = '密码强度：请输入密码';
        text.className = 'text-xs text-gray-400 mt-1.5';
        return;
    }
    if (password.length < 8) {
        text.textContent = '密码强度：密码长度不足8位';
        text.className = 'text-xs text-red-500 mt-1.5';
        return;
    }

    var typeCount = 0;
    if (/[a-zA-Z]/.test(password)) typeCount++;
    if (/\d/.test(password)) typeCount++;
    if (/[^a-zA-Z0-9]/.test(password)) typeCount++;

    const levels = [
        { color: 'bg-red-400', label: '密码强度：低', labelColor: 'text-red-500' },
        { color: 'bg-yellow-400', label: '密码强度：中', labelColor: 'text-yellow-600' },
        { color: 'bg-green-500', label: '密码强度：高', labelColor: 'text-green-600' }
    ];
    const level = levels[typeCount - 1] || levels[0];

    for (var i = 0; i < typeCount; i++) {
        if (segments[i]) segments[i].className = 'h-1 flex-1 rounded ' + level.color + ' transition-colors';
    }
    text.textContent = level.label;
    text.className = 'text-xs ' + level.labelColor + ' mt-1.5';
};

window.submitProfilePasswordChange = function() {
    const oldPwd = document.getElementById('oldPassword').value;
    const newPwd = document.getElementById('modalNewPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;

    if (!oldPwd) {
        showToast('请输入原始密码', 'error');
        return;
    }
    if (!newPwd) {
        showToast('请输入新密码', 'error');
        return;
    }
    if (newPwd.length < 8) {
        showToast('新密码长度至少8位', 'error');
        return;
    }
    if (newPwd !== confirmPwd) {
        showToast('两次输入的新密码不一致', 'error');
        return;
    }

    closeProfilePasswordModal();
    showToast('密码修改成功', 'success');
};

// ============ 初始化页面数据 ============
window.initProfilePage = function() {
    try {
        const userRaw = localStorage.getItem('vagent_user');
        if (userRaw) {
            const user = JSON.parse(userRaw);
            const nameInput = document.getElementById('profileUsername');
            const emailInput = document.getElementById('profileEmail');
            if (user.name && nameInput) nameInput.value = user.name;
            if (user.email && emailInput) emailInput.value = user.email;
            const firstChar = ((user.name || 'P').charAt(0) || 'P').toUpperCase();
            const avatarText = document.getElementById('avatarText');
            if (avatarText) avatarText.textContent = firstChar;
        }
    } catch (e) { /* ignore */ }
};