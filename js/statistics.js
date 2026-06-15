
// Statistics Module
(function() {
    // State
    let state = {
        data: [], // Flattened list of visible rows
        expandedNodes: new Set(), // Set of IDs
        loading: false,
        dateRange: [], // [Date, Date]
        pickerInstance: null
    };

    // Configuration
    const CONFIG = {
        maxRows: 3000,
        indentation: 16, // px
        maxDepth: 4,
        headers: {
            deptName: '部门名称',
            dialogCount: '对话次数',
            userFeedback: '用户反馈',
            like: '点赞',
            dislike: '点踩',
            noRating: '未评价',
            satisfaction: '满意度',
            feedbackTooltip: '包含点赞、点踩、未评价三项指标'
        }
    };

    // Organization Structure Definition
    const ORGANIZATION_STRUCTURE = {
        name: "好丽友",
        children: [
            {
                name: "MKT TEAM",
                children: [
                    { name: "设计Part" },
                    { name: "派Part" },
                    { name: "饼干软糖Part" },
                    { name: "MKT企划Part" },
                    {
                        name: "新事业Part",
                        children: [
                            { name: "产品企划1组" },
                            { name: "产品企划2组" },
                            { name: "健康品牌组" }
                        ]
                    },
                    {
                        name: "膨化Part",
                        children: [
                            { name: "膨化1组" },
                            { name: "膨化2组" }
                        ]
                    }
                ]
            },
            {
                name: "品质管理 TEAM",
                children: [
                    { name: "MKT 企划Part" },
                    { name: "设计Part" },
                    { name: "派Part" },
                    { name: "饼干软糖Part" },
                    { name: "新事业Part" },
                    { name: "膨化Part" },
                    {
                        name: "食品安全Part",
                        children: [
                            { name: "法规组" },
                            { name: "理化分析组" },
                            { name: "微生物分析组" }
                        ]
                    },
                    {
                        name: "品质管理Part",
                        children: [
                            { name: "卫生管理组" },
                            { name: "品质管理组" },
                            { name: "包装组" }
                        ]
                    }
                ]
            },
            {
                name: "支援本部",
                children: [
                    { name: "MKT 企划Part" },
                    { name: "设计Part" },
                    { name: "派Part" },
                    { name: "饼干软糖Part" },
                    { name: "新事业Part" },
                    { name: "膨化Part" },
                    { name: "品质管理Part" },
                    { name: "食品安全Part" },
                    {
                        name: "人事TEAM",
                        children: [
                            { name: "培训PART" },
                            { name: "人事PART" }
                        ]
                    },
                    {
                        name: "经营支援TEAM",
                        children: [
                            { name: "IT PART" },
                            { name: "经营管理PART" },
                            { name: "市场费改善TF" }
                        ]
                    }
                ]
            },
            {
                name: "物流TEAM",
                children: [
                    {
                        name: "物流企划PART",
                        children: [
                            { name: "需求供应链组" },
                            { name: "物流企划组" }
                        ]
                    }
                ]
            },
            {
                name: "生产本部",
                children: [
                    {
                        name: "上海工厂",
                        children: [
                            { name: "生产1PART (SH)" },
                            { name: "生产2PART (SH)" },
                            { name: "设备PART (SH)" },
                            { name: "品质安全PART(SH)" },
                            { name: "业务PART (SH)" }
                        ]
                    },
                    {
                        name: "包装工厂",
                        children: [
                            { name: "生产PART(LY)" }
                        ]
                    },
                    {
                        name: "广州工厂",
                        children: [
                            { name: "业务PART(GZ)" },
                            { name: "生产PART (GZ)" },
                            { name: "品质安全PART (GZ)" },
                            { name: "设备PART (GZ)" }
                        ]
                    },
                    {
                        name: "廊坊工厂",
                        children: [
                            { name: "业务PART" },
                            { name: "生产1PART (SH)" },
                            { name: "生产2 PART" },
                            { name: "生产3 PART" },
                            { name: "设备PART" }
                        ]
                    },
                    {
                        name: "沈阳工厂",
                        children: []
                    }
                ]
            },
            { name: "研发本部" },
            { name: "营业本部" },
            { name: "财经本部" },
            { name: "采购PART" }
        ]
    };

    // Mock Data Generator
    function generateMockData(depth, parentId = null) {
        // If it's the root call (depth 0), return the root node wrapper
        if (depth === 0 && !parentId) {
            return [createNode(ORGANIZATION_STRUCTURE, 0, 'root')];
        }
        
        // Find the parent node in the static structure to get its children
        // This requires traversing the structure to find the node with parentId
        // Since we don't have a direct map, we can look up by ID convention if we strictly follow it,
        // or we can pass the structure node itself.
        // However, the current architecture calls generateMockData(depth, parentId) dynamically.
        // To support lazy loading simulation, we need to find the "definition" of the children for the given parentId.
        
        // Better approach: Since the structure is static, we can pre-generate the whole tree or find the sub-tree.
        // But the current app uses lazy loading simulation.
        
        // Let's implement a helper to find a node by ID in the static structure.
        // We need a consistent ID generation strategy.
        // Let's assume ID is path-based or we generate it on the fly.
        // Actually, the previous implementation used `parentId-index`.
        // We can replicate that.
        
        const parentNodeDef = findNodeDefinition(ORGANIZATION_STRUCTURE, parentId, 'root');
        
        if (!parentNodeDef || !parentNodeDef.children) {
            return [];
        }

        return parentNodeDef.children.map((childDef, index) => {
            const id = `${parentId}-${index}`;
            return createNode(childDef, depth, id);
        });
    }

    function createNode(def, depth, id) {
        // Generate random stats
        const dialogCount = Math.floor(Math.random() * 5000);
        const likes = Math.floor(dialogCount * (0.3 + Math.random() * 0.4)); // 30-70%
        const dislikes = Math.floor(dialogCount * (0.05 + Math.random() * 0.1)); // 5-15%
        const noRating = dialogCount - likes - dislikes;
        
        // Avoid negative noRating
        const safeNoRating = Math.max(0, noRating);

        // Recalculate dialogCount to match sum
        const finalDialogCount = likes + dislikes + safeNoRating;

        const satisfaction = finalDialogCount > 0 ? (likes / finalDialogCount) * 100 : 0;

        return {
            id: id,
            parentId: id.split('-').slice(0, -1).join('-') || null, // rough parent extraction
            name: def.name,
            depth: depth,
            dialogCount: finalDialogCount,
            likes: likes,
            dislikes: dislikes,
            noRating: safeNoRating,
            satisfaction: parseFloat(satisfaction.toFixed(1)),
            hasChildren: !!(def.children && def.children.length > 0),
            childrenLoaded: false,
            children: []
        };
    }

    function findNodeDefinition(root, targetId, currentId) {
        if (targetId === currentId) return root;
        
        if (root.children) {
            for (let i = 0; i < root.children.length; i++) {
                const childId = `${currentId}-${i}`;
                if (targetId === childId) {
                    return root.children[i];
                }
                // Check if targetId starts with childId (is a descendant)
                if (targetId.startsWith(childId + '-')) {
                    return findNodeDefinition(root.children[i], targetId, childId);
                }
            }
        }
        return null;
    }

    // Helper: Formatters
    const formatPercent = (val) => val === null || val === undefined ? '-' : `${val.toFixed(1)}%`;
    const formatInt = (val) => val === null || val === undefined ? '-' : val.toLocaleString('zh-CN');

    // Render Header
    function renderHeader() {
        const thead = document.querySelector('#statistics-container thead');
        if (!thead) return;

        const { deptName, dialogCount, userFeedback, like, dislike, noRating, satisfaction, feedbackTooltip } = CONFIG.headers;

        thead.innerHTML = `
            <tr>
                <th rowspan="2" class="px-4 py-3 border-r border-[#d9d9d9] font-bold w-1/4 align-middle text-center bg-[#f5f5f5] text-center">${deptName}</th>
                <th rowspan="2" class="px-4 py-3 border-r border-[#d9d9d9] font-bold w-1/6 align-middle bg-[#f5f5f5] text-center">${dialogCount}</th>
                <th colspan="3" class="px-4 py-3 border-r border-[#d9d9d9] font-bold bg-[#f5f5f5] group relative cursor-help text-center">
                    ${userFeedback}
                    <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded hidden group-hover:block whitespace-nowrap z-50 shadow-lg font-normal text-left">
                        ${feedbackTooltip}
                        <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                </th>
                <th rowspan="2" class="px-4 py-3 font-bold w-1/6 align-middle bg-[#f5f5f5] text-center">${satisfaction}</th>
            </tr>
            <tr>
                <th class="px-4 py-2 border-r border-[#d9d9d9] font-bold border-t border-[#e8e8e8] bg-[#fafafa] text-xs text-gray-500 text-center">${like}</th>
                <th class="px-4 py-2 border-r border-[#d9d9d9] font-bold border-t border-[#e8e8e8] bg-[#fafafa] text-xs text-gray-500 text-center">${dislike}</th>
                <th class="px-4 py-2 border-r border-[#d9d9d9] font-bold border-t border-[#e8e8e8] bg-[#fafafa] text-xs text-gray-500 text-center">${noRating}</th>
            </tr>
        `;
    }

    // Helper: Render Row
    function renderRow(node, index) {
        const isExpanded = state.expandedNodes.has(node.id);
        const icon = node.hasChildren 
            ? (isExpanded ? '▼' : '▶') 
            : '';
        const iconColor = '#595959';
        const indent = node.depth * CONFIG.indentation;
        
        const isGroup = node.hasChildren;
        const bgClass = isGroup ? 'bg-[#fffbe6] font-bold' : 'odd:bg-white even:bg-[#fafafa]';

        return `
            <tr class="h-10 border-b border-[#d9d9d9] hover:bg-blue-50 transition-colors ${bgClass}" data-id="${node.id}">
                <td class="px-4 py-2 border-r border-[#d9d9d9] whitespace-nowrap text-left">
                    <div style="padding-left: ${indent}px; display: flex; align-items: center; gap: 4px;">
                        <span class="cursor-pointer select-none w-4 text-center text-[12px]" 
                              style="color: ${iconColor}"
                              onclick="window.StatisticsModule.toggleNode('${node.id}')">
                            ${icon}
                        </span>
                        <span>${node.name}</span>
                    </div>
                </td>
                <td class="px-4 py-2 border-r border-[#d9d9d9] text-left">${formatInt(node.dialogCount)}</td>
                <td class="px-4 py-2 border-r border-[#d9d9d9] text-left text-green-600">${formatInt(node.likes)}</td>
                <td class="px-4 py-2 border-r border-[#d9d9d9] text-left text-red-500">${formatInt(node.dislikes)}</td>
                <td class="px-4 py-2 border-r border-[#d9d9d9] text-left text-gray-400">${formatInt(node.noRating)}</td>
                <td class="px-4 py-2 text-left font-medium">${formatPercent(node.satisfaction)}</td>
            </tr>
        `;
    }

    // Core: Render Table
    function renderTable() {
        const tbody = document.getElementById('stats-table-body');
        if (!tbody) return;

        const flatList = flattenData(state.data);
        tbody.innerHTML = flatList.map(renderRow).join('');
    }

    function flattenData(nodes) {
        let result = [];
        for (const node of nodes) {
            result.push(node);
            if (node.hasChildren && state.expandedNodes.has(node.id) && node.children) {
                result = result.concat(flattenData(node.children));
            }
        }
        return result;
    }

    // Date Picker Logic
    function initDatePicker() {
        const input = document.getElementById('stats-date-range');
        if (!input || state.pickerInstance) return;

        state.pickerInstance = flatpickr(input, {
            mode: "range",
            locale: "zh",
            dateFormat: "Y-m-d",
            showMonths: 2,
            onReady: function(selectedDates, dateStr, instance) {
                // Create Custom Footer
                const footer = document.createElement("div");
                footer.className = "flatpickr-footer flex flex-col gap-2 p-3 border-t border-gray-200";
                
                // Shortcuts Row
                const shortcuts = document.createElement("div");
                shortcuts.className = "flex gap-2 justify-between";
                shortcuts.innerHTML = `
                    <button type="button" class="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded" data-action="today">今日</button>
                    <button type="button" class="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded" data-action="week">本周</button>
                    <button type="button" class="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded" data-action="month">本月</button>
                `;
                
                // Actions Row
                const actions = document.createElement("div");
                actions.className = "flex justify-end gap-2 mt-2";
                actions.innerHTML = `
                    <button type="button" class="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300" data-action="clear">清除</button>
                    <button type="button" class="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm" data-action="confirm">确定</button>
                `;

                footer.appendChild(shortcuts);
                footer.appendChild(actions);
                
                instance.calendarContainer.appendChild(footer);

                // Bind Events
                footer.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (!action) return;

                    const today = new Date();
                    switch (action) {
                        case 'today':
                            instance.setDate([today, today], true);
                            instance.close(); // Immediate apply
                            break;
                        case 'week':
                            const day = today.getDay() || 7; // Make Sunday 7
                            const first = today.getDate() - day + 1; // Monday
                            const last = first + 6; // Sunday
                            const monday = new Date(today);
                            monday.setDate(first);
                            const sunday = new Date(today);
                            sunday.setDate(last);
                            instance.setDate([monday, sunday], true);
                            instance.close(); // Immediate apply
                            break;
                        case 'month':
                            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                            instance.setDate([firstDay, lastDay], true);
                            instance.close(); // Immediate apply
                            break;
                        case 'clear':
                            instance.clear();
                            refreshWithDate([]);
                            break;
                        case 'confirm':
                            instance.close();
                            refreshWithDate(instance.selectedDates);
                            break;
                    }
                });
            },
            onClose: function(selectedDates) {
                if (selectedDates.length === 2 || selectedDates.length === 0) {
                    refreshWithDate(selectedDates);
                }
            }
        });
    }

    function refreshWithDate(dates) {
        state.dateRange = dates;
        console.log("Filtering by date:", dates);
        loadTopLevelData();
    }

    // Core: Init
    function init() {
        const container = document.getElementById('statistics-container');
        if (!container) return; 
        
        // Render Header (First time)
        renderHeader();

        // Initial Data
        if (state.data.length === 0) {
            loadTopLevelData();
        } else {
            renderTable();
        }

        // Init Date Picker
        setTimeout(initDatePicker, 0);
    }

    function loadTopLevelData() {
        showLoading(true);
        const rangeText = state.dateRange.length === 2 
            ? ` (${state.dateRange[0].toLocaleDateString()} - ${state.dateRange[1].toLocaleDateString()})` 
            : '';
        console.log(`Loading data${rangeText}`);

        setTimeout(() => {
            state.data = generateMockData(0);
            state.expandedNodes.clear();
            renderTable();
            showLoading(false);
        }, 400);
    }

    // Interaction: Toggle
    async function toggleNode(nodeId) {
        if (state.expandedNodes.has(nodeId)) {
            state.expandedNodes.delete(nodeId);
            renderTable();
        } else {
            const node = findNode(state.data, nodeId);
            if (node && node.hasChildren) {
                if (!node.childrenLoaded) {
                    node.children = generateMockData(node.depth + 1, node.id);
                    node.childrenLoaded = true;
                }
                state.expandedNodes.add(nodeId);
                renderTable();
                
                setTimeout(() => {
                    const row = document.querySelector(`tr[data-id="${nodeId}"]`);
                    if (row) {
                        const nextRow = row.nextElementSibling;
                        if (nextRow) {
                            nextRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                }, 50);
            }
        }
    }

    function findNode(nodes, id) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    // Interaction: Refresh
    function refresh() {
        loadTopLevelData();
    }

    // Interaction: Export
    function exportExcel() {
        const flatList = flattenData(state.data);
        const { deptName, dialogCount, like, dislike, noRating, satisfaction } = CONFIG.headers;
        
        const exportData = flatList.map(node => {
            let row = {};
            row[deptName] = '  '.repeat(node.depth) + node.name;
            row[dialogCount] = node.dialogCount;
            row[like] = node.likes;
            row[dislike] = node.dislikes;
            row[noRating] = node.noRating;
            row[satisfaction] = `${node.satisfaction}%`;
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "统计报表");

        const date = new Date();
        const timestamp = date.getFullYear() +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0') + '_' +
            String(date.getHours()).padStart(2, '0') +
            String(date.getMinutes()).padStart(2, '0') +
            String(date.getSeconds()).padStart(2, '0');

        XLSX.writeFile(wb, `统计_${timestamp}.xlsx`);
    }

    // UI: Loading Mask
    function showLoading(show) {
        const mask = document.getElementById('stats-loading-mask');
        if (mask) {
            mask.classList.toggle('hidden', !show);
        }
    }

    // Public API
    window.StatisticsModule = {
        init,
        toggleNode,
        refresh,
        exportExcel,
        // For testing/config
        setConfig: (newConfig) => {
            Object.assign(CONFIG, newConfig);
            renderHeader();
            renderTable();
        }
    };

    // Global Entry for Tab Switch
    window.renderStatistics = init;

})();
