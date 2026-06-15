;(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory()
    } else {
        Object.assign(root, factory())
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const STORAGE_KEY = 'batch_slice_settings_page_open'
    let advancedExpanded = false
    let bodyOverflowXBefore = ''

    function getEl(id) {
        return document.getElementById(id)
    }

    function setAdvancedExpanded(expanded) {
        const root = getEl('batch-advanced-config')
        if (!root) return
        const content = root.querySelector('#batch-advanced-config-content')
        const btn = root.querySelector('#batch-advanced-config-toggle')
        const arrow = root.querySelector('#batch-advanced-config-arrow')
        if (!content || !btn || !arrow) return

        advancedExpanded = !!expanded
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false')
        arrow.classList.toggle('rotate-90', expanded)

        if (expanded) {
            try {
                if (typeof document !== 'undefined' && document.body) {
                    bodyOverflowXBefore = document.body.style.overflowX || ''
                    document.body.style.overflowX = 'hidden'
                }
            } catch (_) {
            }

            content.style.maxHeight = (content.scrollHeight || (content.children ? content.children.length * 56 : 240)) + 'px'
            content.style.opacity = '1'
        } else {
            try {
                if (typeof document !== 'undefined' && document.body) {
                    document.body.style.overflowX = bodyOverflowXBefore
                }
            } catch (_) {
            }

            if (content.style.maxHeight === 'none' || !content.style.maxHeight) {
                content.style.maxHeight = (content.scrollHeight || (content.children ? content.children.length * 56 : 240)) + 'px'
                requestAnimationFrame(function () {
                    content.style.maxHeight = '0px'
                    content.style.opacity = '0'
                })
            } else {
                content.style.maxHeight = '0px'
                content.style.opacity = '0'
            }
        }
    }

    function ensureAdvancedConfigModule() {
        const contentRoot = getEl('batch-slice-settings-page-content')
        const settingsColumn = contentRoot ? contentRoot.querySelector('#create-kb-settings-column') : null
        const mount = settingsColumn || getEl('batch-advanced-config-host')
        if (!mount) return
        if (mount.querySelector('#batch-advanced-config')) return

        const wrapper = document.createElement('div')
        wrapper.id = 'batch-advanced-config'
        wrapper.className = 'bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-3 relative z-0'

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.id = 'batch-advanced-config-toggle'
        btn.className = 'w-full flex items-center justify-between text-left select-none group cursor-pointer'
        btn.setAttribute('aria-expanded', 'false')
        btn.setAttribute('aria-controls', 'batch-advanced-config-content')

        const left = document.createElement('div')
        left.className = 'flex items-center gap-2'

        const arrow = document.createElement('i')
        arrow.id = 'batch-advanced-config-arrow'
        arrow.className = 'fa-solid fa-chevron-right'
        arrow.className = 'fa-solid fa-chevron-right text-[10px] text-gray-400 transition-transform duration-200 ease-out'

        const title = document.createElement('span')
        title.textContent = '高级配置'
        title.className = 'text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors'

        left.appendChild(arrow)
        left.appendChild(title)
        btn.appendChild(left)

        const content = document.createElement('div')
        content.id = 'batch-advanced-config-content'
        content.className = 'space-y-4 pt-3'
        content.style.overflow = 'hidden'
        content.style.maxHeight = '0px'
        content.style.opacity = '0'
        content.style.transition = 'max-height 260ms ease-out, opacity 200ms ease-out'

        const fileSection = document.createElement('div')
        fileSection.className = 'space-y-2'
        const fileTitle = document.createElement('div')
        fileTitle.className = 'text-xs font-medium text-gray-700'
        fileTitle.textContent = '文件级语义生成'
        const fileList = document.createElement('div')
        fileList.className = 'space-y-2'
        fileSection.appendChild(fileTitle)
        fileSection.appendChild(fileList)

        const chunkSection = document.createElement('div')
        chunkSection.className = 'space-y-2'
        const chunkTitle = document.createElement('div')
        chunkTitle.className = 'text-xs font-medium text-gray-700'
        chunkTitle.textContent = '切片级语义生成'
        const chunkList = document.createElement('div')
        chunkList.className = 'space-y-2'
        chunkSection.appendChild(chunkTitle)
        chunkSection.appendChild(chunkList)

        content.appendChild(fileSection)
        content.appendChild(chunkSection)

        wrapper.appendChild(btn)
        wrapper.appendChild(content)
        mount.appendChild(wrapper)

        btn.addEventListener('click', function () {
            const expanded = btn.getAttribute('aria-expanded') === 'true'
            setAdvancedExpanded(!expanded)
        })

        btn.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            const expanded = btn.getAttribute('aria-expanded') === 'true'
            setAdvancedExpanded(!expanded)
        })

        content.addEventListener('transitionend', function (e) {
            if (e.propertyName !== 'max-height') return
            if (btn.getAttribute('aria-expanded') === 'true') {
                content.style.maxHeight = 'none'
            }
        })

        const moveRow = function (id, target) {
            const input = (contentRoot ? contentRoot.querySelector('#' + id) : null) || getEl(id)
            if (!input) return
            const row = input.closest('div')
            if (!row) return
            target.appendChild(row)
        }

        moveRow('create-kb-gen-summary-file', fileList)
        moveRow('create-kb-gen-keywords-file', fileList)
        moveRow('create-kb-gen-questions-file', fileList)
        moveRow('create-kb-gen-summary-chunk', chunkList)
        moveRow('create-kb-gen-keywords-chunk', chunkList)
        moveRow('create-kb-gen-questions-chunk', chunkList)

        if (!wrapper.querySelector('#create-kb-gen-questions-chunk') && !getEl('create-kb-gen-questions-chunk')) {
            const row = document.createElement('div')
            row.className = 'flex items-center gap-2'
            const input = document.createElement('input')
            input.id = 'create-kb-gen-questions-chunk'
            input.type = 'checkbox'
            input.className = 'rounded text-blue-500 focus:ring-blue-500 border-gray-300'
            const label = document.createElement('label')
            label.setAttribute('for', 'create-kb-gen-questions-chunk')
            label.className = 'text-xs text-gray-600'
            label.textContent = '生成问题'
            row.appendChild(input)
            row.appendChild(label)
            chunkList.appendChild(row)
        }

        const setLabelText = function (forId, text) {
            const label = wrapper.querySelector('label[for="' + forId + '"]') || document.querySelector('label[for="' + forId + '"]')
            if (label) label.textContent = text
        }

        setLabelText('create-kb-gen-summary-file', '生成摘要')
        setLabelText('create-kb-gen-keywords-file', '生成关键字')
        setLabelText('create-kb-gen-questions-file', '生成问题')
        setLabelText('create-kb-gen-summary-chunk', '生成摘要')
        setLabelText('create-kb-gen-keywords-chunk', '生成关键字')
        setLabelText('create-kb-gen-questions-chunk', '生成问题')

        setAdvancedExpanded(false)
    }

    function setOpenState(open) {
        const page = getEl('batch-slice-settings-page')
        if (page) page.setAttribute('aria-hidden', open ? 'false' : 'true')
        try {
            localStorage.setItem(STORAGE_KEY, open ? '1' : '0')
        } catch (_) {
        }
    }

    function isOpen() {
        const page = getEl('batch-slice-settings-page')
        return page ? !page.classList.contains('hidden') : false
    }

    function focusFirstControl() {
        const content = getEl('batch-slice-settings-page-content')
        if (!content) return
        const first = content.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
        if (first && typeof first.focus === 'function') first.focus()
    }

    function ensureLoaded() {
        const content = getEl('batch-slice-settings-page-content')
        const loading = getEl('batch-slice-settings-page-loading')
        if (!content || !loading) return
        if (content.dataset.loaded === '1') {
            ensureAdvancedConfigModule()
            return
        }

        loading.classList.remove('hidden')
        content.classList.add('hidden')

        setTimeout(function () {
            const source = getEl('kb-create-step-3-content')
            if (source) {
                const hint = getEl('kb-create-step-3-migrated-hint')
                if (hint) hint.classList.remove('hidden')

                const innerTitle = source.querySelector('h3')
                if (innerTitle && innerTitle.textContent && innerTitle.textContent.trim() === '索引设置') {
                    innerTitle.classList.add('hidden')
                }

                content.innerHTML = ''
                content.appendChild(source)
                ensureAdvancedConfigModule()
            } else {
                content.innerHTML = '<div class="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4">加载失败：未找到索引设置内容。</div>'
            }
            content.dataset.loaded = '1'
            loading.classList.add('hidden')
            content.classList.remove('hidden')
            focusFirstControl()
        }, 250)
    }

    function openBatchSliceSettingsPage(opts) {
        const page = getEl('batch-slice-settings-page')
        const listContent = getEl('doc-list-tab')
        const knowledgeContent = getEl('knowledge-view-tab')
        const title = getEl('batch-slice-settings-page-title')
        const btn = getEl('btn-batch-slice')
        if (!page || !listContent || !knowledgeContent) return

        if (btn) btn.dataset.returnFocusId = btn.id

        listContent.classList.add('hidden')
        knowledgeContent.classList.add('hidden')
        page.classList.remove('hidden')
        page.classList.add('animate-fade-in')
        setOpenState(true)
        ensureLoaded()

        if (!document.body.dataset.batchSlicePageEscBound) {
            document.addEventListener('keydown', handleBatchSliceSettingsPageEsc, true)
            document.body.dataset.batchSlicePageEscBound = '1'
        }

        if (!opts || !opts.restore) {
            if (title && typeof title.focus === 'function') title.focus()
        }
    }

    function closeBatchSliceSettingsPage() {
        const page = getEl('batch-slice-settings-page')
        const listContent = getEl('doc-list-tab')
        const knowledgeContent = getEl('knowledge-view-tab')
        const btn = getEl('btn-batch-slice')
        if (!page || !listContent || !knowledgeContent) return

        page.classList.add('hidden')
        setOpenState(false)

        const currentTab = (function () {
            try {
                return localStorage.getItem('kbCurrentTab') || 'list'
            } catch (_) {
                return 'list'
            }
        })()

        if (currentTab === 'knowledge') {
            knowledgeContent.classList.remove('hidden')
            listContent.classList.add('hidden')
        } else {
            listContent.classList.remove('hidden')
            knowledgeContent.classList.add('hidden')
            
            // Force refresh list to avoid blank page
            if (typeof window.renderDocList === 'function') {
                try {
                    // Reset loading state if needed
                    if (typeof window.isLoadingMoreDocs !== 'undefined') {
                        window.isLoadingMoreDocs = false;
                    }
                    window.renderDocList();
                } catch(e) {
                    console.error("Failed to render doc list after closing settings:", e);
                    // Fallback: reload page if critical failure? No, better show error.
                    listContent.innerHTML = '<div class="p-4 text-center text-red-500">列表加载失败，请刷新页面重试</div>';
                }
            }
        }

        try {
            if (btn) btn.focus()
        } catch (_) {
        }
    }

    function handleBatchSliceSettingsPageEsc(e) {
        if (e.key !== 'Escape') return
        if (!isOpen()) return
        e.preventDefault()
        closeBatchSliceSettingsPage()
    }

    function initBatchSliceSettingsPage() {
        const page = getEl('batch-slice-settings-page')
        if (!page) return
        page.setAttribute('aria-hidden', page.classList.contains('hidden') ? 'true' : 'false')

        let shouldRestore = false
        try {
            shouldRestore = localStorage.getItem(STORAGE_KEY) === '1'
        } catch (_) {
        }
        if (shouldRestore) {
            openBatchSliceSettingsPage({ restore: true })
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initBatchSliceSettingsPage)
        } else {
            initBatchSliceSettingsPage()
        }
    }

    return {
        initBatchSliceSettingsPage,
        openBatchSliceSettingsPage,
        closeBatchSliceSettingsPage,
        handleBatchSliceSettingsPageEsc,
    }
})
