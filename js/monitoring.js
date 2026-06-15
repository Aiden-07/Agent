// Track chart instances globally to resize them
window.monitoringCharts = window.monitoringCharts || {};

document.addEventListener('DOMContentLoaded', () => {
    // 监听可能需要时间选择器的视图加载完成
    // （在实际应用中，你可能会在 loadView 的回调里初始化，或者使用 MutationObserver）
    // 为了简单起见，这里我们在 window 上挂载一个初始化函数，
    // 在 loadView 完成加载 monitoring.html 后调用它。
    window.initMonitoringDateRange = function() {
        const input = document.getElementById('monitoring-date-range');
        if (!input) return;

        // 如果已经初始化过，不再重复初始化
        if (input._flatpickr) return;

        if (typeof flatpickr !== 'undefined') {
            flatpickr(input, {
                mode: "range",
                dateFormat: "Y-m-d",
                defaultDate: ["2026-05-01", "2026-05-07"],
                locale: {
                    firstDayOfWeek: 1
                },
                onChange: function(selectedDates, dateStr, instance) {
                    if (selectedDates.length === 2) {
                        if (typeof refreshMonitoringData !== 'undefined') {
                            refreshMonitoringData();
                        }
                    }
                }
            });
        }
    };
});

window.switchMonitoringTab = function(tabId) {
    // Hide all tab contents
    document.getElementById('tab-content-build').classList.add('hidden');
    document.getElementById('tab-content-invoke').classList.add('hidden');
    document.getElementById('tab-content-insight').classList.add('hidden');

    // Show selected tab content
    document.getElementById(`tab-content-${tabId}`).classList.remove('hidden');

    // Reset all tab buttons
    const tabs = ['build', 'invoke', 'insight'];
    tabs.forEach(id => {
        const btn = document.getElementById(`tab-btn-${id}`);
        btn.className = 'pb-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors';
    });

    // Active selected tab button
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    activeBtn.className = 'pb-3 border-b-2 border-blue-600 text-blue-600';

    // Toggle search box visibility
    const searchBoxContainer = document.getElementById('monitoring-search-container');
    if (searchBoxContainer) {
        if (tabId === 'build') {
            searchBoxContainer.classList.add('hidden');
        } else {
            searchBoxContainer.classList.remove('hidden');
        }
    }
    
    // Initialize charts if not already done
    if (Object.keys(window.monitoringCharts).length === 0) {
        initAllMonitoringCharts();
    }
    
    // Resize charts after tab switch to ensure they render correctly in newly visible containers
    setTimeout(() => {
        Object.values(window.monitoringCharts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }, 50);
};

// Global function to trigger data refresh based on filters
window.refreshMonitoringData = function(event) {
    if (event) event.stopPropagation();
    
    // Simulate network delay for realistic interaction
    setTimeout(() => {
        // Re-init charts with new random data
        initAllMonitoringCharts();
        
        // Randomize the 4 overview metric numbers
        const metrics = document.querySelectorAll('.text-3xl.font-semibold.text-gray-900');
        if (metrics.length >= 4) {
            metrics[0].innerHTML = Math.floor(Math.random() * 50 + 10) + '<span class="text-sm font-normal text-gray-500 ml-1">个</span>'; // Apps
            metrics[1].innerHTML = Math.floor(Math.random() * 5000 + 1000).toLocaleString() + '<span class="text-sm font-normal text-gray-500 ml-1">次</span>'; // Invocations
            metrics[2].innerHTML = Math.floor(Math.random() * 1000 + 100).toLocaleString() + '<span class="text-sm font-normal text-gray-500 ml-1">个</span>'; // Users
            metrics[3].innerHTML = Math.floor(Math.random() * 500 + 50).toLocaleString() + '<span class="text-sm font-normal text-gray-500 ml-1">K</span>'; // Tokens
        }
        
        // Randomize percentages
        const percentages = document.querySelectorAll('.text-blue-500.font-medium');
        percentages.forEach(el => {
            const sign = Math.random() > 0.5 ? '+' : '-';
            const val = (Math.random() * 15).toFixed(1);
            el.innerText = `${sign}${val}%`;
            el.className = sign === '+' ? 'text-green-500 font-medium' : 'text-red-500 font-medium';
        });
        
    }, 300);
};

// Simple global click listener to close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const searchBox = document.getElementById('monitoring-search-box');
    const appDropdown = document.getElementById('monitoring-app-dropdown');
    if (searchBox && appDropdown && !searchBox.contains(e.target) && !appDropdown.contains(e.target)) {
        appDropdown.classList.add('hidden');
    }
    
    const periodDropdown = document.getElementById('monitoring-period-dropdown');
    if (periodDropdown && e.target.id !== 'monitoring-period-text' && !e.target.closest('#monitoring-period-dropdown')) {
        periodDropdown.classList.add('hidden');
    }
});

// ECharts Initialization Function
window.initAllMonitoringCharts = function() {
    if (typeof echarts === 'undefined') return;

    // Helper for random data generation
    const generateData = (count, min, max) => Array.from({length: count}, () => Math.floor(Math.random() * (max - min + 1) + min));
    
    // Get dates array based on currently selected period type for X axis
    const getDates = () => {
        const periodText = document.getElementById('monitoring-period-text');
        const isWeekly = periodText && periodText.innerText === '周';
        const isMonthly = periodText && periodText.innerText === '月';
        
        if (isMonthly) return ['1月', '2月', '3月', '4月', '5月', '6月', '7月'];
        if (isWeekly) return ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周'];
        return ['05-01', '05-02', '05-03', '05-04', '05-05', '05-06', '05-07'];
    };
    
    const xAxisDates = getDates();

    // Common Option Setup
    const commonLineOptions = {
        grid: { top: 10, right: 20, bottom: 20, left: 40 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: xAxisDates, axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } }
    };
    
    const commonBarOptions = {
        grid: { top: 10, right: 20, bottom: 20, left: 40 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
        yAxis: { type: 'category', data: ['应用A', '应用B', '应用C', '应用D', '应用E'], axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 10 } }
    };

    // 1. Build Tab: Total Apps
    const chartBuildTotalDom = document.getElementById('chart-build-total');
    if (chartBuildTotalDom) {
        const chart = echarts.getInstanceByDom(chartBuildTotalDom) || echarts.init(chartBuildTotalDom);
        window.monitoringCharts['buildTotal'] = chart;
        chart.setOption({
            ...commonLineOptions,
            series: [
                { name: '创建应用数', type: 'line', data: generateData(7, 5, 20), smooth: true, itemStyle: { color: '#3b82f6' } },
                { name: '发布应用数', type: 'line', data: generateData(7, 2, 15), smooth: true, itemStyle: { color: '#2dd4bf' } }
            ]
        });
    }

    // 2. Build Tab: Active (Line/Area)
    const chartBuildActiveDom = document.getElementById('chart-build-active');
    if (chartBuildActiveDom) {
        const chart = echarts.getInstanceByDom(chartBuildActiveDom) || echarts.init(chartBuildActiveDom);
        window.monitoringCharts['buildActive'] = chart;
        chart.setOption({
            ...commonLineOptions,
            series: [
                { name: '累计活跃应用数', type: 'line', data: generateData(7, 30, 80), smooth: true, itemStyle: { color: '#3b82f6' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgba(59, 130, 246, 0.2)'}, {offset: 1, color: 'rgba(59, 130, 246, 0)'}]) } },
                { name: '累计活跃≥7日应用数', type: 'line', data: generateData(7, 10, 40), smooth: true, itemStyle: { color: '#2dd4bf' } },
                { name: '累计活跃≥30日应用数', type: 'line', data: generateData(7, 2, 15), smooth: true, itemStyle: { color: '#a855f7' } }
            ]
        });
    }
    
    // 3. Build Tab: Token Usage (Line)
    const chartBuildTokenDom = document.getElementById('chart-build-token');
    if (chartBuildTokenDom) {
        const chart = echarts.getInstanceByDom(chartBuildTokenDom) || echarts.init(chartBuildTokenDom);
        window.monitoringCharts['buildToken'] = chart;
        chart.setOption({
            ...commonLineOptions,
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value} K' } },
            series: [
                { name: 'Token用量', type: 'line', data: generateData(7, 100, 1000), smooth: true, itemStyle: { color: '#f97316' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgba(249, 115, 22, 0.2)'}, {offset: 1, color: 'rgba(249, 115, 22, 0)'}]) } }
            ]
        });
    }

    // 4. Invoke Tab: Volume
    const chartInvokeVolumeDom = document.getElementById('chart-invoke-volume');
    if (chartInvokeVolumeDom) {
        const chart = echarts.getInstanceByDom(chartInvokeVolumeDom) || echarts.init(chartInvokeVolumeDom);
        window.monitoringCharts['invokeVolume'] = chart;
        chart.setOption({
            ...commonLineOptions,
            series: [
                { name: '调用量', type: 'line', areaStyle: { opacity: 0.1, color: '#3b82f6' }, data: generateData(7, 100, 1000), smooth: true, itemStyle: { color: '#3b82f6' } }
            ]
        });
    }

    // 4. Invoke Tab: Channels (Pie/Donut)
    const chartInvokeChannelsDom = document.getElementById('chart-invoke-channels');
    if (chartInvokeChannelsDom) {
        const chart = echarts.getInstanceByDom(chartInvokeChannelsDom) || echarts.init(chartInvokeChannelsDom);
        window.monitoringCharts['invokeChannels'] = chart;
        chart.setOption({
            tooltip: { trigger: 'item' },
            legend: { top: 'bottom', icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 10, color: '#6b7280' } },
            series: [
                {
                    name: '渠道', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
                    itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
                    label: { show: false },
                    data: [
                        { value: Math.floor(Math.random()*500+200), name: 'Web端', itemStyle: { color: '#3b82f6' } },
                        { value: Math.floor(Math.random()*300+100), name: 'API接口', itemStyle: { color: '#2dd4bf' } },
                        { value: Math.floor(Math.random()*200+50), name: '小程序', itemStyle: { color: '#a855f7' } },
                        { value: Math.floor(Math.random()*100+20), name: '其他', itemStyle: { color: '#f59e0b' } }
                    ]
                }
            ]
        });
    }

    // 5. Invoke Tab: Ranking (Horizontal Bar)
    const chartInvokeRankingDom = document.getElementById('chart-invoke-ranking');
    if (chartInvokeRankingDom) {
        const chart = echarts.getInstanceByDom(chartInvokeRankingDom) || echarts.init(chartInvokeRankingDom);
        window.monitoringCharts['invokeRanking'] = chart;
        let data = generateData(5, 100, 1000).sort((a,b) => a-b);
        chart.setOption({
            ...commonBarOptions,
            series: [{ name: '调用量', type: 'bar', data: data, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] }, barWidth: 16 }]
        });
    }

    // 6. Invoke Tab: Hot Apps -> App Token Ranking (Horizontal Bar)
    const chartInvokeHotDom = document.getElementById('chart-invoke-hot');
    if (chartInvokeHotDom) {
        const chart = echarts.getInstanceByDom(chartInvokeHotDom) || echarts.init(chartInvokeHotDom);
        window.monitoringCharts['invokeHot'] = chart;
        let data = generateData(5, 50, 500).sort((a,b) => a-b);
        chart.setOption({
            ...commonBarOptions,
            yAxis: { type: 'category', data: ['应用E', '应用D', '应用C', '应用B', '应用A'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#6b7280', fontSize: 10, margin: 8 } },
            series: [{ name: 'Token用量 (K)', type: 'bar', data: data, itemStyle: { color: '#f59e0b', borderRadius: [0, 4, 4, 0] }, barWidth: 16 }]
        });
    }

    // 7. Insight Tab: Users
    const chartInsightUsersDom = document.getElementById('chart-insight-users');
    if (chartInsightUsersDom) {
        const chart = echarts.getInstanceByDom(chartInsightUsersDom) || echarts.init(chartInsightUsersDom);
        window.monitoringCharts['insightUsers'] = chart;
        chart.setOption({
            ...commonLineOptions,
            series: [
                { name: '累计用户数', type: 'line', data: [100, 150, 220, 310, 400, 450, 580].map(v => v + Math.floor(Math.random()*50)), smooth: true, itemStyle: { color: '#3b82f6' } },
                { name: '活跃用户数', type: 'line', data: generateData(7, 20, 150), smooth: true, itemStyle: { color: '#2dd4bf' } }
            ]
        });
    }

    // 8. Insight Tab: Feedback
    const chartInsightFeedbackDom = document.getElementById('chart-insight-feedback');
    if (chartInsightFeedbackDom) {
        const chart = echarts.getInstanceByDom(chartInsightFeedbackDom) || echarts.init(chartInsightFeedbackDom);
        window.monitoringCharts['insightFeedback'] = chart;
        chart.setOption({
            ...commonLineOptions,
            yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value}%' } },
            series: [
                { name: '点赞率', type: 'line', data: generateData(7, 70, 98), smooth: true, itemStyle: { color: '#3b82f6' } },
                { name: '点踩率', type: 'line', data: generateData(7, 2, 15), smooth: true, itemStyle: { color: '#2dd4bf' } }
            ]
        });
    }

    // 10. Insight Tab: User Token Ranking (Horizontal Bar)
    const chartInsightTokenRankDom = document.getElementById('chart-insight-token-rank');
    if (chartInsightTokenRankDom) {
        const chart = echarts.getInstanceByDom(chartInsightTokenRankDom) || echarts.init(chartInsightTokenRankDom);
        window.monitoringCharts['insightTokenRank'] = chart;
        let data = generateData(5, 100, 2000).sort((a,b) => a-b);
        chart.setOption({
            ...commonBarOptions,
            grid: { top: 10, right: 30, bottom: 20, left: 60, containLabel: false },
            yAxis: { type: 'category', data: ['应用E', '应用D', '应用C', '应用B', '应用A'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#6b7280', fontSize: 10, margin: 8 } },
            series: [{ name: 'Token用量 (K)', type: 'bar', data: data, itemStyle: { color: '#f97316', borderRadius: [0, 4, 4, 0] }, barWidth: 16 }]
        });
    }
};

// Add listener for window resize to adjust charts
window.addEventListener('resize', () => {
    Object.values(window.monitoringCharts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
});