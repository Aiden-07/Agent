window.renderSystemLogs = function() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    const ips = ['192.168.1.10', '192.168.1.15', '10.0.0.5', '203.115.0.1', '172.16.0.23', 'localhost'];
    
    // Helper to format date
    function formatDate(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    // Base time: now
    let currentTime = new Date();
    const logs = [];

    // Helper to add log
    function addLog(minutesAgo, user, type, detail, color = 'blue') {
        const t = new Date(currentTime.getTime() - minutesAgo * 60000);
        logs.push({
            id: Math.random().toString(36).substring(2, 9),
            time: formatDate(t),
            user: user,
            type: type,
            detail: detail,
            ip: ips[Math.floor(Math.random() * ips.length)],
            status: Math.random() < 0.85 ? '成功' : '失败',
            color: color
        });
    }

    let m = 0; // minutes accumulator

    // 1. User
    addLog(m += 5, '陈晓明', '用户登录', '登录系统成功', 'green');
    addLog(m += 120, '陈晓明', '用户退出', '退出系统', 'gray');

    // 2. Agent
    addLog(m += 10, '刘伟', '新增智能体', '创建智能体 客服助手 [AGT-2024001]', 'green');
    addLog(m += 15, '刘伟', '编辑智能体', '修改 客服助手 [AGT-2024001]：名称 "客服助手" → "智能客服"；模型 "GPT-3.5" → "GPT-4"；温度 "0.7" → "0.5"', 'blue');
    addLog(m += 5, '刘伟', '发布智能体', '发布 客服助手 [AGT-2024001] 版本 v1.0.1', 'purple');
    addLog(m += 30, '刘伟', '启用智能体', '启用 客服助手 [AGT-2024001]，状态：停用 → 启用', 'green');
    addLog(m += 20, '刘伟', '修改发布渠道', '修改 客服助手 [AGT-2024001] 渠道：新增 "微信公众号"', 'blue');
    addLog(m += 60, '刘伟', '版本回滚', '回滚 客服助手 [AGT-2024001] 从 v1.0.2 → v1.0.1', 'yellow');
    addLog(m += 10, '刘伟', '删除智能体', '删除智能体 旧版助手 [AGT-OLD-009], 删除前状态: 停用', 'red');

    // 3. Orchestrator
    addLog(m += 45, '王志强', '新增工作流', '创建编排流程 订单处理流 [ORC-101]', 'green');
    addLog(m += 10, '王志强', '编辑工作流', '修改 订单处理流 [ORC-101]：节点 "人工审核" 增加超时设置 "30m"；新增分支 "自动退款"', 'blue');
    addLog(m += 5, '王志强', '发布工作流', '发布 订单处理流 [ORC-101] 版本 v1.0', 'purple');
    addLog(m += 200, '王志强', '停用工作流', '停用 订单处理流 [ORC-101]', 'yellow');
    addLog(m += 5, '王志强', '删除工作流', '删除工作流 临时流程 [ORC-TEMP-001]', 'red');

    // 4. Parser
    addLog(m += 300, '系统自动', '编辑解析器', '修改 PDF 解析器配置：启用 OCR 增强模式；最大页数 50 → 100', 'blue');

    // 5. KB
    addLog(m += 20, '赵敏', '添加知识库', '创建知识库 销售话术库 [KB-Sales]', 'green');
    addLog(m += 5, '赵敏', '设置知识库', '修改 销售话术库 [KB-Sales]：检索模式 "向量检索" → "混合检索"；TopK 3 → 5', 'blue');
    addLog(m += 100, '赵敏', '删除知识库', '删除知识库 测试库 [KB-Test]', 'red');

    // 6. KB Docs
    addLog(m += 10, '赵敏', '上传文档', '上传文件 "2024Q1销售手册.pdf" (5.2MB) 到 销售话术库 [KB-Sales]', 'green');
    addLog(m += 2, '系统自动', '文档解析', '完成 "2024Q1销售手册.pdf" 解析，耗时 45s', 'gray');
    addLog(m += 5, '赵敏', '修改切片', '修改 "2024Q1销售手册.pdf" 切片配置：块大小 500 → 800；重叠 50 → 100', 'blue');
    addLog(m += 50, '赵敏', '删除文档', '从 销售话术库 [KB-Sales] 删除文档 "旧版手册.doc"', 'red');

    // 7. Components
    addLog(m += 150, '刘伟', '新增组件', '注册自定义组件 天气查询 [CMP-Weather]', 'green');
    addLog(m += 10, '刘伟', '编辑组件', '更新 天气查询 [CMP-Weather]：接口地址变更为 "https://api.weather.com/v3"；超时时间 5s → 10s', 'blue');
    addLog(m += 20, '刘伟', '删除组件', '删除组件 废弃组件 [CMP-Deprecated]', 'red');

    // 8. Eval
    addLog(m += 60, '王志强', '创建测评', '新建测评任务 RAG准确率测试 [EVAL-005]', 'green');
    addLog(m += 100, '王志强', '删除测评', '删除历史测评记录 历史测试 [EVAL-001]', 'red');

    // 9. Enterprise
    addLog(m += 500, '刘伟', '修改企业信息', '更新企业名称 "某某科技" → "某某智能科技"；联系电话 "010-12345678" → "010-87654321"', 'blue');

    // 10. User Mgmt
    addLog(m += 40, '刘伟', '添加用户', '新增用户 孙佳 [sunjia]', 'green');
    addLog(m += 5, '刘伟', '编辑用户', '修改 孙佳 [sunjia]：部门 "研发部" → "产品部"；职位 "工程师" → "高级产品经理"', 'blue');
    addLog(m += 10, '刘伟', '用户状态变更', '将 孙佳 [sunjia] 状态置为 "离职"', 'yellow');

    // 11. Role Mgmt
    addLog(m += 30, '刘伟', '新增角色', '创建角色 审计员 [Role-Auditor]', 'green');
    addLog(m += 10, '刘伟', '编辑角色', '修改 审计员 [Role-Auditor] 权限：增加 "查看日志"；移除 "删除用户"', 'blue');
    addLog(m += 5, '刘伟', '删除角色', '删除角色 临时角色 [Role-Temp]', 'red');

    // Sort by time desc
    logs.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Store logs globally or in a way accessible to search
    window.allSystemLogs = logs;

    // Render function
    function renderTable(logsToRender) {
        if (!tbody) return;
        
        if (logsToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i class="fa-solid fa-search text-gray-300 text-2xl"></i>
                            <p>未找到匹配的日志记录</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logsToRender.map(log => `
            <tr class="hover:bg-gray-50 transition-colors animate-fade-in">
                <td class="px-6 py-3 text-gray-500 whitespace-nowrap">${log.time}</td>
                <td class="px-6 py-3 font-medium text-gray-800">${log.user}</td>
                <td class="px-6 py-3">
                    <span class="px-2 py-0.5 rounded text-xs font-medium bg-${log.color}-50 text-${log.color}-600 border border-${log.color}-100">
                        ${log.type}
                    </span>
                </td>
                <td class="px-6 py-3 text-gray-600 max-w-md truncate" title="${log.detail}">${log.detail}</td>
                <td class="px-6 py-3 text-gray-500 font-mono text-xs">${log.ip}</td>
                <td class="px-6 py-3 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === '成功' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}">
                        <span class="w-1.5 h-1.5 mr-1.5 rounded-full ${log.status === '成功' ? 'bg-green-500' : 'bg-red-500'}"></span>
                        ${log.status}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // Initial Render
    renderTable(logs);

    // Setup Search
    const searchInput = document.getElementById('logs-search-input');
    const clearBtn = document.getElementById('logs-search-clear');

    if (searchInput && clearBtn) {
        // Clear previous event listeners if any (though typically this runs once per view load)
        const newSearchInput = searchInput.cloneNode(true);
        const newClearBtn = clearBtn.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);

        const handleSearch = (e) => {
            const term = e.target.value.toLowerCase().trim();
            
            // Show/Hide clear button
            if (term.length > 0) {
                newClearBtn.classList.remove('hidden');
            } else {
                newClearBtn.classList.add('hidden');
            }

            // Filter
            const filtered = window.allSystemLogs.filter(log => {
                return log.user.toLowerCase().includes(term) ||
                       log.type.toLowerCase().includes(term) ||
                       log.detail.toLowerCase().includes(term) ||
                       log.ip.toLowerCase().includes(term) ||
                       log.time.toLowerCase().includes(term) ||
                       log.status.includes(term);
            });

            renderTable(filtered);
        };

        const handleClear = () => {
            newSearchInput.value = '';
            newClearBtn.classList.add('hidden');
            renderTable(window.allSystemLogs);
            newSearchInput.focus();
        };

        newSearchInput.addEventListener('input', handleSearch);
        newClearBtn.addEventListener('click', handleClear);
    }
};