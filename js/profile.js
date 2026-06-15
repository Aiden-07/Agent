(function () {
    const USER_KEY = 'vagent_user';
    const PASSWORD_KEY = 'vagent_profile_password';

    function parseJson(raw, fallback) {
        try {
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function getCurrentUser() {
        const stored = parseJson(localStorage.getItem(USER_KEY), {});
        return {
            name: stored.name || 'Product Manager',
            email: stored.email || 'pm@vagent.ai',
            phone: stored.phone || '13800000000',
            department: stored.department || '产品部',
            role: stored.role || '产品经理'
        };
    }

    function getInitials(name) {
        const text = String(name || '').trim();
        if (!text) return 'U';
        if (/[\u4e00-\u9fa5]/.test(text)) return text.slice(-2);
        return text
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join('')
            .toUpperCase();
    }

    function setMessage(id, text, type) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        el.className = `mt-4 text-sm ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
        el.classList.remove('hidden');
    }

    function clearMessage(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }

    function updateSidebarUser(user) {
        const sidebar = document.getElementById('main-sidebar');
        if (!sidebar) return;

        const nameEl = sidebar.querySelector('.user-info-text p:first-child');
        const emailEl = sidebar.querySelector('.user-info-text p:nth-child(2)');
        const avatarEl = sidebar.querySelector('.border-t .w-10.h-10');

        if (nameEl) nameEl.textContent = user.name;
        if (emailEl) emailEl.textContent = user.email;
        if (avatarEl) avatarEl.textContent = getInitials(user.name);
    }

    function renderProfile(user) {
        const fields = {
            'profile-name': user.name,
            'profile-email': user.email,
            'profile-phone': user.phone,
            'profile-department': user.department,
            'profile-role': user.role
        };

        Object.entries(fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });

        const displayName = document.getElementById('profile-display-name');
        const displayEmail = document.getElementById('profile-display-email');
        const avatar = document.getElementById('profile-avatar');

        if (displayName) displayName.textContent = user.name;
        if (displayEmail) displayEmail.textContent = user.email;
        if (avatar) avatar.textContent = getInitials(user.name);
        updateSidebarUser(user);
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidPassword(password) {
        return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
    }

    window.initProfilePage = function () {
        clearMessage('profile-info-message');
        clearMessage('profile-password-message');
        renderProfile(getCurrentUser());
    };

    window.saveProfileInfo = function () {
        const user = {
            name: document.getElementById('profile-name')?.value.trim() || '',
            email: document.getElementById('profile-email')?.value.trim() || '',
            phone: document.getElementById('profile-phone')?.value.trim() || '',
            department: document.getElementById('profile-department')?.value.trim() || '',
            role: document.getElementById('profile-role')?.value.trim() || '产品经理'
        };

        if (!user.name) {
            setMessage('profile-info-message', '请输入姓名。', 'error');
            return;
        }
        if (!isValidEmail(user.email)) {
            setMessage('profile-info-message', '请输入有效的邮箱地址。', 'error');
            return;
        }

        localStorage.setItem(USER_KEY, JSON.stringify(user));
        renderProfile(user);
        setMessage('profile-info-message', '个人信息已保存。', 'success');
    };

    window.changeProfilePassword = function () {
        const current = document.getElementById('profile-current-password')?.value || '';
        const next = document.getElementById('profile-new-password')?.value || '';
        const confirm = document.getElementById('profile-confirm-password')?.value || '';
        const storedPassword = localStorage.getItem(PASSWORD_KEY);

        if (!current) {
            setMessage('profile-password-message', '请输入当前密码。', 'error');
            return;
        }
        if (storedPassword && current !== storedPassword) {
            setMessage('profile-password-message', '当前密码不正确。', 'error');
            return;
        }
        if (!isValidPassword(next)) {
            setMessage('profile-password-message', '新密码至少8位，并且需要包含字母和数字。', 'error');
            return;
        }
        if (next !== confirm) {
            setMessage('profile-password-message', '两次输入的新密码不一致。', 'error');
            return;
        }
        if (storedPassword && next === storedPassword) {
            setMessage('profile-password-message', '新密码不能与当前密码相同。', 'error');
            return;
        }

        localStorage.setItem(PASSWORD_KEY, next);
        document.getElementById('profile-password-form')?.reset();
        setMessage('profile-password-message', '密码已修改。', 'success');
    };
})();
