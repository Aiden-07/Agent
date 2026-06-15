// Data Source Management and mock database query capability
(function() {
    const DATA_SOURCE_STORAGE_KEY = 'vagent_datasources_v1';
    const QUERY_LOG_STORAGE_KEY = 'vagent_datasource_query_logs_v1';
    const MAX_ROW_LIMIT = 1000;
    const DEFAULT_ROW_LIMIT = 100;
    const DEFAULT_TIMEOUT = 30;
    const MAX_QUERY_LOGS = 10000;

    const grantTargets = [
        { id: 'role-admin', name: '超级管理员', type: '角色' },
        { id: 'role-dev', name: '开发者', type: '角色' },
        { id: 'role-analyst', name: '数据分析师', type: '角色' }
    ];

    const grantLevels = [
        { value: 'none', label: '未授权' },
        { value: 'use', label: '可使用' },
        { value: 'edit', label: '可编辑' },
        { value: 'manage', label: '可管理' }
    ];

    const variableSqlMap = {
        '{{llm1.output.sql}}': `SELECT region, SUM(pay_amount) AS total_amount
FROM orders
GROUP BY region
ORDER BY total_amount DESC
LIMIT 10`,
        '{{llm_node.output.sql}}': `SELECT product_name, COUNT(*) AS order_count
FROM orders
GROUP BY product_name
ORDER BY order_count DESC
LIMIT 20`,
        '{{code1.output.sql}}': `SELECT created_date, COUNT(*) AS user_count
FROM users
GROUP BY created_date
ORDER BY created_date DESC
LIMIT 30`,
        '{{start.query}}': '',
        '{{empty.sql}}': ''
    };

    let dataSourceState = {
        items: [],
        search: '',
        status: 'all',
        type: 'all',
        editingId: null,
        lastTestResult: null,
        detailId: null,
        detailTab: 'basic',
        logKeyword: '',
        logStatus: 'all',
        logPage: 1,
        logPageSize: 20,
        impactAction: null
    };

    function safeJsonParse(raw, fallback) {
        try {
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function escapeHtml(value) {
        const esc = window.escapeHtml || function(str) {
            return String(str == null ? '' : str)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        };
        return esc(value);
    }

    function nowString() {
        return new Date().toLocaleString('zh-CN', { hour12: false });
    }

    function generateDataSourceId() {
        if (typeof window.generateId === 'function') return window.generateId('DS');
        return `DS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    function maskPassword(password) {
        const raw = String(password || '');
        if (!raw) return '********';
        const tail = raw.slice(-2);
        return `${'*'.repeat(Math.max(6, raw.length - 2))}${tail}`;
    }

    function buildConnectionSignature(item = {}) {
        return [
            item.dbType || '',
            item.host || '',
            item.port || '',
            item.database || '',
            item.username || ''
        ].join('|');
    }

    function normalizeGrant(grant = {}) {
        const target = grantTargets.find(item => item.id === grant.targetId) || grantTargets[0];
        const permission = ['use', 'edit', 'manage'].includes(grant.permission) ? grant.permission : 'use';
        return {
            targetId: target.id,
            targetName: grant.targetName || target.name,
            targetType: grant.targetType || target.type,
            permission
        };
    }

    function normalizeDataSource(item = {}, index = 0) {
        const dbType = String(item.dbType || item.type || 'mysql').toLowerCase() === 'postgresql' ? 'postgresql' : 'mysql';
        const status = ['connected', 'failed', 'disabled'].includes(item.status) ? item.status : 'connected';
        const defaults = getSeedDataSources()[index] || {};
        const normalized = {
            id: String(item.id || defaults.id || generateDataSourceId()),
            name: item.name || defaults.name || `数据源 ${index + 1}`,
            description: item.description || defaults.description || '',
            dbType,
            space: item.space || defaults.space || '默认工作区',
            host: item.host || defaults.host || '',
            port: String(item.port || defaults.port || (dbType === 'postgresql' ? '5432' : '3306')),
            database: item.database || defaults.database || '',
            username: item.username || defaults.username || '',
            passwordMasked: item.passwordMasked || defaults.passwordMasked || '********',
            ssl: !!item.ssl,
            status,
            grants: Array.isArray(item.grants)
                ? item.grants.map(normalizeGrant)
                : (defaults.grants || []),
            references: Array.isArray(item.references) ? item.references : (defaults.references || []),
            createdBy: item.createdBy || defaults.createdBy || 'Product Manager',
            createdAt: item.createdAt || defaults.createdAt || nowString(),
            lastTestedAt: item.lastTestedAt || defaults.lastTestedAt || '',
            lastTestResult: item.lastTestResult || defaults.lastTestResult || null
        };
        normalized.connectionSignature = item.connectionSignature || buildConnectionSignature(normalized);
        return normalized;
    }

    function getSeedDataSources() {
        return [
            {
                id: 'DS-SALES-DEMO',
                name: '销售业务库',
                description: '用于智能问数演示的订单、区域和销售额数据。',
                dbType: 'mysql',
                space: '销售空间',
                host: 'sales-db.internal',
                port: '3306',
                database: 'sales_dw',
                username: 'readonly_sales',
                passwordMasked: '********es',
                ssl: true,
                status: 'connected',
                grants: [
                    { targetId: 'role-admin', targetName: '超级管理员', targetType: '角色', permission: 'manage' },
                    { targetId: 'role-dev', targetName: '开发者', targetType: '角色', permission: 'edit' },
                    { targetId: 'role-analyst', targetName: '数据分析师', targetType: '角色', permission: 'use' }
                ],
                references: [
                    { workflowId: 'WF-001', workflowName: '自然语言问数最小流程', nodeId: 'DBQ-001', nodeName: '查询销售排名' }
                ],
                createdBy: 'Product Manager',
                createdAt: '2026/6/3 09:30:00',
                lastTestedAt: '2026/6/3 10:10:00',
                lastTestResult: { success: true, message: '连接成功。', latency: 126 }
            },
            {
                id: 'DS-OPS-DEMO',
                name: '经营分析库',
                description: '用于经营指标分析的 PostgreSQL 示例库。',
                dbType: 'postgresql',
                space: '经营分析空间',
                host: 'ops-pg.internal',
                port: '5432',
                database: 'ops_analytics',
                username: 'readonly_ops',
                passwordMasked: '********ps',
                ssl: false,
                status: 'failed',
                grants: [
                    { targetId: 'role-admin', targetName: '超级管理员', targetType: '角色', permission: 'manage' },
                    { targetId: 'role-dev', targetName: '开发者', targetType: '角色', permission: 'use' }
                ],
                references: [],
                createdBy: 'Product Manager',
                createdAt: '2026/6/2 17:20:00',
                lastTestedAt: '2026/6/3 09:05:00',
                lastTestResult: { success: false, message: '数据库地址不可达。', latency: 3000, errorType: 'NETWORK_UNREACHABLE' }
            }
        ];
    }

    function loadDataSources(options = {}) {
        const raw = localStorage.getItem(DATA_SOURCE_STORAGE_KEY);
        if (raw === null && options.seed !== false) {
            const seeded = getSeedDataSources().map(normalizeDataSource);
            saveDataSources(seeded);
            return seeded;
        }
        return safeJsonParse(raw, []).map(normalizeDataSource);
    }

    function saveDataSources(items) {
        const normalized = Array.isArray(items) ? items.map(normalizeDataSource) : [];
        localStorage.setItem(DATA_SOURCE_STORAGE_KEY, JSON.stringify(normalized));
        try {
            document.dispatchEvent(new CustomEvent('data-sources-updated', { detail: { dataSources: normalized } }));
        } catch (e) {}
        return normalized;
    }

    function getDataSourceById(id) {
        return loadDataSources().find(item => item.id === id) || null;
    }

    function upsertDataSource(payload = {}) {
        const list = loadDataSources();
        const index = list.findIndex(item => item.id === payload.id);
        const previous = index >= 0 ? list[index] : null;
        const normalized = normalizeDataSource({
            ...(previous || {}),
            ...payload,
            id: payload.id || previous?.id || generateDataSourceId(),
            passwordMasked: payload.passwordPlain ? maskPassword(payload.passwordPlain) : (payload.passwordMasked || previous?.passwordMasked),
            lastTestedAt: payload.lastTestedAt || payload.lastTestResult ? (payload.lastTestedAt || nowString()) : previous?.lastTestedAt,
            connectionSignature: buildConnectionSignature(payload)
        }, index >= 0 ? index : 0);

        if (index >= 0) list[index] = normalized;
        else list.unshift(normalized);
        return saveDataSources(list);
    }

    function updateDataSource(id, patch = {}) {
        const list = loadDataSources();
        const index = list.findIndex(item => item.id === id);
        if (index < 0) return list;
        list[index] = normalizeDataSource({ ...list[index], ...patch }, index);
        return saveDataSources(list);
    }

    function removeDataSource(id) {
        return saveDataSources(loadDataSources().filter(item => item.id !== id));
    }

    function loadQueryLogs() {
        return safeJsonParse(localStorage.getItem(QUERY_LOG_STORAGE_KEY), []);
    }

    function saveQueryLogs(logs) {
        const normalized = Array.isArray(logs) ? logs : [];
        localStorage.setItem(QUERY_LOG_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function addQueryLog(log) {
        const logs = loadQueryLogs();
        logs.unshift({
            id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            workflowId: log.workflowId || currentOrchestratorIdFallback(),
            nodeId: log.nodeId || '',
            executor: log.executor || 'Product Manager',
            executedAt: log.executedAt || nowString(),
            datasourceId: log.datasourceId || '',
            sql: log.sql || '',
            status: log.status || 'failed',
            rowCount: Number(log.rowCount || 0),
            executionTime: log.executionTime || '0.00 秒',
            errorType: log.errorType || '',
            errorMessage: log.errorMessage || ''
        });
        return saveQueryLogs(logs.slice(0, MAX_QUERY_LOGS));
    }

    function currentOrchestratorIdFallback() {
        try {
            const hash = window.location.hash || '';
            const params = new URLSearchParams(hash.split('?')[1] || '');
            return params.get('id') || 'WF-DEMO';
        } catch (e) {
            return 'WF-DEMO';
        }
    }

    function simulateConnectionTest(config = {}) {
        const normalized = normalizeDataSource(config);
        const missing = [];
        ['host', 'port', 'database', 'username'].forEach(field => {
            if (!String(normalized[field] || '').trim()) missing.push(field);
        });
        if (!config.passwordPlain && !config.passwordMasked) missing.push('password');
        const latency = 80 + Math.floor(Math.random() * 260);

        return new Promise(resolve => {
            setTimeout(() => {
                if (missing.length) {
                    resolve({ success: false, message: '请先填写完整连接信息。', latency, errorType: 'CONFIG_INCOMPLETE' });
                    return;
                }
                const host = normalized.host.toLowerCase();
                const user = normalized.username.toLowerCase();
                const database = normalized.database.toLowerCase();
                const password = String(config.passwordPlain || '').toLowerCase();

                if (host.includes('timeout')) {
                    resolve({ success: false, message: '网络超时。', latency: 3000, errorType: 'NETWORK_TIMEOUT' });
                } else if (host.includes('unreachable') || host.includes('fail')) {
                    resolve({ success: false, message: '数据库地址不可达。', latency: 1200, errorType: 'NETWORK_UNREACHABLE' });
                } else if (host.includes('whitelist')) {
                    resolve({ success: false, message: 'IP 未加入数据库白名单。', latency, errorType: 'IP_NOT_ALLOWED' });
                } else if (user.includes('wrong') || password.includes('wrong')) {
                    resolve({ success: false, message: '账号或密码错误。', latency, errorType: 'AUTH_FAILED' });
                } else if (database.includes('missing') || database.includes('notfound')) {
                    resolve({ success: false, message: '数据库不存在。', latency, errorType: 'DATABASE_NOT_FOUND' });
                } else {
                    resolve({
                        success: true,
                        message: '连接成功。',
                        latency,
                        dbType: normalized.dbType,
                        database: normalized.database
                    });
                }
            }, 350);
        });
    }

    function normalizeSqlForValidation(sql) {
        return String(sql || '')
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
    }

    function validateSql(sql) {
        const cleaned = normalizeSqlForValidation(sql);
        if (!cleaned) {
            return { valid: false, errorType: 'SQL_EMPTY', message: 'SQL 内容不能为空。' };
        }
        const semicolons = (cleaned.match(/;/g) || []).length;
        const trailingSemicolonOnly = semicolons === 1 && /;\s*$/.test(cleaned);
        if (semicolons > 1 || (semicolons === 1 && !trailingSemicolonOnly)) {
            return { valid: false, errorType: 'SQL_MULTI_STATEMENT', message: '本期仅允许单条 SQL，不允许多语句执行。' };
        }
        const singleSql = cleaned.replace(/;\s*$/, '').trim();
        if (!/^select\b/i.test(singleSql)) {
            return { valid: false, errorType: 'SQL_NOT_SELECT', message: '当前节点仅支持 SELECT 查询，请检查 SQL 内容。' };
        }
        const forbidden = /\b(update|delete|insert|drop|alter|truncate|create|replace|merge|grant|revoke)\b/i;
        if (forbidden.test(singleSql)) {
            return {
                valid: false,
                errorType: 'SQL_FORBIDDEN_KEYWORD',
                message: '当前节点仅支持 SELECT 查询，不允许执行 UPDATE、DELETE、INSERT、DROP、ALTER 等操作。'
            };
        }
        return { valid: true, sql: singleSql, message: '校验通过。' };
    }

    function resolveVariableSql(variableRef) {
        const key = String(variableRef || '').trim();
        return Object.prototype.hasOwnProperty.call(variableSqlMap, key) ? variableSqlMap[key] : '';
    }

    function resolveSqlInput(sql) {
        const raw = String(sql || '').trim();
        const singleVariable = raw.match(/^{{[^{}]+}}$/);
        if (!singleVariable) {
            return { valid: true, sql: raw };
        }

        const resolved = resolveVariableSql(raw);
        if (!resolved) {
            return {
                valid: false,
                errorType: 'UPSTREAM_SQL_EMPTY',
                message: 'SQL 来源变量为空，请检查上游节点输出。'
            };
        }
        return { valid: true, sql: resolved };
    }

    function buildMockRows(sql, limit) {
        const normalizedLimit = Math.max(1, Math.min(Number(limit || DEFAULT_ROW_LIMIT), MAX_ROW_LIMIT));
        const text = String(sql || '').toLowerCase();
        if (text.includes('region') || text.includes('orders')) {
            const rows = [
                ['华东', 12000000],
                ['华南', 9000000],
                ['华北', 7600000],
                ['西南', 5200000],
                ['西北', 3100000]
            ];
            return {
                columns: [
                    { name: 'region', type: 'varchar' },
                    { name: 'total_amount', type: 'decimal' }
                ],
                rows: rows.slice(0, normalizedLimit),
                fullCount: rows.length
            };
        }
        if (text.includes('user')) {
            const rows = [
                ['2026-06-01', 326],
                ['2026-06-02', 418],
                ['2026-06-03', 287]
            ];
            return {
                columns: [
                    { name: 'created_date', type: 'date' },
                    { name: 'user_count', type: 'int' }
                ],
                rows: rows.slice(0, normalizedLimit),
                fullCount: rows.length
            };
        }
        const rows = [
            [1, '示例记录 A', 'success'],
            [2, '示例记录 B', 'success'],
            [3, '示例记录 C', 'success']
        ];
        return {
            columns: [
                { name: 'id', type: 'int' },
                { name: 'name', type: 'varchar' },
                { name: 'status', type: 'varchar' }
            ],
            rows: rows.slice(0, normalizedLimit),
            fullCount: rows.length
        };
    }

    function normalizeRowsToObjects(columns = [], rows = []) {
        const safeColumns = Array.isArray(columns) ? columns : [];
        return (Array.isArray(rows) ? rows : []).map(row => {
            if (row && typeof row === 'object' && !Array.isArray(row)) return row;
            return safeColumns.reduce((record, column, index) => {
                const key = column?.name || `field_${index + 1}`;
                record[key] = Array.isArray(row) ? row[index] : '';
                return record;
            }, {});
        });
    }

    function executeMockQuery(options = {}) {
        const datasource = getDataSourceById(options.datasourceId);
        const rawLimit = Number(options.limit || DEFAULT_ROW_LIMIT);
        const limit = Math.max(1, Math.min(rawLimit, MAX_ROW_LIMIT));
        const timeout = Number(options.timeout || DEFAULT_TIMEOUT);
        let sql = options.sql || '';
        let errorType = '';
        let errorMessage = '';

        if (!datasource) {
            errorType = 'DATASOURCE_NOT_FOUND';
            errorMessage = '数据源不存在，请重新选择。';
        } else if (datasource.status === 'disabled') {
            errorType = 'DATASOURCE_DISABLED';
            errorMessage = '当前数据源已停用，无法执行查询。';
        } else if (datasource.status === 'failed') {
            errorType = 'DATASOURCE_CONNECTION_FAILED';
            errorMessage = '数据源连接失败，请检查数据源配置或联系管理员。';
        }

        if (!errorMessage) {
            if (options.sqlMode === 'variable' && !String(sql).trim()) {
                sql = options.variableRef || '';
            }
            const resolvedSql = resolveSqlInput(sql);
            if (!resolvedSql.valid) {
                errorType = resolvedSql.errorType;
                errorMessage = resolvedSql.message;
            } else {
                sql = resolvedSql.sql;
            }
        }

        if (false && !errorMessage && options.sqlMode === 'variable') {
            sql = resolveVariableSql(options.variableRef);
            if (!sql) {
                errorType = 'UPSTREAM_SQL_EMPTY';
                errorMessage = 'SQL 来源变量为空，请检查上游节点输出。';
            }
        }

        const validation = !errorMessage ? validateSql(sql) : null;
        if (!errorMessage && validation && !validation.valid) {
            errorType = validation.errorType;
            errorMessage = validation.message;
        }

        if (!errorMessage && timeout <= 1) {
            errorType = 'QUERY_TIMEOUT';
            errorMessage = '查询执行超时，请缩小查询范围或优化 SQL。';
        }

        if (errorMessage) {
            const failed = {
                columns: [],
                rows: [],
                row_count: 0,
                content: [],
                execution_time: '0.00 秒',
                status: 'failed',
                error_code: errorType,
                error_message: errorMessage,
                executed_sql: sql
            };
            failed.result = {
                content: failed.content,
                isError: true
            };
            addQueryLog({
                workflowId: options.workflowId,
                nodeId: options.nodeId,
                datasourceId: options.datasourceId,
                sql,
                status: 'failed',
                rowCount: 0,
                executionTime: failed.execution_time,
                errorType,
                errorMessage
            });
            return failed;
        }

        const mock = buildMockRows(validation.sql, limit);
        const executionMs = 180 + Math.floor(Math.random() * 360);
        const content = normalizeRowsToObjects(mock.columns, mock.rows);
        const rowLimitMessage = mock.fullCount > limit ? `ROW_LIMIT_EXCEEDED: 查询结果超过最大返回行数限制，已按配置返回前 ${limit} 行。` : '';
        const output = {
            columns: mock.columns,
            rows: content,
            content,
            row_count: content.length,
            execution_time: `${(executionMs / 1000).toFixed(2)} 秒`,
            status: 'success',
            error_code: rowLimitMessage ? 'ROW_LIMIT_EXCEEDED' : '',
            error_message: rowLimitMessage,
            executed_sql: validation.sql
        };
        output.result = {
            content: output.content,
            isError: false
        };
        addQueryLog({
            workflowId: options.workflowId,
            nodeId: options.nodeId,
            datasourceId: datasource.id,
            sql: validation.sql,
            status: 'success',
            rowCount: output.row_count,
            executionTime: output.execution_time,
            errorType: output.error_message ? 'ROW_LIMIT_EXCEEDED' : '',
            errorMessage: output.error_message
        });
        return output;
    }

    function getStatusMeta(status) {
        const map = {
            connected: { text: '已连接', cls: 'bg-green-50 text-green-700 border-green-100', icon: 'fa-circle-check' },
            failed: { text: '连接失败', cls: 'bg-red-50 text-red-700 border-red-100', icon: 'fa-circle-exclamation' },
            disabled: { text: '已停用', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'fa-circle-pause' }
        };
        return map[status] || map.failed;
    }

    function getLifecycleStatusMeta(status) {
        if (status === 'disabled') {
            return { text: '停用', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'fa-circle-pause' };
        }
        return { text: '启用', cls: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'fa-circle-play' };
    }

    function getConnectionStatusMeta(item) {
        if (item?.lastTestResult?.success === true) return getStatusMeta('connected');
        if (item?.lastTestResult?.success === false) return getStatusMeta('failed');
        if (item?.status === 'connected' || item?.status === 'failed') return getStatusMeta(item.status);
        return { text: '未测试', cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: 'fa-circle-question' };
    }

    function getDbTypeText(type) {
        return type === 'postgresql' ? 'PostgreSQL' : 'MySQL';
    }

    function getPermissionText(permission) {
        const item = grantLevels.find(level => level.value === permission);
        return item ? item.label : '未授权';
    }

    function showToast(message, type = 'success') {
        if (typeof window.showToast === 'function') window.showToast(message, type);
        else alert(message);
    }

    window.VAgentDataSourceStore = {
        DATA_SOURCE_STORAGE_KEY,
        QUERY_LOG_STORAGE_KEY,
        MAX_ROW_LIMIT,
        DEFAULT_ROW_LIMIT,
        DEFAULT_TIMEOUT,
        grantTargets,
        grantLevels,
        variableSqlMap,
        maskPassword,
        loadDataSources,
        saveDataSources,
        getDataSourceById,
        upsertDataSource,
        updateDataSource,
        removeDataSource,
        loadQueryLogs,
        saveQueryLogs,
        addQueryLog,
        simulateConnectionTest,
        validateSql,
        resolveVariableSql,
        resolveSqlInput,
        executeMockQuery,
        getUsableDataSources: () => loadDataSources().filter(item => item.status === 'connected')
    };

    function readFilters() {
        dataSourceState.search = (document.getElementById('ds-search-input')?.value || '').trim().toLowerCase();
        dataSourceState.status = document.getElementById('ds-status-filter')?.value || 'all';
        dataSourceState.type = document.getElementById('ds-type-filter')?.value || 'all';
    }

    function getFilteredDataSources() {
        readFilters();
        return dataSourceState.items.filter(item => {
            const text = `${item.name} ${item.database} ${item.host} ${item.username}`.toLowerCase();
            const matchSearch = !dataSourceState.search || text.includes(dataSourceState.search);
            const matchStatus = dataSourceState.status === 'all'
                || (dataSourceState.status === 'enabled' ? item.status !== 'disabled' : item.status === dataSourceState.status);
            const matchType = dataSourceState.type === 'all' || item.dbType === dataSourceState.type;
            return matchSearch && matchStatus && matchType;
        });
    }

    function renderDataSourceList() {
        const tbody = document.getElementById('data-source-list-body');
        if (!tbody) return;
        const filtered = getFilteredDataSources();
        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-6 py-14 text-center">
                        <div class="mx-auto flex max-w-md flex-col items-center">
                            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                                <i class="fa-solid fa-database text-2xl" aria-hidden="true"></i>
                            </div>
                            <div class="text-base font-semibold text-gray-900">暂无数据源</div>
                            <p class="mt-2 text-sm text-gray-500">暂无数据源，请先创建数据库连接，创建后可在工作流的数据库查询节点中使用。</p>
                            <button type="button" onclick="openDataSourceModal()" class="mt-5 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                                新建数据源
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            if (window.syncDataTable) window.syncDataTable('data-source-table', { storageKey: 'dt-colwidths-data-source', stickyLast: false });
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const connectionMeta = getConnectionStatusMeta(item);
            const lifecycleMeta = getLifecycleStatusMeta(item.status);
            return `
                <tr class="transition-colors hover:bg-gray-50">
                    <td class="px-5 py-4 min-w-0">
                        <button type="button" onclick="openDataSourceDetail('${escapeHtml(item.id)}')" class="block max-w-[220px] truncate text-left font-medium text-gray-900 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>
                        <div class="mt-1 max-w-[220px] truncate text-xs text-gray-400" title="${escapeHtml(item.host)}">${escapeHtml(item.host)} / ${escapeHtml(item.database)}</div>
                    </td>
                    <td class="px-5 py-4 whitespace-nowrap text-gray-600">${getDbTypeText(item.dbType)}</td>
                    <td class="px-5 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${lifecycleMeta.cls}">
                            <i class="fa-solid ${lifecycleMeta.icon}" aria-hidden="true"></i>${lifecycleMeta.text}
                        </span>
                    </td>
                    <td class="px-5 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${connectionMeta.cls}">
                            <i class="fa-solid ${connectionMeta.icon}" aria-hidden="true"></i>${connectionMeta.text}
                        </span>
                    </td>
                    <td class="px-5 py-4 whitespace-nowrap text-gray-600">${escapeHtml(item.createdBy)}</td>
                    <td class="px-5 py-4 whitespace-nowrap text-xs text-gray-500">${escapeHtml(item.createdAt)}</td>
                    <td class="px-5 py-4 whitespace-nowrap text-xs text-gray-500">${escapeHtml(item.lastTestedAt || '-')}</td>
                    <td class="px-5 py-4 text-right whitespace-nowrap w-[172px]">
                        <div class="relative inline-flex items-center justify-end gap-1.5">
                            <button type="button" onclick="testDataSourceFromList('${escapeHtml(item.id)}', event)" class="inline-flex h-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20">测试连接</button>
                            <button type="button" data-ds-action-menu onclick="openDataSourceListActions('${escapeHtml(item.id)}', event)" class="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" title="更多操作" aria-label="更多操作">
                                <i class="fa-solid fa-ellipsis text-sm" aria-hidden="true"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        if (window.syncDataTable) window.syncDataTable('data-source-table', { storageKey: 'dt-colwidths-data-source', stickyLast: false });
    }

    window.openDataSourceListActions = function(id, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const item = dataSourceState.items.find(ds => ds.id === id);
        if (!item) return;
        const toggleText = item.status === 'disabled' ? '启用' : '停用';

        if (window.showActionMenu) {
            window.showActionMenu(event, [
                {
                    label: '编辑',
                    icon: 'fa-regular fa-pen-to-square',
                    onClick: () => editDataSource(id)
                },
                {
                    label: toggleText,
                    icon: item.status === 'disabled' ? 'fa-solid fa-circle-play' : 'fa-solid fa-circle-pause',
                    onClick: () => requestToggleDataSourceStatus(id)
                },
                {
                    label: '删除',
                    icon: 'fa-regular fa-trash-can',
                    className: 'text-red-600 hover:bg-red-50',
                    iconClass: 'text-red-500',
                    onClick: () => requestDeleteDataSource(id)
                }
            ]);
        }
    };

    function resetFieldErrors() {
        ['name', 'host', 'port', 'database', 'username', 'password'].forEach(key => {
            const input = document.getElementById(`ds-${key}`);
            const error = document.getElementById(`ds-${key}-error`);
            if (input) input.classList.remove('border-red-500');
            if (error) {
                error.classList.add('hidden');
                error.textContent = '';
            }
        });
    }

    function setFieldError(key, message) {
        const input = document.getElementById(`ds-${key}`);
        const error = document.getElementById(`ds-${key}-error`);
        if (input) input.classList.add('border-red-500');
        if (error) {
            error.textContent = message;
            error.classList.remove('hidden');
        }
    }

    function collectFormPayload() {
        const id = document.getElementById('ds-id')?.value || '';
        const existing = id ? window.VAgentDataSourceStore.getDataSourceById(id) : null;
        const passwordPlain = document.getElementById('ds-password')?.value || '';
        const dbType = document.getElementById('ds-type')?.value || 'mysql';
        const payload = {
            id: id || undefined,
            name: document.getElementById('ds-name')?.value.trim() || '',
            description: document.getElementById('ds-desc')?.value.trim() || '',
            dbType,
            space: existing?.space || '',
            host: document.getElementById('ds-host')?.value.trim() || '',
            port: document.getElementById('ds-port')?.value.trim() || (dbType === 'postgresql' ? '5432' : '3306'),
            database: document.getElementById('ds-database')?.value.trim() || '',
            username: document.getElementById('ds-username')?.value.trim() || '',
            passwordPlain,
            passwordMasked: passwordPlain ? maskPassword(passwordPlain) : existing?.passwordMasked,
            ssl: false,
            status: 'connected',
            createdBy: existing?.createdBy || 'Product Manager',
            createdAt: existing?.createdAt || nowString(),
            references: existing?.references || [],
            grants: existing?.grants || []
        };
        payload.connectionSignature = buildConnectionSignature(payload);
        return payload;
    }

    function validateForm(payload) {
        resetFieldErrors();
        let valid = true;
        if (!payload.name) {
            setFieldError('name', '请输入数据源名称。');
            valid = false;
        }
        if (!payload.host) {
            setFieldError('host', '请输入数据库地址。');
            valid = false;
        }
        if (!payload.port || Number(payload.port) < 1 || Number(payload.port) > 65535) {
            setFieldError('port', '请输入有效端口。');
            valid = false;
        }
        if (!payload.database) {
            setFieldError('database', '请输入数据库名。');
            valid = false;
        }
        if (!payload.username) {
            setFieldError('username', '请输入数据库用户名。');
            valid = false;
        }
        if (!payload.passwordPlain && !payload.passwordMasked) {
            setFieldError('password', '请输入数据库密码。');
            valid = false;
        }
        return valid;
    }

    function showTestResult(result, expectedSignature = '') {
        const box = document.getElementById('ds-test-result');
        if (!box) return;
        box.dataset.signature = expectedSignature;
        box.classList.remove('hidden', 'border-green-100', 'bg-green-50', 'text-green-700', 'border-red-100', 'bg-red-50', 'text-red-700', 'border-orange-100', 'bg-orange-50', 'text-orange-700');
        if (result?.success) {
            box.classList.add('border-green-100', 'bg-green-50', 'text-green-700');
            box.innerHTML = `<i class="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>${escapeHtml(result.message)} 数据库类型：${escapeHtml(getDbTypeText(result.dbType))}，数据库：${escapeHtml(result.database)}，测试耗时：${escapeHtml(result.latency)}ms`;
        } else {
            box.classList.add('border-red-100', 'bg-red-50', 'text-red-700');
            box.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>${escapeHtml(result?.message || '连接失败。')}`;
        }
    }

    window.initDataSourcePage = function() {
        dataSourceState.items = window.VAgentDataSourceStore.loadDataSources();
        dataSourceState.search = '';
        dataSourceState.status = 'all';
        dataSourceState.type = 'all';
        renderDataSourceList();
    };

    window.filterDataSources = function() {
        renderDataSourceList();
    };

    window.openDataSourceModal = function(id = null) {
        dataSourceState.editingId = id;
        dataSourceState.lastTestResult = null;
        const modal = document.getElementById('data-source-modal');
        const form = document.getElementById('data-source-form');
        const title = document.getElementById('ds-modal-title');
        if (!modal || !form) return;
        resetFieldErrors();
        form.reset();
        document.getElementById('ds-id').value = '';
        const resultBox = document.getElementById('ds-test-result');
        if (resultBox) {
            resultBox.classList.add('hidden');
            resultBox.textContent = '';
        }

        const existing = id ? window.VAgentDataSourceStore.getDataSourceById(id) : null;
        if (existing) {
            if (title) title.textContent = '编辑数据源';
            document.getElementById('ds-id').value = existing.id;
            document.getElementById('ds-name').value = existing.name;
            document.getElementById('ds-desc').value = existing.description || '';
            document.getElementById('ds-type').value = existing.dbType;
            document.getElementById('ds-host').value = existing.host;
            document.getElementById('ds-port').value = existing.port;
            document.getElementById('ds-database').value = existing.database;
            document.getElementById('ds-username').value = existing.username;
            document.getElementById('ds-password').value = '';
            document.getElementById('ds-password').placeholder = `已保存：${existing.passwordMasked}，留空表示沿用`;
            dataSourceState.lastTestResult = existing.lastTestResult?.success ? { ...existing.lastTestResult, signature: existing.connectionSignature } : null;
            if (existing.lastTestResult?.success) showTestResult(existing.lastTestResult, existing.connectionSignature);
        } else {
            if (title) title.textContent = '新建数据源';
            document.getElementById('ds-port').value = '3306';
            document.getElementById('ds-password').placeholder = '请输入数据库密码';
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('ds-name')?.focus(), 50);
    };

    window.editDataSource = function(id) {
        window.openDataSourceModal(id);
    };

    window.closeDataSourceModal = function() {
        const modal = document.getElementById('data-source-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        dataSourceState.editingId = null;
        dataSourceState.lastTestResult = null;
    };

    window.invalidateDataSourceTest = function() {
        dataSourceState.lastTestResult = null;
        const box = document.getElementById('ds-test-result');
        if (box && !box.classList.contains('hidden')) {
            box.classList.remove('border-green-100', 'bg-green-50', 'text-green-700', 'border-red-100', 'bg-red-50', 'text-red-700');
            box.classList.add('border-orange-100', 'bg-orange-50', 'text-orange-700');
            box.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true"></i>连接信息已变更，请重新测试连接。';
        }
    };

    window.toggleDataSourcePassword = function() {
        const input = document.getElementById('ds-password');
        const icon = document.getElementById('ds-password-eye');
        if (!input || !icon) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    };

    window.testDataSourceFromModal = async function() {
        const payload = collectFormPayload();
        if (!validateForm(payload)) return;
        const btn = document.getElementById('ds-test-btn');
        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> 测试中';
        }
        const result = await window.VAgentDataSourceStore.simulateConnectionTest(payload);
        dataSourceState.lastTestResult = { ...result, signature: payload.connectionSignature };
        showTestResult(result, payload.connectionSignature);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    };

    window.saveDataSourceFromModal = function() {
        const payload = collectFormPayload();
        if (!validateForm(payload)) return;
        if (!dataSourceState.lastTestResult?.success || dataSourceState.lastTestResult.signature !== payload.connectionSignature) {
            showTestResult({ success: false, message: '不允许保存连接失败或未测试的数据源，请先测试连接。' }, payload.connectionSignature);
            return;
        }
        payload.lastTestResult = dataSourceState.lastTestResult;
        payload.lastTestedAt = nowString();
        payload.status = 'connected';
        dataSourceState.items = window.VAgentDataSourceStore.upsertDataSource(payload);
        showToast(payload.id ? '数据源已更新' : '数据源已创建', 'success');
        window.closeDataSourceModal();
        renderDataSourceList();
    };

    window.testDataSourceFromList = async function(id, event) {
        if (event) event.stopPropagation();
        const item = window.VAgentDataSourceStore.getDataSourceById(id);
        if (!item) return;
        const btn = event?.target;
        const original = btn?.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = '测试中';
        }
        const result = await window.VAgentDataSourceStore.simulateConnectionTest({ ...item, passwordMasked: item.passwordMasked });
        const nextStatus = item.status === 'disabled' ? 'disabled' : (result.success ? 'connected' : 'failed');
        dataSourceState.items = window.VAgentDataSourceStore.updateDataSource(id, {
            status: nextStatus,
            lastTestedAt: nowString(),
            lastTestResult: result
        });
        showToast(result.message, result.success ? 'success' : 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = original;
        }
        renderDataSourceList();
    };

    function openImpactModal(action) {
        dataSourceState.impactAction = action;
        const item = window.VAgentDataSourceStore.getDataSourceById(action.id);
        if (!item) return;
        const modal = document.getElementById('data-source-impact-modal');
        const title = document.getElementById('ds-impact-title');
        const message = document.getElementById('ds-impact-message');
        const list = document.getElementById('ds-impact-reference-list');
        const confirm = document.getElementById('ds-impact-confirm');
        if (!modal || !title || !message || !list || !confirm) return;
        const refs = item.references || [];
        const actionText = action.type === 'delete' ? '删除' : (action.nextStatus === 'disabled' ? '停用' : '启用');
        title.textContent = `确认${actionText}数据源`;
        message.textContent = refs.length
            ? `数据源“${item.name}”已被 ${refs.length} 个工作流节点引用，${actionText}后会影响这些节点执行。`
            : `确认${actionText}数据源“${item.name}”？`;
        list.innerHTML = refs.length
            ? refs.map(ref => `
                <div class="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <div>
                        <div class="font-medium text-gray-800">${escapeHtml(ref.workflowName)}</div>
                        <div class="text-xs text-gray-400">${escapeHtml(ref.workflowId)} / ${escapeHtml(ref.nodeName)} (${escapeHtml(ref.nodeId)})</div>
                    </div>
                    <span class="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">受影响</span>
                </div>
            `).join('')
            : '<div class="py-3 text-center text-gray-400">暂无工作流引用</div>';
        confirm.textContent = `确认${actionText}`;
        confirm.className = action.type === 'delete'
            ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
            : 'rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    window.closeDataSourceImpactModal = function() {
        const modal = document.getElementById('data-source-impact-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        dataSourceState.impactAction = null;
    };

    window.requestToggleDataSourceStatus = function(id) {
        const item = window.VAgentDataSourceStore.getDataSourceById(id);
        if (!item) return;
        const nextStatus = item.status === 'disabled' ? 'connected' : 'disabled';
        if (nextStatus === 'disabled' && item.references?.length) {
            openImpactModal({ type: 'status', id, nextStatus });
            return;
        }
        dataSourceState.items = window.VAgentDataSourceStore.updateDataSource(id, { status: nextStatus });
        showToast(nextStatus === 'disabled' ? '数据源已停用' : '数据源已启用', 'success');
        renderDataSourceList();
    };

    window.requestDeleteDataSource = function(id) {
        openImpactModal({ type: 'delete', id });
    };

    window.confirmDataSourceImpactAction = function() {
        const action = dataSourceState.impactAction;
        if (!action) return;
        if (action.type === 'delete') {
            dataSourceState.items = window.VAgentDataSourceStore.removeDataSource(action.id);
            showToast('数据源已删除', 'success');
        } else if (action.type === 'status') {
            dataSourceState.items = window.VAgentDataSourceStore.updateDataSource(action.id, { status: action.nextStatus });
            showToast(action.nextStatus === 'disabled' ? '数据源已停用' : '数据源已启用', 'success');
        }
        window.closeDataSourceImpactModal();
        renderDataSourceList();
    };

    window.openDataSourceDetail = function(id) {
        dataSourceState.detailId = id;
        dataSourceState.detailTab = 'basic';
        resetDataSourceLogFilters();
        const drawer = document.getElementById('data-source-detail-drawer');
        if (!drawer) return;
        drawer.classList.remove('hidden');
        renderDataSourceDetail();
    };

    window.closeDataSourceDetailDrawer = function() {
        const drawer = document.getElementById('data-source-detail-drawer');
        if (!drawer) return;
        drawer.classList.add('hidden');
        dataSourceState.detailId = null;
    };

    window.switchDataSourceDetailTab = function(tab) {
        dataSourceState.detailTab = tab;
        renderDataSourceDetail();
    };

    function renderDataSourceDetail() {
        const item = window.VAgentDataSourceStore.getDataSourceById(dataSourceState.detailId);
        const title = document.getElementById('ds-detail-title');
        const subtitle = document.getElementById('ds-detail-subtitle');
        const content = document.getElementById('ds-detail-content');
        if (!item || !content) return;
        if (title) title.textContent = item.name;
        if (subtitle) subtitle.textContent = `${getDbTypeText(item.dbType)} / ${item.host} / ${item.database}`;
        document.querySelectorAll('.ds-detail-tab').forEach(btn => {
            const active = btn.dataset.tab === dataSourceState.detailTab;
            btn.className = active
                ? 'ds-detail-tab rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700'
                : 'ds-detail-tab rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100';
        });

        if (dataSourceState.detailTab === 'permissions') {
            dataSourceState.detailTab = 'basic';
            renderDataSourceDetail();
            return;
        }

        if (dataSourceState.detailTab === 'references') {
            content.innerHTML = getReferenceDetailHTML(item);
        } else if (dataSourceState.detailTab === 'logs') {
            content.innerHTML = getLogDetailHTML(item);
        } else {
            content.innerHTML = getBasicDetailHTML(item);
        }
    }

    function detailRow(label, value) {
        return `
            <div class="grid grid-cols-[120px,1fr] gap-4 border-b border-gray-100 py-3 last:border-0">
                <div class="text-sm text-gray-500">${escapeHtml(label)}</div>
                <div class="min-w-0 break-words text-sm text-gray-900">${escapeHtml(value || '-')}</div>
            </div>
        `;
    }

    function getBasicDetailHTML(item) {
        const statusMeta = getStatusMeta(item.status);
        return `
            <div class="space-y-5">
                <div class="rounded-lg border border-gray-100 bg-white p-4">
                    <div class="mb-3 flex items-center justify-between">
                        <h4 class="text-sm font-semibold text-gray-900">基本信息</h4>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${statusMeta.cls}">
                            <i class="fa-solid ${statusMeta.icon}" aria-hidden="true"></i>${statusMeta.text}
                        </span>
                    </div>
                    ${detailRow('数据源名称', item.name)}
                    ${detailRow('描述', item.description)}
                    ${detailRow('创建人', item.createdBy)}
                    ${detailRow('创建时间', item.createdAt)}
                </div>
                <div class="rounded-lg border border-gray-100 bg-white p-4">
                    <h4 class="mb-3 text-sm font-semibold text-gray-900">连接信息</h4>
                    ${detailRow('数据库类型', getDbTypeText(item.dbType))}
                    ${detailRow('Host', item.host)}
                    ${detailRow('Port', item.port)}
                    ${detailRow('Database', item.database)}
                    ${detailRow('Username', item.username)}
                    ${detailRow('Password', item.passwordMasked)}
                    ${detailRow('最近测试', item.lastTestedAt || '-')}
                </div>
            </div>
        `;
    }

    function getReferenceDetailHTML(item) {
        if (!item.references?.length) {
            return '<div class="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">暂无工作流引用</div>';
        }
        return `
            <div class="space-y-3">
                ${item.references.map(ref => `
                    <div class="rounded-lg border border-gray-100 bg-white p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <div class="font-medium text-gray-900">${escapeHtml(ref.workflowName)}</div>
                                <div class="mt-1 text-xs text-gray-400">${escapeHtml(ref.workflowId)}</div>
                            </div>
                            <span class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">${escapeHtml(ref.nodeName)}</span>
                        </div>
                        <div class="mt-3 text-xs text-gray-500">节点 ID：${escapeHtml(ref.nodeId)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function resetDataSourceLogFilters() {
        dataSourceState.logKeyword = '';
        dataSourceState.logStatus = 'all';
        dataSourceState.logPage = 1;
        dataSourceState.logPageSize = 20;
    }

    function filterDataSourceLogs(logs) {
        const keyword = String(dataSourceState.logKeyword || '').trim().toLowerCase();
        return logs.filter(log => {
            const matchStatus = dataSourceState.logStatus === 'all' || log.status === dataSourceState.logStatus;
            const text = [
                log.workflowId,
                log.nodeId,
                log.executor,
                log.executedAt,
                log.sql,
                log.errorType,
                log.errorMessage
            ].filter(Boolean).join(' ').toLowerCase();
            const matchKeyword = !keyword || text.includes(keyword);
            return matchStatus && matchKeyword;
        });
    }

    function getQueryLogRowHTML(log) {
        const success = log.status === 'success';
        const errorText = log.errorMessage
            ? `${log.errorType ? `${log.errorType}：` : ''}${log.errorMessage}`
            : '-';
        return `
            <tr class="align-top transition-colors hover:bg-gray-50">
                <td class="whitespace-nowrap px-3 py-3 text-gray-600">${escapeHtml(log.executedAt || '-')}</td>
                <td class="px-3 py-3">
                    <div class="max-w-[150px] truncate font-medium text-gray-800" title="${escapeHtml(log.workflowId || '-')}">${escapeHtml(log.workflowId || '-')}</div>
                    <div class="mt-1 max-w-[150px] truncate text-gray-400" title="${escapeHtml(log.nodeId || '-')}">${escapeHtml(log.nodeId || '-')}</div>
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-gray-600">${escapeHtml(log.executor || '-')}</td>
                <td class="whitespace-nowrap px-3 py-3">
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
                        <i class="fa-solid ${success ? 'fa-circle-check' : 'fa-circle-xmark'} text-[10px]" aria-hidden="true"></i>
                        ${success ? '成功' : '失败'}
                    </span>
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-right text-gray-600">${escapeHtml(log.rowCount ?? 0)}</td>
                <td class="whitespace-nowrap px-3 py-3 text-gray-600">${escapeHtml(log.executionTime || '-')}</td>
                <td class="px-3 py-3">
                    <code class="block max-w-[220px] truncate rounded bg-gray-50 px-2 py-1 font-mono text-[11px] leading-5 text-gray-700" title="${escapeHtml(log.sql || '-')}">${escapeHtml(log.sql || '-')}</code>
                </td>
                <td class="px-3 py-3">
                    <div class="max-w-[180px] truncate ${log.errorMessage ? 'text-red-600' : 'text-gray-400'}" title="${escapeHtml(errorText)}">${escapeHtml(errorText)}</div>
                </td>
            </tr>
        `;
    }

    function getLogDetailHTML(item) {
        const logs = window.VAgentDataSourceStore.loadQueryLogs().filter(log => log.datasourceId === item.id);
        if (!logs.length) {
            return '<div class="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">暂无查询日志</div>';
        }

        const filteredLogs = filterDataSourceLogs(logs);
        const pageSize = Number(dataSourceState.logPageSize) || 20;
        const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
        dataSourceState.logPage = Math.min(Math.max(1, Number(dataSourceState.logPage) || 1), totalPages);
        const currentPage = dataSourceState.logPage;
        const startIndex = (currentPage - 1) * pageSize;
        const pageLogs = filteredLogs.slice(startIndex, startIndex + pageSize);
        const rangeStart = filteredLogs.length ? startIndex + 1 : 0;
        const rangeEnd = startIndex + pageLogs.length;

        return `
            <div class="space-y-4">
                <div class="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 lg:flex-row lg:items-center">
                    <label class="relative block flex-1">
                        <span class="sr-only">搜索查询日志</span>
                        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                        <input type="search" value="${escapeHtml(dataSourceState.logKeyword)}" oninput="updateDataSourceLogKeyword(this.value)" placeholder="搜索 SQL、工作流、节点、执行人、错误..." class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </label>
                    <label class="sr-only" for="ds-log-status-filter">执行状态</label>
                    <select id="ds-log-status-filter" onchange="updateDataSourceLogStatus(this.value)" class="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="all" ${dataSourceState.logStatus === 'all' ? 'selected' : ''}>全部状态</option>
                        <option value="success" ${dataSourceState.logStatus === 'success' ? 'selected' : ''}>成功</option>
                        <option value="failed" ${dataSourceState.logStatus === 'failed' ? 'selected' : ''}>失败</option>
                    </select>
                    <label class="sr-only" for="ds-log-page-size">每页条数</label>
                    <select id="ds-log-page-size" onchange="updateDataSourceLogPageSize(this.value)" class="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${[20, 50, 100].map(size => `<option value="${size}" ${pageSize === size ? 'selected' : ''}>每页 ${size} 条</option>`).join('')}
                    </select>
                </div>

                <div class="overflow-hidden rounded-lg border border-gray-100 bg-white">
                    <div class="max-h-[calc(100vh-350px)] overflow-auto">
                        <table class="min-w-[980px] w-full text-left text-xs">
                            <thead class="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 text-gray-500">
                                <tr>
                                    <th class="px-3 py-3 font-medium">执行时间</th>
                                    <th class="px-3 py-3 font-medium">工作流 / 节点</th>
                                    <th class="px-3 py-3 font-medium">执行人</th>
                                    <th class="px-3 py-3 font-medium">状态</th>
                                    <th class="px-3 py-3 text-right font-medium">行数</th>
                                    <th class="px-3 py-3 font-medium">耗时</th>
                                    <th class="px-3 py-3 font-medium">SQL</th>
                                    <th class="px-3 py-3 font-medium">错误信息</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 bg-white">
                                ${pageLogs.length ? pageLogs.map(getQueryLogRowHTML).join('') : `
                                    <tr>
                                        <td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400">没有符合筛选条件的查询日志</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                    <div class="flex flex-col gap-3 border-t border-gray-100 bg-white px-3 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                        <div>共 ${escapeHtml(filteredLogs.length)} 条，当前显示 ${escapeHtml(rangeStart)}-${escapeHtml(rangeEnd)} 条</div>
                        <div class="flex items-center justify-end gap-2">
                            <button type="button" onclick="goDataSourceLogPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} class="min-h-[32px] rounded-md border border-gray-200 px-2.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500">上一页</button>
                            <label class="flex items-center gap-1">
                                <span>第</span>
                                <input type="number" min="1" max="${escapeHtml(totalPages)}" value="${escapeHtml(currentPage)}" onchange="goDataSourceLogPage(this.value)" class="h-8 w-14 rounded-md border border-gray-200 px-2 text-center text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <span>/ ${escapeHtml(totalPages)} 页</span>
                            </label>
                            <button type="button" onclick="goDataSourceLogPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} class="min-h-[32px] rounded-md border border-gray-200 px-2.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500">下一页</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.updateDataSourceLogKeyword = function(value) {
        dataSourceState.logKeyword = value || '';
        dataSourceState.logPage = 1;
        renderDataSourceDetail();
    };

    window.updateDataSourceLogStatus = function(value) {
        dataSourceState.logStatus = ['success', 'failed'].includes(value) ? value : 'all';
        dataSourceState.logPage = 1;
        renderDataSourceDetail();
    };

    window.updateDataSourceLogPageSize = function(value) {
        dataSourceState.logPageSize = [20, 50, 100].includes(Number(value)) ? Number(value) : 20;
        dataSourceState.logPage = 1;
        renderDataSourceDetail();
    };

    window.goDataSourceLogPage = function(page) {
        dataSourceState.logPage = Math.max(1, Number(page) || 1);
        renderDataSourceDetail();
    };

    document.addEventListener('view-loaded', event => {
        if (event.detail?.view === 'data-source') {
            window.initDataSourcePage();
        }
    });
})();
