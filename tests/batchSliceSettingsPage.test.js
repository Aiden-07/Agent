const { JSDOM } = require('jsdom')

const {
    initBatchSliceSettingsPage,
    openBatchSliceSettingsPage,
    closeBatchSliceSettingsPage,
    handleBatchSliceSettingsPageEsc,
} = require('../js/batch-slice-settings-page')

describe('Batch slice settings page', () => {
    let dom

    beforeEach(() => {
        jest.useFakeTimers()
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
              <body>
                <button id="btn-batch-slice"></button>
                <div id="doc-list-tab"></div>
                <div id="knowledge-view-tab" class="hidden"></div>

                <div id="kb-create-step-3">
                  <div id="kb-create-step-3-migrated-hint" class="hidden"></div>
                  <div id="kb-create-step-3-content">
                    <h3>索引设置</h3>
                    <div id="create-kb-settings-column" class="space-y-4">
                      <div id="create-kb-slice-config-container"></div>
                      <div id="create-kb-special-options"></div>
                      <input id="create-kb-slice-size" />
                      <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-questions-file" type="checkbox" />
                          <label for="create-kb-gen-questions-file">基于文件生成问题</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-summary-file" type="checkbox" checked />
                          <label for="create-kb-gen-summary-file">基于文件生成摘要</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-keywords-file" type="checkbox" />
                          <label for="create-kb-gen-keywords-file">基于文件生成关键字</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-questions-chunk" type="checkbox" />
                          <label for="create-kb-gen-questions-chunk">基于切块生成问题</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-summary-chunk" type="checkbox" />
                          <label for="create-kb-gen-summary-chunk">基于切块生成摘要</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input id="create-kb-gen-keywords-chunk" type="checkbox" />
                          <label for="create-kb-gen-keywords-chunk">基于切块生成关键字</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="batch-slice-settings-page" class="hidden" aria-hidden="true">
                  <h2 id="batch-slice-settings-page-title" tabindex="-1"></h2>
                  <div id="batch-slice-settings-page-loading" class="hidden"></div>
                  <div id="batch-slice-settings-page-content" class="hidden"></div>
                  <div id="batch-advanced-config-host"></div>
                </div>
              </body>
            </html>
        `, { url: 'http://localhost' })

        global.window = dom.window
        global.document = dom.window.document
        global.localStorage = dom.window.localStorage
    })

    afterEach(() => {
        jest.useRealTimers()
        delete global.window
        delete global.document
        delete global.localStorage
    })

    test('open shows settings page and hides other tabs', () => {
        localStorage.setItem('kbCurrentTab', 'list')
        openBatchSliceSettingsPage()
        expect(document.getElementById('batch-slice-settings-page').classList.contains('hidden')).toBe(false)
        expect(document.getElementById('doc-list-tab').classList.contains('hidden')).toBe(true)
        expect(document.getElementById('knowledge-view-tab').classList.contains('hidden')).toBe(true)

        jest.advanceTimersByTime(250)
        const content = document.getElementById('batch-slice-settings-page-content')
        expect(content.classList.contains('hidden')).toBe(false)
        expect(content.querySelector('#create-kb-slice-size')).toBeTruthy()
        expect(document.getElementById('kb-create-step-3-migrated-hint').classList.contains('hidden')).toBe(false)
        expect(content.querySelector('h3').classList.contains('hidden')).toBe(true)
    })

    test('ESC closes settings page', () => {
        localStorage.setItem('kbCurrentTab', 'list')
        openBatchSliceSettingsPage()
        jest.advanceTimersByTime(250)

        const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape' })
        handleBatchSliceSettingsPageEsc(escEvent)
        expect(document.getElementById('batch-slice-settings-page').classList.contains('hidden')).toBe(true)
        expect(document.getElementById('doc-list-tab').classList.contains('hidden')).toBe(false)
    })

    test('persist open/close preference', () => {
        openBatchSliceSettingsPage()
        expect(localStorage.getItem('batch_slice_settings_page_open')).toBe('1')
        closeBatchSliceSettingsPage()
        expect(localStorage.getItem('batch_slice_settings_page_open')).toBe('0')
    })

    test('init restores open preference', () => {
        localStorage.setItem('batch_slice_settings_page_open', '1')
        initBatchSliceSettingsPage()
        expect(document.getElementById('batch-slice-settings-page').classList.contains('hidden')).toBe(false)
    })

    test('advanced config module is visible and collapsed by default', () => {
        openBatchSliceSettingsPage()
        jest.advanceTimersByTime(250)

        const wrapper = document.getElementById('batch-advanced-config')
        expect(wrapper).toBeTruthy()
        const btn = wrapper.querySelector('#batch-advanced-config-toggle')
        const content = wrapper.querySelector('#batch-advanced-config-content')
        expect(btn.getAttribute('aria-expanded')).toBe('false')
        expect(content.style.maxHeight).toBe('0px')
    })

    test('advanced config expand/collapse toggles and aria-expanded updates', () => {
        openBatchSliceSettingsPage()
        jest.advanceTimersByTime(250)

        const btn = document.getElementById('batch-advanced-config-toggle')
        const content = document.getElementById('batch-advanced-config-content')

        Object.defineProperty(content, 'scrollHeight', { value: 200, configurable: true })
        btn.click()
        expect(btn.getAttribute('aria-expanded')).toBe('true')
        expect(content.style.maxHeight).toBe('200px')
        btn.click()
        expect(btn.getAttribute('aria-expanded')).toBe('false')
        expect(content.style.maxHeight).toBe('0px')
    })

    test('advanced config contains six items in correct order with 16px gap', () => {
        openBatchSliceSettingsPage()
        jest.advanceTimersByTime(250)

        const content = document.getElementById('batch-advanced-config-content')
        expect(content.classList.contains('space-y-4')).toBe(true)

        const ids = Array.from(content.querySelectorAll('input')).map((el) => el.id)
        expect(ids).toEqual([
            'create-kb-gen-summary-file',
            'create-kb-gen-keywords-file',
            'create-kb-gen-questions-file',
            'create-kb-gen-summary-chunk',
            'create-kb-gen-keywords-chunk',
            'create-kb-gen-questions-chunk',
        ])

        expect(content.textContent.includes('文件级语义生成')).toBe(true)
        expect(content.textContent.includes('切片级语义生成')).toBe(true)
    })

    test('advanced config state and values persist across mode-like toggles', () => {
        openBatchSliceSettingsPage()
        jest.advanceTimersByTime(250)

        const btn = document.getElementById('batch-advanced-config-toggle')
        btn.click()
        expect(btn.getAttribute('aria-expanded')).toBe('true')

        const movedInput = document.getElementById('create-kb-gen-summary-file')
        expect(movedInput.checked).toBe(true)

        document.getElementById('create-kb-slice-config-container').classList.add('hidden')
        document.getElementById('create-kb-special-options').classList.remove('hidden')

        expect(document.getElementById('batch-advanced-config')).toBeTruthy()
        expect(btn.getAttribute('aria-expanded')).toBe('true')
        expect(movedInput.checked).toBe(true)
    })
})
