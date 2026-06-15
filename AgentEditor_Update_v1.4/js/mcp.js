// MCP pages logic (list/detail/create)

const MCP_STORAGE_KEY = 'vagent_mcp_services_v1';

function loadMcpServices() {
    try {
        const raw = localStorage.getItem(MCP_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        // ignore
    }
    const now = new Date();
    const mk = (id, name, enabled, hoursAgo) => {
        const created = new Date(now.getTime() - hoursAgo * 3600 * 1000);
        const updated = new Date(now.getTime() - Math.max(1, hoursAgo - 2) * 3600 * 1000);
        return {
            id,
            name,
            description: '示例MCP服务，用于演示列表/创建/编辑流程。',
            enabled,
            installType: 'sse',
            configJson: JSON.stringify({
                mcpServers: {
                    [id.toLowerCase()]: {
                        type: 'sse',
                        url: 'https://example.com/sse',
                        timeout: 30000
                    }
                }
            }, null, 2),
            createdAt: created.toLocaleString(),
            updatedAt: updated.toLocaleString()
        };
    };
    const seed = [
        mk('MCP-001', 'ModelScope MCP Demo', true, 48),
        mk('MCP-002', 'Nacos MCP Router', false, 120),
        mk('MCP-003', 'Higress OpenAPI to MCP', true, 8)
    ];
    saveMcpServices(seed);
    return seed;
}

function saveMcpServices(list) {
    try {
        localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        // ignore
    }
}

function getMcpServiceById(id) {
    const list = loadMcpServices();
    return list.find(x => x.id === id) || null;
}

function upsertMcpService(service) {
    const list = loadMcpServices();
    const idx = list.findIndex(x => x.id === service.id);
    if (idx >= 0) list[idx] = service;
    else list.unshift(service);
    saveMcpServices(list);
}

function deleteMcpServiceById(id) {
    const list = loadMcpServices().filter(x => x.id !== id);
    saveMcpServices(list);
}

function formatStatusPill(enabled) {
    if (enabled) {
        return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">已启用</span>`;
    }
    return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">已停用</span>`;
}

// List Page
window.initMcpListPage = function() {
    loadMcpServices();
    window.filterMcpList();
};

window.goToCreateMcp = function() {
    switchView('mcp-create');
};

window.filterMcpList = function() {
    const search = (document.getElementById('mcp-search-input')?.value || '').trim().toLowerCase();
    const status = document.getElementById('mcp-filter-status')?.value || 'all';
    const list = loadMcpServices()
        .filter(x => !search || (x.name || '').toLowerCase().includes(search))
        .filter(x => status === 'all' ? true : (status === 'enabled' ? !!x.enabled : !x.enabled));
    renderMcpList(list);
};

function renderMcpList(list) {
    const tbody = document.getElementById('mcp-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td class="px-6 py-10 text-center text-gray-400 text-sm" colspan="6">暂无MCP服务</td></tr>`;
        return;
    }

    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';

        const toggleText = item.enabled ? '关闭' : '开启';
        const toggleCls = item.enabled ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800';

        tr.innerHTML = `
            <td class="px-6 py-4">
                <button class="text-blue-600 hover:text-blue-800 font-medium" onclick="openMcpDetail('${item.id}')">${escapeHtml(item.name)}</button>
                <div class="text-xs text-gray-400 mt-1">${escapeHtml(item.id)}</div>
            </td>
            <td class="px-6 py-4 text-gray-600">${escapeHtml(item.description || '-')}</td>
            <td class="px-6 py-4">${formatStatusPill(item.enabled)}</td>
            <td class="px-6 py-4 text-gray-600">${escapeHtml(item.createdAt || '-')}</td>
            <td class="px-6 py-4 text-gray-600">${escapeHtml(item.updatedAt || '-')}</td>
            <td class="px-6 py-4 text-right">
                <div class="inline-flex items-center gap-3 text-sm">
                    <button class="${toggleCls}" onclick="toggleMcpService('${item.id}')">${toggleText}</button>
                    <button class="text-blue-600 hover:text-blue-800" onclick="editMcpService('${item.id}')">编辑</button>
                    <button class="text-red-600 hover:text-red-800" onclick="deleteMcpService('${item.id}')">删除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openMcpDetail = function(id) {
    switchView('mcp-detail', { id });
};

window.toggleMcpService = function(id) {
    const svc = getMcpServiceById(id);
    if (!svc) return;
    svc.enabled = !svc.enabled;
    svc.updatedAt = new Date().toLocaleString();
    upsertMcpService(svc);
    window.filterMcpList();
};

window.editMcpService = function(id) {
    switchView('mcp-create', { id });
};

window.deleteMcpService = function(id) {
    const svc = getMcpServiceById(id);
    if (!svc) return;
    const ok = confirm(`确认删除 MCP 服务「${svc.name}」？`);
    if (!ok) return;
    deleteMcpServiceById(id);
    window.filterMcpList();
};

// Detail Page
let currentMcpDetailId = null;

window.initMcpDetailPage = function(params) {
    currentMcpDetailId = params?.id || null;
    const svc = currentMcpDetailId ? getMcpServiceById(currentMcpDetailId) : null;
    if (!svc) {
        alert('未找到该MCP服务');
        switchView('mcp');
        return;
    }

    const name = document.getElementById('mcp-detail-name');
    const idEl = document.getElementById('mcp-detail-id');
    const desc = document.getElementById('mcp-detail-desc');
    const status = document.getElementById('mcp-detail-status');
    const install = document.getElementById('mcp-detail-install');
    const created = document.getElementById('mcp-detail-created');
    const updated = document.getElementById('mcp-detail-updated');
    const code = document.getElementById('mcp-detail-config');
    const toggleBtn = document.getElementById('mcp-detail-toggle-btn');

    if (name) name.textContent = svc.name || '-';
    if (idEl) idEl.textContent = svc.id || '-';
    if (desc) desc.textContent = svc.description || '-';
    if (status) status.innerHTML = formatStatusPill(!!svc.enabled);
    if (install) install.textContent = (svc.installType || 'sse').toUpperCase();
    if (created) created.textContent = svc.createdAt || '-';
    if (updated) updated.textContent = svc.updatedAt || '-';
    if (code) code.textContent = svc.configJson || '';
    if (toggleBtn) toggleBtn.textContent = svc.enabled ? '关闭' : '开启';
};

window.toggleMcpFromDetail = function() {
    if (!currentMcpDetailId) return;
    window.toggleMcpService(currentMcpDetailId);
    window.initMcpDetailPage({ id: currentMcpDetailId });
};

window.editMcpFromDetail = function() {
    if (!currentMcpDetailId) return;
    window.editMcpService(currentMcpDetailId);
};

window.copyMcpConfig = async function() {
    const code = document.getElementById('mcp-detail-config')?.textContent || '';
    if (!code) return;
    try {
        await navigator.clipboard.writeText(code);
        alert('已复制');
    } catch (e) {
        alert('复制失败，请手动复制');
    }
};

// Create/Edit Page
let currentMcpEditingId = null;

window.initMcpCreatePage = function(params) {
    currentMcpEditingId = params?.id || null;
    const title = document.getElementById('mcp-create-title');

    const name = document.getElementById('mcp-service-name');
    const desc = document.getElementById('mcp-service-desc');
    const json = document.getElementById('mcp-config-json');

    if (currentMcpEditingId) {
        const svc = getMcpServiceById(currentMcpEditingId);
        if (!svc) {
            alert('未找到该MCP服务');
            switchView('mcp');
            return;
        }
        if (title) title.textContent = '编辑MCP服务';
        if (name) name.value = svc.name || '';
        if (desc) desc.value = svc.description || '';
        if (json) json.value = svc.configJson || '';
    } else {
        if (title) title.textContent = '创建MCP服务';
        if (name) name.value = '';
        if (desc) desc.value = '';
        if (json) json.value = '';
    }

    window.updateMcpCreateCounters();
    window.updateMcpConfigLines();
};

window.updateMcpCreateCounters = function() {
    const name = document.getElementById('mcp-service-name')?.value || '';
    const desc = document.getElementById('mcp-service-desc')?.value || '';
    const nameCount = document.getElementById('mcp-name-count');
    const descCount = document.getElementById('mcp-desc-count');
    if (nameCount) nameCount.textContent = String(name.length);
    if (descCount) descCount.textContent = String(desc.length);
};

window.updateMcpConfigLines = function() {
    const json = document.getElementById('mcp-config-json');
    const lines = document.getElementById('mcp-config-lines');
    if (!json || !lines) return;
    const n = Math.max(1, (json.value || '').split('\n').length);
    lines.textContent = Array.from({ length: n }, (_, i) => String(i + 1)).join('\n');
};

window.formatMcpJson = function() {
    const json = document.getElementById('mcp-config-json');
    if (!json) return;
    const raw = json.value.trim();
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        json.value = JSON.stringify(parsed, null, 2);
        window.updateMcpConfigLines();
    } catch (e) {
        alert('JSON格式不正确，无法格式化');
    }
};

window.saveMcpService = function() {
    const nameEl = document.getElementById('mcp-service-name');
    const descEl = document.getElementById('mcp-service-desc');
    const jsonEl = document.getElementById('mcp-config-json');

    const name = (nameEl?.value || '').trim();
    const description = (descEl?.value || '').trim();
    const configJson = (jsonEl?.value || '').trim();

    if (!name) {
        alert('请填写服务名称');
        return;
    }
    if (configJson) {
        try {
            JSON.parse(configJson);
        } catch (e) {
            alert('MCP服务配置 JSON 格式不正确');
            return;
        }
    }

    const now = new Date().toLocaleString();
    if (currentMcpEditingId) {
        const existing = getMcpServiceById(currentMcpEditingId);
        if (!existing) {
            alert('未找到该MCP服务');
            switchView('mcp');
            return;
        }
        const updated = {
            ...existing,
            name,
            description,
            configJson,
            updatedAt: now
        };
        upsertMcpService(updated);
        alert('已保存');
        switchView('mcp-detail', { id: updated.id });
        return;
    }

    const id = `MCP-${String(Math.floor(Math.random() * 900) + 100)}`;
    const created = {
        id,
        name,
        description,
        enabled: true,
        installType: 'sse',
        configJson: configJson || JSON.stringify({ mcpServers: {} }, null, 2),
        createdAt: now,
        updatedAt: now
    };
    upsertMcpService(created);
    alert('创建成功');
    switchView('mcp');
};

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// Hook into router's view-loaded
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'mcp') {
        window.initMcpListPage();
    }
    if (e.detail.view === 'mcp-detail') {
        window.initMcpDetailPage(e.detail.params);
    }
    if (e.detail.view === 'mcp-create') {
        window.initMcpCreatePage(e.detail.params);
    }
});

