// Router Logic for loading views

const routes = {
    'dashboard': { title: '仪表盘', file: 'views/dashboard.html' },
    'settings': { title: '系统设置', file: 'views/settings.html' },
    'user-mgmt': { title: '用户管理', file: 'views/user-mgmt.html' },
    'role-mgmt': { title: '角色管理', file: 'views/role-mgmt.html' },
    'agent': { title: '智能体管理', file: 'views/agent.html' },
    'orchestrator': { title: '编排器', file: 'views/orchestrator.html' },
    'orchestrator-editor': { title: '编排器编辑', file: 'views/orchestrator-editor.html', fullscreen: true },
    'parser': { title: '解析器', file: 'views/parser.html' },
    'knowledge': { title: '知识库', file: 'views/knowledge.html' },
    'knowledge-settings': { title: '知识库设置', file: 'views/knowledge-settings.html' },
    'knowledge-testing': { title: '命中测试', file: 'views/knowledge-testing.html' },
    'components': { title: '组件', file: 'views/components.html' },
    'evaluation': { title: '调试与评测', file: 'views/evaluation.html' },
    'agent-editor': { title: '智能体编辑', file: 'views/agent-editor.html', fullscreen: true },
    'login': { title: '登录', file: 'views/login.html', fullscreen: true }
};

// Auth Logic
function checkAuth() {
    return !!localStorage.getItem('vagent_token');
}

window.handleLogin = function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        // Mock Login Success
        localStorage.setItem('vagent_token', 'mock_token_' + Date.now());
        localStorage.setItem('vagent_user', JSON.stringify({ name: 'Product Manager', email: email }));
        
        switchView('dashboard');
    }
};

window.logout = function() {
    openModal('logout-confirm-modal');
};

window.confirmLogout = function() {
    closeModal('logout-confirm-modal');
    localStorage.removeItem('vagent_token');
    localStorage.removeItem('vagent_user');
    switchView('login');
};

// Internal function to load view content
async function loadView(viewName, params = null) {
    const contentArea = document.getElementById('main-content-area');
    const pageTitle = document.getElementById('page-title');
    const pageStatus = document.getElementById('page-status');
    const sidebar = document.getElementById('main-sidebar');
    const header = document.getElementById('main-header');

    // Update Navigation Active State
    updateNavState(viewName);

    if (!routes[viewName]) {
        console.error('Route not found:', viewName);
        // Optional: Load a 404 view or redirect to dashboard
        if (viewName !== 'dashboard') {
             window.location.hash = '#/dashboard';
        }
        return;
    }

    try {
        const route = routes[viewName];
        
        // Handle Fullscreen Mode
        if (route.fullscreen) {
            if (sidebar) sidebar.classList.add('hidden');
            if (header) header.classList.add('hidden');
            if (contentArea) {
                contentArea.classList.remove('p-8');
                // Ensure content area takes full height for login
                if (viewName === 'login') {
                    contentArea.classList.add('h-screen');
                } else {
                    contentArea.classList.remove('h-screen');
                }
            }
        } else {
            if (sidebar) sidebar.classList.remove('hidden');
            if (header) header.classList.remove('hidden');
            if (contentArea) {
                contentArea.classList.add('p-8');
                contentArea.classList.remove('h-screen');
            }
        }

        const response = await fetch(route.file);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        
        // Inject content
        contentArea.innerHTML = html;
        contentArea.scrollTop = 0; // Reset scroll position
        
        // Update Title
        if (pageTitle) pageTitle.textContent = route.title;

        // Update Status Badge
        if (pageStatus) {
            if (viewName === 'dashboard') {
                pageStatus.classList.remove('hidden');
            } else {
                pageStatus.classList.add('hidden');
            }
        }

        // Dispatch view-loaded event with params
        document.dispatchEvent(new CustomEvent('view-loaded', { 
            detail: { 
                view: viewName,
                params: params
            } 
        }));

        // Call init function if exists
        if (viewName === 'agent-editor' && typeof window.initAgentEditor === 'function') {
             window.initAgentEditor(params);
        }

    } catch (error) {
        console.error('Error loading view:', error);
        contentArea.innerHTML = `<div class="p-8 text-red-500">Error loading content: ${error.message}</div>`;
    }
}

// Public API to switch view (updates URL)
function switchView(viewName, params = null) {
    let url = `#/${viewName}`;
    if (params) {
        const searchParams = new URLSearchParams();
        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                searchParams.append(key, params[key]);
            }
        }
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }
    window.location.hash = url;
}

// Handle Hash Change
function handleHashChange() {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (!hash) {
        switchView('dashboard');
        return;
    }

    // Parse view and params from hash (e.g. /agent-editor?id=123)
    const [path, queryString] = hash.split('?');
    const viewName = path.replace(/^\//, ''); // Remove leading '/'
    
    // Auth Guard
    if (viewName !== 'login' && !checkAuth()) {
        switchView('login');
        return;
    }

    const params = {};
    if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams.entries()) {
            params[key] = value;
        }
    }

    loadView(viewName, params);
}

function updateNavState(viewName) {
    // Map view names to navigation link selectors or IDs
    // Assuming navigation links have an href matching the switchView call or similar structure
    // Since we use onclick="switchView('name')", we can find links by this attribute
    
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const onclickAttr = link.getAttribute('onclick');
        if (!onclickAttr) return;
        
        // Extract view name from "switchView('dashboard')"
        const match = onclickAttr.match(/switchView\('([^']+)'\)/);
        if (match && match[1] === viewName) {
            // Active State
            link.classList.remove('text-gray-600', 'hover:text-blue-600', 'hover:bg-gray-50');
            link.classList.add('text-blue-600', 'bg-blue-50');
        } else {
            // Inactive State
            link.classList.remove('text-blue-600', 'bg-blue-50');
            link.classList.add('text-gray-600', 'hover:text-blue-600', 'hover:bg-gray-50');
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // If no hash, default to dashboard (handled by handleHashChange)
    handleHashChange();
});

// Listen for hash changes (Back/Forward navigation)
window.addEventListener('hashchange', handleHashChange);
