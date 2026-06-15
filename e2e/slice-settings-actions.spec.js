const { test, expect } = require('@playwright/test')

async function enterFirstKbDocList(page) {
    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
        localStorage.setItem('kbViewingOriginal', 'false')
    })
    await page.goto('/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForSelector('#knowledge-list-body')
    await page.waitForSelector('#knowledge-list-body [onclick*="showKbDetail"]')
    const kbId = await page.evaluate(() => {
        const el = document.querySelector('#knowledge-list-body [onclick*="showKbDetail"]')
        if (!el) return null
        const attr = el.getAttribute('onclick') || ''
        const m = attr.match(/showKbDetail\('([^']+)'\)/)
        return m ? m[1] : null
    })
    if (kbId) {
        await page.evaluate((id) => window.showKbDetail(id), kbId)
    }
    await page.waitForSelector('#doc-list-tab:not(.hidden)')
}

async function openSliceSettings(page) {
    await page.evaluate(() => {
        if (typeof window.openBatchSliceSettingsPage === 'function') {
            window.openBatchSliceSettingsPage()
        }
    })
    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')
    await page.waitForSelector('#batch-slice-settings-page [aria-label="保存"]', { state: 'visible' })
}

test('切片设置页“取消/保存”按钮可见与间距', async ({ page }) => {
    await enterFirstKbDocList(page)
    await openSliceSettings(page)

    const cancelBtn = page.locator('#batch-slice-settings-page [aria-label="取消"]')
    const saveBtn = page.locator('#batch-slice-settings-page [aria-label="保存"]')

    await expect(cancelBtn).toBeVisible()
    await expect(saveBtn).toBeVisible()

    const metrics = await page.evaluate(() => {
        const cancelEl = document.querySelector('#batch-slice-settings-page [aria-label="取消"]')
        const saveEl = document.querySelector('#batch-slice-settings-page [aria-label="保存"]')
        const footerEl = saveEl ? saveEl.closest('div.px-6.py-4') : null
        const buttonsRow = footerEl ? footerEl.querySelector('div.flex.items-center.justify-end.flex-nowrap') : null
        if (!cancelEl || !saveEl || !footerEl) return null

        const a = cancelEl.getBoundingClientRect()
        const b = saveEl.getBoundingClientRect()
        const footer = footerEl.getBoundingClientRect()

        const computed = buttonsRow ? getComputedStyle(buttonsRow) : null
        const colGap = computed ? (parseFloat(computed.columnGap) || parseFloat(computed.gap) || 0) : 0
        const rowGap = computed ? (parseFloat(computed.rowGap) || 0) : 0

        return {
            cancel: { x: a.left, y: a.top, w: a.width, h: a.height },
            save: { x: b.left, y: b.top, w: b.width, h: b.height },
            footer: { x: footer.left, y: footer.top, w: footer.width, h: footer.height },
            colGap,
            rowGap,
        }
    })

    expect(metrics).toBeTruthy()
    expect(metrics.colGap).toBeGreaterThanOrEqual(12)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(100)
    await page.screenshot({ path: test.info().outputPath('slice-settings-actions-390.png'), fullPage: true })
})

test('切片设置页按钮在 320px 宽度下不遮挡关键内容', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await enterFirstKbDocList(page)
    await openSliceSettings(page)

    const cancelBtn = page.locator('#batch-slice-settings-page [aria-label="取消"]')
    const saveBtn = page.locator('#batch-slice-settings-page [aria-label="保存"]')
    await expect(cancelBtn).toBeVisible()
    await expect(saveBtn).toBeVisible()

    await page.screenshot({ path: test.info().outputPath('slice-settings-actions-320.png'), fullPage: true })
})

test('切片设置页“取消”关闭且不改变既有 Tab 顺序', async ({ page }) => {
    const projectName = test.info().project.name
    test.skip(projectName.includes('iphone') || projectName.includes('android'), '移动端项目跳过键盘 Tab 顺序测试')

    await enterFirstKbDocList(page)
    await openSliceSettings(page)

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const activeAfter = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'))

    expect(activeAfter).not.toBe('取消')
    expect(activeAfter).not.toBe('保存')

    await page.locator('#batch-slice-settings-page [aria-label="取消"]').click({ force: true })
    await expect(page.locator('#batch-slice-settings-page')).toHaveClass(/\bhidden\b/)
})

test('移动端视口：按钮可见', async ({ page }) => {
    await enterFirstKbDocList(page)
    await openSliceSettings(page)
    await expect(page.locator('#batch-slice-settings-page [aria-label="取消"]')).toBeVisible()
    await expect(page.locator('#batch-slice-settings-page [aria-label="保存"]')).toBeVisible()
})
