(function() {
    // Ensure dependencies are loaded
    if (typeof marked === 'undefined') {
        console.error('DocAssistant: marked.js not loaded!');
        return;
    }

    const STORAGE_KEY_POS = 'vagent_doc_btn_pos';
    const STORAGE_KEY_VISIBLE = 'vagent_doc_btn_visible';
    const STORAGE_KEY_TAB = 'vagent_doc_tab'; // 'req' or 'dev'
    
    // State
    let currentDocPath = '';
    let currentDocType = localStorage.getItem(STORAGE_KEY_TAB) || 'req';
    let isEditing = false;
    let docContent = '';
    let isVisible = localStorage.getItem(STORAGE_KEY_VISIBLE) !== 'false'; // Default true

    // CSS Styles
    const style = document.createElement('style');
    style.textContent = `
        #doc-float-btn {
            position: fixed;
            top: 70%;
            right: 0;
            transform: translateY(-50%);
            width: 40px;
            height: 60px;
            background: #3b82f6;
            color: white;
            border-radius: 8px 0 0 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: -2px 2px 6px rgba(0, 0, 0, 0.1);
            cursor: move; /* Changed to move to indicate draggable */
            z-index: 9999;
            transition: width 0.2s, background-color 0.2s;
            user-select: none;
        }
        #doc-float-btn:hover {
            width: 48px;
            background: #2563eb;
        }
        #doc-float-btn i {
            font-size: 1.25rem;
        }
        
        /* Sidebar (replaces Modal) */
        #doc-sidebar {
            position: fixed;
            top: 0;
            right: -450px; /* Hidden by default */
            bottom: 0;
            width: 450px;
            background: white;
            box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
            z-index: 9998; /* Just below float btn if overlapped, but we want it beside */
            display: flex;
            flex-direction: column;
            border-left: 1px solid #e5e7eb;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #doc-sidebar.active {
            right: 0;
        }
        
        .doc-header {
            padding: 0;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f9fafb;
            flex-shrink: 0;
        }
        .doc-tabs {
            display: flex;
            margin-left: 16px;
        }
        .doc-tab {
            padding: 16px 20px;
            font-weight: 500;
            font-size: 0.9rem;
            color: #6b7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        .doc-tab:hover {
            color: #374151;
        }
        .doc-tab.active {
            color: #3b82f6;
            border-bottom-color: #3b82f6;
        }
        .doc-actions {
            display: flex;
            gap: 8px;
            padding-right: 16px;
        }
        .doc-btn {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: colors 0.2s;
        }
        .doc-btn-primary {
            background: #3b82f6;
            color: white;
            border: none;
        }
        .doc-btn-primary:hover {
            background: #2563eb;
        }
        .doc-btn-secondary {
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        .doc-btn-secondary:hover {
            background: #f3f4f6;
        }
        .doc-content-area {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        #doc-preview {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            prose-sm: true;
        }
        #doc-editor {
            flex: 1;
            padding: 20px;
            border: none;
            resize: none;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.875rem;
            background: #f9fafb;
            outline: none;
            display: none;
        }
        /* Markdown Styles (Tailwind Typography simplified) */
        .markdown-body h1 { font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em; margin-top: 0; }
        .markdown-body h2 { font-size: 1.25em; font-weight: bold; margin-bottom: 0.5em; margin-top: 1em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        .markdown-body h3 { font-size: 1.1em; font-weight: bold; margin-bottom: 0.5em; margin-top: 1em; }
        .markdown-body p { margin-bottom: 1em; line-height: 1.6; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 1em; padding-left: 2em; }
        .markdown-body ul { list-style-type: disc; }
        .markdown-body ol { list-style-type: decimal; }
        .markdown-body code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; font-family: monospace; }
        .markdown-body pre { background: #1f2937; color: #f9fafb; padding: 1em; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; }
        .markdown-body pre code { background: transparent; padding: 0; color: inherit; }
        .markdown-body blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; margin-bottom: 1em; }
        .markdown-body a { color: #3b82f6; text-decoration: none; }
        .markdown-body a:hover { text-decoration: underline; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
        .markdown-body th, .markdown-body td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        .markdown-body th { background: #f9fafb; font-weight: 600; }

        .hidden { display: none !important; }
        
        /* Loading Overlay */
        .doc-loading {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-radius: 50%;
            border-top: 3px solid #3b82f6;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    // HTML Structure
    const container = document.createElement('div');
    container.innerHTML = `
        <div id="doc-float-btn" title="查看文档">
            <i class="fa-solid fa-file-lines"></i>
        </div>
        
        <div id="doc-sidebar">
            <div class="doc-header">
                <div class="doc-tabs">
                    <div class="doc-tab" data-type="req">需求说明</div>
                    <div class="doc-tab" data-type="dev">开发说明</div>
                </div>
                <div class="doc-actions">
                    <button id="doc-edit-btn" class="doc-btn doc-btn-secondary">
                        <i class="fa-solid fa-pen mr-1"></i> 编辑
                    </button>
                    <button id="doc-save-btn" class="doc-btn doc-btn-primary hidden">
                        <i class="fa-solid fa-save mr-1"></i> 保存
                    </button>
                    <button id="doc-close-btn" class="doc-btn doc-btn-secondary" style="border:none; padding: 6px;">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
            </div>
            <div class="doc-content-area relative">
                <div id="doc-loading" class="doc-loading hidden">
                    <div class="spinner"></div>
                </div>
                <div id="doc-preview" class="markdown-body"></div>
                <textarea id="doc-editor" spellcheck="false"></textarea>
            </div>
            <div class="text-xs text-gray-400 p-2 border-t border-gray-100 bg-gray-50 flex justify-between">
                <span id="doc-path-display"></span>
                <span id="doc-last-modified"></span>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // Elements
    const floatBtn = document.getElementById('doc-float-btn');
    const sidebar = document.getElementById('doc-sidebar');
    const previewEl = document.getElementById('doc-preview');
    const editorEl = document.getElementById('doc-editor');
    const editBtn = document.getElementById('doc-edit-btn');
    const saveBtn = document.getElementById('doc-save-btn');
    const closeBtn = document.getElementById('doc-close-btn');
    const loadingEl = document.getElementById('doc-loading');
    const pathDisplay = document.getElementById('doc-path-display');
    const lastModDisplay = document.getElementById('doc-last-modified');
    const tabs = document.querySelectorAll('.doc-tab');

    // Init Button Position (Y-axis only logic if we wanted draggable, but now fixed right)
    const savedPos = localStorage.getItem(STORAGE_KEY_POS);
    if (savedPos) {
        const { top } = JSON.parse(savedPos);
        if (top) {
            floatBtn.style.top = top + 'px';
            floatBtn.style.transform = 'translateY(0)'; // Disable center transform if custom pos
        }
    }
    // Restore "Visible" state
    if (!isVisible) {
        floatBtn.classList.add('hidden');
    }

    // Init Tab
    updateTabUI();

    // Sidebar Logic
    function toggleSidebar() {
        const isActive = sidebar.classList.contains('active');
        if (isActive) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    async function openSidebar() {
        sidebar.classList.add('active');
        // Adjust float btn to point right or hide?
        // Let's move float btn or change icon
        floatBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        floatBtn.style.right = '450px'; // Move with sidebar
        loadDoc();
    }

    function closeSidebar() {
        if (isEditing) {
            if(!confirm('正在编辑中，确定要关闭吗？未保存的修改将丢失。')) return;
            toggleEditMode(false);
        }
        sidebar.classList.remove('active');
        floatBtn.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
        floatBtn.style.right = '0'; // Reset position
    }

    // Draggable Logic (Y-axis only)
    let isDragging = false;
    let dragStartY;
    let initialTop;

    floatBtn.addEventListener('mousedown', (e) => {
        isDragging = false;
        dragStartY = e.clientY;
        const rect = floatBtn.getBoundingClientRect();
        initialTop = rect.top;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const dy = e.clientY - dragStartY;
        
        if (Math.abs(dy) > 3) {
            isDragging = true;
            // Constrain to window height
            let newTop = initialTop + dy;
            if (newTop < 0) newTop = 0;
            if (newTop > window.innerHeight - 60) newTop = window.innerHeight - 60;
            
            floatBtn.style.top = newTop + 'px';
            floatBtn.style.transform = 'translateY(0)';
        }
    }

    function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        if (isDragging) {
            localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({
                top: parseInt(floatBtn.style.top)
            }));
        } else {
            toggleSidebar();
        }
    }

    // Tab Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const type = tab.dataset.type;
            if (type !== currentDocType) {
                if (isEditing && !confirm('切换标签将丢失未保存的修改，是否继续？')) {
                    return;
                }
                currentDocType = type;
                localStorage.setItem(STORAGE_KEY_TAB, type);
                updateTabUI();
                toggleEditMode(false); // Reset edit mode on tab switch
                loadDoc();
            }
        });
    });

    function updateTabUI() {
        tabs.forEach(tab => {
            if (tab.dataset.type === currentDocType) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    function toggleEditMode(edit) {
        isEditing = edit;
        if (edit) {
            editorEl.value = docContent;
            editorEl.style.display = 'block';
            previewEl.style.display = 'none';
            editBtn.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            editorEl.focus();
        } else {
            editorEl.style.display = 'none';
            previewEl.style.display = 'block';
            editBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
        }
    }

    async function loadDoc() {
        loadingEl.classList.remove('hidden');
        
        let hash = window.location.hash.slice(1).split('?')[0];
        if (!hash) hash = 'dashboard';
        hash = hash.replace(/^\//, '');
        
        let filePath = `views/${hash}`;
        currentDocPath = filePath;
        
        const suffix = currentDocType === 'dev' ? '.dev.md' : '.md';
        pathDisplay.textContent = `Doc: ${currentDocPath}${suffix}`;

        try {
            // Try to fetch static file directly first (supports static deployment)
            const staticUrl = `prototype_comments/${currentDocPath}${suffix}`;
            const res = await fetch(staticUrl);
            
            if (res.ok) {
                const text = await res.text();
                docContent = text;
                renderMarkdown(docContent);
                
                const lastMod = res.headers.get('Last-Modified');
                if (lastMod) {
                    lastModDisplay.textContent = `Last updated: ${new Date(lastMod).toLocaleString()}`;
                } else {
                    lastModDisplay.textContent = '';
                }
            } else {
                // Fallback to API or show empty
                if (res.status === 404) {
                     docContent = `# ${currentDocType === 'dev' ? 'Development Guide' : 'Requirement Documentation'}\n\n(No documentation found. If you are in static mode, this file does not exist yet.)`;
                     renderMarkdown(docContent);
                     lastModDisplay.textContent = 'Not found';
                } else {
                    throw new Error('Failed to load doc');
                }
            }

        } catch (err) {
            console.error(err);
            docContent = "# Error\nFailed to load documentation.";
            renderMarkdown(docContent);
        } finally {
            loadingEl.classList.add('hidden');
        }
    }

    async function saveDoc() {
        loadingEl.classList.remove('hidden');
        const newContent = editorEl.value;
        
        try {
            const res = await fetch('/api/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentDocPath,
                    type: currentDocType,
                    content: newContent
                })
            });
            
            if (res.status === 404 || res.status === 405) {
                throw new Error('后端服务未运行，纯静态模式下不支持保存。');
            }
            
            if (!res.ok) throw new Error('Failed to save');
            
            docContent = newContent;
            renderMarkdown(docContent);
            toggleEditMode(false);
            
            lastModDisplay.textContent = `Last updated: ${new Date().toLocaleString()}`;
            
        } catch (err) {
            alert('保存失败: ' + err.message);
        } finally {
            loadingEl.classList.add('hidden');
        }
    }

    function renderMarkdown(text) {
        previewEl.innerHTML = marked.parse(text);
    }

    // Events
    closeBtn.addEventListener('click', closeSidebar);
    editBtn.addEventListener('click', () => toggleEditMode(true));
    saveBtn.addEventListener('click', saveDoc);

    // Listen for view changes to reload doc if modal is open
    window.addEventListener('hashchange', () => {
        if (sidebar.classList.contains('active')) {
            loadDoc();
        }
    });

    window.toggleDocAssistant = function(show) {
        isVisible = show;
        localStorage.setItem(STORAGE_KEY_VISIBLE, show);
        if (show) floatBtn.classList.remove('hidden');
        else floatBtn.classList.add('hidden');
    };

    console.log('DocAssistant loaded. Use window.toggleDocAssistant(true/false) to control visibility.');
})();
