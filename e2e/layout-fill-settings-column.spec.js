const { test, expect } = require('@playwright/test')

test('切片设置页左侧设置区填充父容器且无滚动条', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
        localStorage.setItem('kbViewingOriginal', 'false')
    })

    await page.goto('/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('#knowledge-list-body')
    await page.waitForSelector('#knowledge-list-body [onclick*="showKbDetail"]')

    const kbId = await page.evaluate(() => {
        const el = document.querySelector('#knowledge-list-body [onclick*="showKbDetail"]')
        const attr = el ? el.getAttribute('onclick') || '' : ''
        const m = attr.match(/showKbDetail\('([^']+)'\)/)
        return m ? m[1] : null
    })
    if (kbId) await page.evaluate((id) => window.showKbDetail(id), kbId)
    await page.waitForSelector('#doc-list-tab:not(.hidden)')

    await page.evaluate(() => {
        if (typeof window.enterBatchOperationMode === 'function') window.enterBatchOperationMode()
    })
    await page.evaluate(() => {
        if (typeof window.openBatchSliceSettingsPage === 'function') window.openBatchSliceSettingsPage()
    })
    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')
    await page.waitForSelector('#create-kb-settings-column', { state: 'attached' })

    const metrics = await page.evaluate(() => {
        const parent = document.getElementById('kb-create-left-column-step3')
        const child = document.getElementById('create-kb-settings-column')
        if (!parent || !child) return null

        const p = parent.getBoundingClientRect()
        const c = child.getBoundingClientRect()

        return {
            parent: { w: p.width, h: p.height, left: p.left, top: p.top },
            child: { w: c.width, h: c.height, left: c.left, top: c.top },
            scroll: {
                childScrollW: child.scrollWidth,
                childClientW: child.clientWidth,
                childScrollH: child.scrollHeight,
                childClientH: child.clientHeight,
            },
            css: {
                overflowY: getComputedStyle(child).overflowY,
                scrollbarWidth: getComputedStyle(child).scrollbarWidth,
            },
        }
    })

    expect(metrics).toBeTruthy()
    expect(Math.abs(metrics.child.w - metrics.parent.w)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.child.h - metrics.parent.h)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.child.left - metrics.parent.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.child.top - metrics.parent.top)).toBeLessThanOrEqual(1)

    expect(metrics.css.overflowY === 'auto' || metrics.css.overflowY === 'scroll').toBe(true)
    if (test.info().project.name.includes('firefox')) {
        expect(metrics.css.scrollbarWidth).toBe('none')
    }

    await page.screenshot({ path: test.info().outputPath('settings-column-fill.png'), fullPage: true })
})
