// Router Logic for loading views

const routes = {
    'dashboard': { title: '仪表盘', file: 'views/dashboard.html' },
    'settings': { title: '系统设置', file: 'views/settings.html' },
    'settings-info': { title: '企业信息', file: 'views/settings-info.html' },
    'settings-sdk': { title: 'SDK配置', file: 'views/settings-sdk.html' },
    'settings-logs': { title: '系统日志', file: 'views/settings-logs.html' },
    'model-config': { title: '模型服务商', file: 'views/model-config.html' },
    'model-list': { title: '模型列表', file: 'views/model-list.html' },
    'user-mgmt': { title: '用户管理', file: 'views/user-mgmt.html' },
    'role-mgmt': { title: '角色管理', file: 'views/role-mgmt.html' },
    'agent': { title: '智能体管理', file: 'views/agent.html' },
    'orchestrator': { title: '工作流', file: 'views/orchestrator.html' },
    'orchestrator-editor': { title: '工作流编辑', file: 'views/orchestrator-editor.html', fullscreen: true },
    'knowledge': { title: '知识库', file: 'views/knowledge.html' },
    'knowledge-graph': { title: '知识图谱', file: 'views/knowledge-graph.html' },
    'knowledge-graph-detail': { title: '图谱详情', file: 'views/knowledge-graph-detail.html' },
    'knowledge-settings': { title: '知识库设置', file: 'views/knowledge-settings.html' },
    'knowledge-testing': { title: '命中测试', file: 'views/knowledge-testing.html' },
    'knowledge-strategy-config': { title: '策略配置', file: 'views/strategy-config.html' },
    'components': { title: '组件', file: 'views/components.html' },
    'mcp': { title: 'MCP', file: 'views/mcp.html' },
    'mcp-detail': { title: 'MCP详情', file: 'views/mcp-detail.html' },
    'mcp-create': { title: '创建MCP', file: 'views/mcp-create.html' },
    'monitoring': { title: '应用监控', file: 'views/monitoring.html' },
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

        // 禁用浏览器缓存，避免开发/预览时看不到最新的 HTML 片段
        const response = await fetch(route.file, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        
        // Inject content
        if (contentArea) {
            contentArea.innerHTML = html;
            contentArea.scrollTop = 0; // Reset scroll position
            
            // Execute view-specific scripts if available
            if (viewName === 'settings-logs' && window.renderSystemLogs) {
                window.renderSystemLogs();
            }
        }
        
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
             // Handle optional tab switching
             if (params && params.tab && typeof window.switchEditorTab === 'function') {
                 // Small timeout to ensure DOM is fully ready
                 setTimeout(() => window.switchEditorTab(params.tab), 100);
             }
        }
        
        // Init Knowledge Graph Page
        if (viewName === 'knowledge-graph' && typeof window.initKnowledgeGraphPage === 'function') {
            window.initKnowledgeGraphPage();
        }

        // Init Knowledge Graph Detail Page
        if (viewName === 'knowledge-graph-detail' && typeof window.initKnowledgeGraphDetail === 'function') {
            window.initKnowledgeGraphDetail(params);
        }

        // Init Model Config Page
        if (viewName === 'model-config' && typeof window.initProviderList === 'function') {
            window.initProviderList();
        }

        // Init Model List Page
        if (viewName === 'model-list' && typeof window.initModelList === 'function') {
            window.initModelList(params);
        }

        // Init Knowledge Page
        if (viewName === 'knowledge') {
            if (typeof window.initKnowledgePage === 'function') {
                window.initKnowledgePage(params);
            }
        }
        
        // Init Strategy Config Page
        if (viewName === 'knowledge-strategy-config' && typeof window.initStrategyConfigPage === 'function') {
            window.initStrategyConfigPage(params);
        }

        if (viewName === 'monitoring') {
            if (typeof window.initMonitoringDateRange === 'function') {
                window.initMonitoringDateRange();
            }
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
    if (window.location.hash === url) {
        loadView(viewName, params);
    } else {
        window.location.hash = url;
    }
}

// Handle Hash Change
function handleHashChange() {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (!hash) {
        switchView('agent');
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

    // Handle Settings Parent State
    const settingsBtn = document.getElementById('settings-menu-btn');
    const settingsChevron = document.getElementById('settings-chevron');
    const settingsSubmenu = document.getElementById('settings-submenu');
    
    if (settingsBtn) {
        if (viewName === 'settings-info' || viewName === 'settings-logs' || viewName === 'model-config' || viewName === 'model-list') {
            settingsBtn.classList.add('text-blue-600', 'bg-blue-50');
            settingsBtn.classList.remove('text-gray-600', 'hover:text-blue-600', 'hover:bg-gray-50');
            
            // Auto expand if hidden
            if (settingsSubmenu && settingsSubmenu.classList.contains('hidden')) {
                settingsSubmenu.classList.remove('hidden');
                if (settingsChevron) settingsChevron.classList.add('rotate-90');
            }
        } else {
            settingsBtn.classList.remove('text-blue-600', 'bg-blue-50');
            settingsBtn.classList.add('text-gray-600', 'hover:text-blue-600', 'hover:bg-gray-50');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // If no hash, default to agent (handled by handleHashChange)
    handleHashChange();
});

// Listen for hash changes (Back/Forward navigation)
window.addEventListener('hashchange', handleHashChange);
