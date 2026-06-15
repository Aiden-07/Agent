
// Version Management System
// Handles demo versioning, snapshotting, and switching

window.VersionManager = {
    storageKey: 'demo_versions',
    currentVersionKey: 'demo_current_version_id',
    isSwitching: false,
    isConfirmOpen: false,
    pendingVersionId: null,
    
    // Configurable Nav Items to Track
    navItems: [
        { id: 'nav-agent', label: '智能体应用' },
        { id: 'nav-orchestrator', label: '工作流应用' },
        { id: 'nav-knowledge', label: '知识库' },
        { id: 'nav-knowledge-graph', label: '知识图谱' },
        { id: 'nav-components', label: '组件' },
        { id: 'nav-evaluation', label: '效果测评' },
        { id: 'nav-settings', label: '系统设置' },
        { id: 'nav-user-mgmt', label: '用户管理' },
        { id: 'nav-role-mgmt', label: '角色管理' }
    ],

    init: function() {
        // Force clear for dev update to ensure new seed data is loaded
        // In production, this would be handled by version migration
        const existingData = localStorage.getItem(this.storageKey);
        if (existingData) {
            const parsed = JSON.parse(existingData);
            // Simple check if we need to migrate/reset (e.g. if v2.0.0 exists which we are removing)
            if (parsed.some(v => v.version === '2.0.0' || v.version === '1.2.0')) {
                localStorage.removeItem(this.storageKey);
                this.versions = [];
            }
        }

        this.renderFloatingButton();
        this.renderDrawer();
        this.renderModal();
        this.loadData();

        const removedVersionIds = new Set([
            'v-1773808938586',
            'v-1773806813333',
            'v-1773806599412',
            'v-1773806172479'
        ]);
        const oldLength = this.versions.length;
        this.versions = this.versions.filter(v => !removedVersionIds.has(v.id));
        if (this.versions.length !== oldLength) {
            this.saveData();
        }
        
        // Check if we need to seed data
        if (!this.versions || this.versions.length === 0) {
            this.seedData();
        }

        // Apply current version state on load ONLY if we are explicitly viewing a historical version.
        // If the user is just editing/refreshing the current working state, we should NOT force a restore,
        // otherwise it overwrites their local code edits.
        // We use a flag 'demo_is_viewing_history' to track this.
        const isViewingHistory = localStorage.getItem('demo_is_viewing_history') === 'true';
        const currentId = localStorage.getItem(this.currentVersionKey);
        
        if (isViewingHistory && currentId) {
            this.switchVersion(currentId, false); // false = no confirm needed on init
        } else {
             // We are in "Current Editing State". Do not apply any historical snapshot.
             // Just render the list UI to reflect current state.
             this.updateVersionListUI();
             this.showDraftModeBanner();
        }
    },

    loadData: function() {
        try {
            const data = localStorage.getItem(this.storageKey);
            this.versions = data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load version data', e);
            this.versions = [];
        }
    },

    saveData: function() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.versions));
    },

    seedData: function() {
        // Scenario v1.0.0 (was v1.2.0): + Knowledge Base
        const v1_0 = {
            id: 'v1.0-seed',
            version: '1.0.0',
            remarks: '增强版本：新增知识库功能模块',
            timestamp: Date.now() - 100000,
            features: ['nav-agent', 'nav-orchestrator', 'nav-knowledge', 'nav-settings', 'nav-user-mgmt', 'nav-role-mgmt'],
            globalData: null,
            viewHtml: null,
            route: null
        };

        // Scenario v1.1.0 (was v2.0.0): Full Features
        const v1_1 = {
            id: 'v1.1-seed',
            version: '1.1.0',
            remarks: '知识库切片策略设计',
            timestamp: Date.now(),
            features: this.navItems.map(item => item.id), // All items
            globalData: null,
            viewHtml: null,
            route: null
        };

        this.versions = [v1_1, v1_0]; // Reverse chronological
        this.saveData();
        console.log('Seeded demo versions');
    },

    // --- UI Rendering ---

    renderFloatingButton: function() {
        const btn = document.createElement('button');
        btn.id = 'version-mgmt-floating-btn';
        btn.className = 'fixed right-6 bottom-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50 group trae-browser-inspect-draggable cursor-move';
        btn.title = "版本管理";
        btn.innerHTML = `
            <i class="fa-solid fa-code-branch text-xl pointer-events-none"></i>
            <span class="absolute right-full mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">版本管理</span>
        `;
        document.body.appendChild(btn);

        // --- Drag and Drop Logic ---
        let isDragging = false;
        let moved = false;
        let startX = 0, startY = 0;

        const onDragStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return; // Only left click
            isDragging = true;
            moved = false;

            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

            startX = clientX;
            startY = clientY;

            // Convert right/bottom positioning to left/top for easier dragging
            const rect = btn.getBoundingClientRect();
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
            btn.style.left = rect.left + 'px';
            btn.style.top = rect.top + 'px';

            // Remove hover transition temporarily
            btn.classList.remove('transition-transform', 'hover:scale-110');

            if (e.type === 'mousedown') {
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);
            } else {
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('touchend', onDragEnd);
            }
        };

        const onDragMove = (e) => {
            if (!isDragging) return;

            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                moved = true;
            }

            if (moved) {
                if (e.type === 'touchmove') e.preventDefault(); // Prevent scrolling
                const rect = btn.getBoundingClientRect();
                let newLeft = rect.left + dx;
                let newTop = rect.top + dy;

                // Restrict within window bounds
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                newLeft = Math.max(0, Math.min(newLeft, maxX));
                newTop = Math.max(0, Math.min(newTop, maxY));

                btn.style.left = newLeft + 'px';
                btn.style.top = newTop + 'px';

                startX = clientX;
                startY = clientY;
            }
        };

        const onDragEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;

            // Restore hover transition
            btn.classList.add('transition-transform', 'hover:scale-110');

            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('touchend', onDragEnd);

            if (!moved) {
                // If it was just a click without moving, open drawer
                this.toggleDrawer(true);
            }
        };

        btn.addEventListener('mousedown', onDragStart);
        btn.addEventListener('touchstart', onDragStart, { passive: false });
    },

    renderDrawer: function() {
        const drawer = document.createElement('div');
        drawer.id = 'version-drawer';
        drawer.className = 'fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out z-[60] flex flex-col';
        drawer.innerHTML = `
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 class="text-lg font-bold text-gray-900">版本管理</h2>
                    <p class="text-xs text-gray-500 mt-1">管理与切换演示环境版本</p>
                </div>
                <button onclick="VersionManager.toggleDrawer(false)" class="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                <button onclick="VersionManager.openAddModal()" class="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all mb-6 flex flex-col items-center justify-center gap-1 font-medium">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>保存快照</span>
                    </div>
                    <span class="text-xs text-indigo-400 font-normal">当前为最新编辑草稿状态（未保存）</span>
                </button>
                
                <div class="flex items-center justify-between mb-4">
                     <h3 class="text-sm font-bold text-gray-700">历史版本</h3>
                     <span class="text-xs text-gray-400" id="version-count">0 个版本</span>
                </div>
                
                <button onclick="VersionManager.exitHistoryMode()" id="exit-history-btn" class="hidden w-full py-2 mb-4 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                    <i class="fa-solid fa-person-walking-arrow-right"></i> 退出历史预览，返回最新草稿
                </button>

                <div id="version-list" class="space-y-4">
                    <!-- List Items -->
                </div>
            </div>

            <div class="p-4 border-t border-gray-100 bg-white text-xs text-gray-400 text-center">
                Demo Version Control System v1.0
            </div>
        `;
        
        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'version-drawer-overlay';
        overlay.className = 'fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] hidden opacity-0 transition-opacity duration-300';
        overlay.onclick = () => this.toggleDrawer(false);

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);
    },

    renderModal: function() {
        const modal = document.createElement('div');
        modal.id = 'version-modal';
        modal.className = 'fixed inset-0 z-[70] hidden flex items-center justify-center';
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onclick="VersionManager.closeModal()"></div>
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative z-10 transform transition-all scale-100 animate-fade-in-up">
                <h3 class="text-xl font-bold text-gray-900 mb-1" id="modal-title">新增版本快照</h3>
                <p class="text-sm text-gray-500 mb-6" id="modal-subtitle">保存当前所有功能状态为新版本</p>
                
                <input type="hidden" id="edit-version-id">
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">版本号 <span class="text-red-500">*</span></label>
                        <input type="text" id="version-no-input" placeholder="e.g. 1.3.0" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">备注信息 <span class="text-red-500">*</span></label>
                        <textarea id="version-remark-input" rows="3" placeholder="描述该版本的主要变更..." class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"></textarea>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-8">
                    <button onclick="VersionManager.closeModal()" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                    <button onclick="VersionManager.confirmSave()" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-save"></i> 保存
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // --- Actions ---

    toggleDrawer: function(show) {
        const drawer = document.getElementById('version-drawer');
        const overlay = document.getElementById('version-drawer-overlay');
        
        if (show) {
            this.updateVersionListUI();
            drawer.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            // Small delay to allow display:block to apply before opacity transition
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        } else {
            drawer.classList.add('translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },

    openAddModal: function() {
        document.getElementById('version-modal').classList.remove('hidden');
        document.getElementById('modal-title').textContent = '新增版本快照';
        document.getElementById('modal-subtitle').textContent = '保存当前所有功能状态为新版本';
        document.getElementById('edit-version-id').value = ''; // Empty for add
        document.getElementById('version-no-input').value = '';
        document.getElementById('version-remark-input').value = '';
    },

    openEditModal: function(id, version, remarks, event) {
        if (event) event.stopPropagation();
        document.getElementById('version-modal').classList.remove('hidden');
        document.getElementById('modal-title').textContent = '编辑版本信息';
        document.getElementById('modal-subtitle').textContent = '修改版本的显示信息';
        document.getElementById('edit-version-id').value = id;
        document.getElementById('version-no-input').value = version;
        document.getElementById('version-remark-input').value = remarks;
    },

    closeModal: function() {
        document.getElementById('version-modal').classList.add('hidden');
    },

    confirmSave: function() {
        const id = document.getElementById('edit-version-id').value;
        if (id) {
            this.confirmUpdateVersion(id);
        } else {
            this.confirmAddVersion();
        }
    },

    confirmUpdateVersion: function(id) {
        const versionNo = document.getElementById('version-no-input').value.trim();
        const remarks = document.getElementById('version-remark-input').value.trim();

        if (!versionNo || !remarks) {
            alert('请填写完整信息');
            return;
        }

        const versionIndex = this.versions.findIndex(v => v.id === id);
        if (versionIndex !== -1) {
            this.versions[versionIndex].version = versionNo;
            this.versions[versionIndex].remarks = remarks;
            this.saveData();
            this.closeModal();
            this.updateVersionListUI();
            this.showToast('版本信息更新成功', 'success');
        }
    },

    confirmAddVersion: function() {
        const versionNo = document.getElementById('version-no-input').value.trim();
        const remarks = document.getElementById('version-remark-input').value.trim();

        if (!versionNo || !remarks) {
            alert('请填写完整信息');
            return;
        }

        // Capture State
        const currentFeatures = this.captureState();

        const newVersion = {
            id: 'v-' + Date.now(),
            version: versionNo,
            remarks: remarks,
            timestamp: Date.now(),
            features: currentFeatures.features,
            globalData: currentFeatures.globalData,
            viewHtml: currentFeatures.viewHtml,
            route: currentFeatures.route
        };

        this.versions.unshift(newVersion); // Add to top
        this.saveData();
        this.closeModal();
        this.updateVersionListUI();
        this.switchVersion(newVersion.id, false); // Switch to new version immediately
        
        // Show Toast
        this.showToast('版本保存成功', 'success');
    },

    captureState: function() {
        const activeFeatures = [];
        this.navItems.forEach(item => {
            const el = document.getElementById(item.id);
            if (el && !el.classList.contains('hidden')) {
                activeFeatures.push(item.id);
            }
        });

        // Deep copy of global mock data to ensure snapshot isolation
        const globalData = {
            mockDocs: window.mockDocs ? JSON.parse(JSON.stringify(window.mockDocs)) : null,
            knowledgeData: window.knowledgeData ? JSON.parse(JSON.stringify(window.knowledgeData)) : null
        };

        // Capture current active view's HTML to preserve uncommitted DOM edits
        const currentViewHtml = document.getElementById('main-content-area') ? document.getElementById('main-content-area').innerHTML : null;
        const currentHash = window.location.hash;

        return {
            features: activeFeatures,
            globalData: globalData,
            viewHtml: currentViewHtml,
            route: currentHash
        };
    },

    updateVersionListUI: function() {
        const container = document.getElementById('version-list');
        const countEl = document.getElementById('version-count');
        const currentId = localStorage.getItem(this.currentVersionKey);
        const isViewingHistory = localStorage.getItem('demo_is_viewing_history') === 'true';
        
        container.innerHTML = '';
        countEl.textContent = `${this.versions.length} 个版本`;

        const exitBtn = document.getElementById('exit-history-btn');
        if (exitBtn) {
            if (isViewingHistory) {
                exitBtn.classList.remove('hidden');
            } else {
                exitBtn.classList.add('hidden');
            }
        }

        this.versions.forEach(ver => {
            const isCurrent = isViewingHistory && ver.id === currentId;
            const dateStr = new Date(ver.timestamp).toLocaleString();
            
            const card = document.createElement('div');
            card.className = `p-4 rounded-xl border transition-all cursor-pointer relative group ${isCurrent ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'}`;
            card.onclick = () => {
                if (this.isSwitching || this.isConfirmOpen) return;
                this.switchVersion(ver.id);
            };

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-900 ${isCurrent ? 'text-indigo-700' : ''}">v${ver.version}</span>
                        ${isCurrent ? '<span class="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full font-medium">当前</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400">${dateStr}</span>
                        <button onclick="VersionManager.openEditModal('${ver.id}', '${ver.version}', '${ver.remarks}', event)" class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100" title="编辑版本信息">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                    </div>
                </div>
                <p class="text-sm text-gray-600 mb-3 line-clamp-2">${ver.remarks}</p>
                <div class="flex gap-2 flex-wrap">
                    ${ver.features.length > 0 ? `<span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">含 ${ver.features.length} 个模块</span>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    },

    renderConfirmationModal: function() {
        const modal = document.createElement('div');
        modal.id = 'version-confirm-modal';
        modal.className = 'fixed inset-0 z-[80] hidden flex items-center justify-center';
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative z-10 transform transition-all scale-100 animate-fade-in-up">
                <div class="mb-4">
                    <div class="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-4 mx-auto">
                        <i class="fa-solid fa-triangle-exclamation text-xl"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 text-center mb-2">确认切换版本？</h3>
                    <p class="text-sm text-gray-500 text-center" id="version-confirm-message">
                        当前最新编辑草稿未保存快照，切换后当前未保存的修改将会丢失。
                    </p>
                </div>
                <div class="flex gap-3">
                    <button id="version-confirm-cancel" class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        取消
                    </button>
                    <button id="version-confirm-ok" class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg shadow-sm transition-colors">
                        确认覆盖
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    showConfirmation: function(message) {
        let modal = document.getElementById('version-confirm-modal');
        if (!modal || !modal.innerHTML.trim()) {
            if (modal) modal.remove();
            this.renderConfirmationModal();
            modal = document.getElementById('version-confirm-modal');
        }

        document.getElementById('version-confirm-message').innerText = message;
        modal.classList.remove('hidden');

        const cancelBtn = document.getElementById('version-confirm-cancel');
        const okBtn = document.getElementById('version-confirm-ok');
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newOkBtn = okBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        this.isConfirmOpen = true;
        const armedAt = Date.now() + 220;
        const finishCancel = () => {
            modal.classList.add('hidden');
            this.isConfirmOpen = false;
            this.pendingVersionId = null;
        };

        newCancelBtn.onclick = (e) => {
            if (Date.now() < armedAt) return;
            e.stopPropagation();
            finishCancel();
        };

        newOkBtn.onclick = (e) => {
            if (Date.now() < armedAt) return;
            e.stopPropagation();
            modal.classList.add('hidden');
            this.isConfirmOpen = false;
            const versionId = this.pendingVersionId;
            this.pendingVersionId = null;
            if (versionId) {
                this.switchVersion(versionId, false);
            }
        };

        const overlay = modal.querySelector('.fixed.inset-0.bg-black\\/50');
        if (overlay) {
            overlay.onclick = (e) => {
                if (Date.now() < armedAt) return;
                e.stopPropagation();
                finishCancel();
            };
        }
    },

    switchVersion: function(versionId, confirm = true) {
        const targetVersion = this.versions.find(v => v.id === versionId);
        if (!targetVersion) return;
        if (this.isSwitching) return;

        const performSwitch = () => {
            if (this.isSwitching) return;
            this.isSwitching = true;
            // Loading State
            const loading = document.createElement('div');
            loading.className = 'fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center flex-col animate-fade-in';
            loading.innerHTML = `
                <i class="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-600 mb-4"></i>
                <p class="text-gray-600 font-medium">正在切换至 v${targetVersion.version}...</p>
            `;
            document.body.appendChild(loading);

            setTimeout(() => {
                // Apply State
                this.applyState(targetVersion);
                
                // Save Current ID and set viewing history flag
                localStorage.setItem(this.currentVersionKey, versionId);
                localStorage.setItem('demo_is_viewing_history', 'true');
                
                // Update UI
                this.updateVersionListUI();
                this.hideDraftModeBanner();
                
                // Remove Loading
                loading.classList.add('opacity-0');
                setTimeout(() => loading.remove(), 300);

                // Close Drawer
                this.toggleDrawer(false);

                // Toast
                this.showToast(`已切换至版本 v${targetVersion.version}`, 'success');
                
                // Force navigate to a safe page (Agent) if current view is hidden
                // Simple check: always go to agent on switch to be safe
                if (window.switchView) {
                    window.switchView('agent');
                }
                this.isSwitching = false;

            }, 800); // Fake delay for UX
        };

        // Check if we are currently in Draft Mode (not viewing history)
        const isViewingHistory = localStorage.getItem('demo_is_viewing_history') === 'true';
        
        if (confirm) {
            if (this.isConfirmOpen) return;
            let message = `确定要切换到版本 v${targetVersion.version} 吗？\n页面将会重新加载功能模块。`;
            
            // If in Draft Mode, warn about unsaved changes
            if (!isViewingHistory) {
                message = "当前最新编辑草稿未保存快照，切换后当前未保存的修改将会丢失。\n是否继续覆盖？";
            } else {
                message = `确定要切换到版本 v${targetVersion.version} 吗？`;
            }
            this.pendingVersionId = versionId;
            this.showConfirmation(message);
            return;
        } else {
            performSwitch();
        }
    },

    applyState: function(snapshotData) {
        // Handle legacy data structure vs new robust snapshot structure
        const featureIds = Array.isArray(snapshotData) ? snapshotData : (snapshotData.features || []);

        // 1. Restore Navigation State
        this.navItems.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                el.classList.add('hidden');
            }
        });

        featureIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('hidden');
            }
        });

        // 2. Restore Global Data (Deep Copy to memory)
        if (snapshotData.globalData) {
            if (snapshotData.globalData.mockDocs) {
                window.mockDocs = JSON.parse(JSON.stringify(snapshotData.globalData.mockDocs));
            }
            if (snapshotData.globalData.knowledgeData) {
                window.knowledgeData = JSON.parse(JSON.stringify(snapshotData.globalData.knowledgeData));
            }
        }

        // 3. Restore Exact DOM State if available, otherwise fallback to routing
        if (snapshotData.viewHtml && snapshotData.route) {
            // Because the user is testing the application by modifying JS logic or UI logic *after* creating a snapshot,
            // we must ensure that switching to an older version doesn't just re-run the *current* JS logic 
            // over the old HTML. But since we cannot sandbox the JS execution environment in a simple SPA, 
            // the safest way to guarantee complete state reset is to fully reload the application from the server,
            // passing the target version ID in the URL or localStorage so it initializes correctly.
            // 
            // However, to keep it as an SPA, we force a complete view reload via router instead of just injecting HTML,
            // because injecting HTML doesn't reset JS memory state (like event listeners attached to body/document,
            // or JS closures holding old references).
            
            const currentHash = window.location.hash;
            
            // Force reload current view from disk to ensure clean DOM and fresh JS initialization
            if (window.loadView) {
                 const targetRoute = snapshotData.route || currentHash;
                 if(targetRoute) {
                     const parts = targetRoute.slice(1).split('?');
                     const viewName = parts[0].replace(/^\//, '');
                     const params = {};
                     if (parts[1]) {
                        const searchParams = new URLSearchParams(parts[1]);
                        for (const [key, value] of searchParams.entries()) {
                            params[key] = value;
                        }
                    }
                    setTimeout(() => {
                        window.loadView(viewName, params);
                    }, 50);
                 }
            }
        } else {
            // Fallback for legacy snapshots: force reload from disk
            const currentHash = window.location.hash;
            if (currentHash && window.loadView) {
                 const parts = currentHash.slice(1).split('?');
                 const viewName = parts[0].replace(/^\//, '');
                 const params = {};
                 if (parts[1]) {
                    const searchParams = new URLSearchParams(parts[1]);
                    for (const [key, value] of searchParams.entries()) {
                        params[key] = value;
                    }
                }
                setTimeout(() => {
                    window.loadView(viewName, params);
                }, 50);
            }
        }
    },

    showToast: function(msg, type = 'info') {
        const toast = document.createElement('div');
        const colors = type === 'success' ? 'bg-green-500' : 'bg-blue-500';
        toast.className = `fixed top-6 left-1/2 transform -translate-x-1/2 ${colors} text-white px-6 py-3 rounded-xl shadow-lg z-[100] flex items-center gap-3 animate-fade-in-down`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> <span>${msg}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showDraftModeBanner: function() {
        if (document.getElementById('draft-mode-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'draft-mode-banner';
        banner.className = 'fixed top-0 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 border border-yellow-200 px-4 py-1.5 rounded-b-lg shadow-sm z-[90] flex items-center gap-3 text-xs font-medium';
        banner.innerHTML = `
            <i class="fa-solid fa-pen-ruler"></i>
            <span>当前为最新编辑草稿状态（未保存为版本快照）</span>
            <button onclick="VersionManager.openAddModal()" class="ml-2 text-blue-600 hover:text-blue-800 underline">保存快照</button>
        `;
        document.body.appendChild(banner);
    },

    hideDraftModeBanner: function() {
        const banner = document.getElementById('draft-mode-banner');
        if (banner) banner.remove();
    },

    exitHistoryMode: function() {
        localStorage.removeItem('demo_is_viewing_history');
        localStorage.removeItem(this.currentVersionKey);
        
        // Reload to let native code take over (clears history snapshot overlay)
        window.location.reload();
    }
};

// Auto Init
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure DOM is fully ready
    setTimeout(() => {
        VersionManager.init();
    }, 100);
});
