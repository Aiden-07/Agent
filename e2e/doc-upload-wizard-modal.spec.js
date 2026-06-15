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

test('上传文档弹窗：关闭按钮/遮罩/ESC/返回键都能恢复状态', async ({ page }) => {
    await enterFirstKbDocList(page)

    const hashBefore = page.url()

    await page.evaluate(() => {
        const scroller = document.getElementById('doc-list-scroll-container')
        if (scroller) scroller.scrollTop = 120
    })

    await page.click('#btn-upload-doc')
    await page.waitForSelector('#doc-upload-wizard:not(.hidden)')
    await expect(page.locator('#doc-upload-wizard')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('#doc-upload-wizard')).toHaveClass(/\bhidden\b/)

    const scrollAfterEsc = await page.evaluate(() => {
        const scroller = document.getElementById('doc-list-scroll-container')
        return scroller ? scroller.scrollTop : null
    })
    expect(scrollAfterEsc).toBe(120)
    expect(page.url()).toBe(hashBefore)

    await page.click('#btn-upload-doc')
    await page.waitForSelector('#doc-upload-wizard:not(.hidden)')
    await page.locator('#doc-upload-wizard > div').first().click({ position: { x: 10, y: 10 } })
    await expect(page.locator('#doc-upload-wizard')).toHaveClass(/\bhidden\b/)

    const scrollAfterOverlay = await page.evaluate(() => {
        const scroller = document.getElementById('doc-list-scroll-container')
        return scroller ? scroller.scrollTop : null
    })
    expect(scrollAfterOverlay).toBe(120)

    await page.click('#btn-upload-doc')
    await page.waitForSelector('#doc-upload-wizard:not(.hidden)')

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#doc-upload-wizard')).toHaveClass(/\bhidden\b/)
    expect(page.url()).toBe(hashBefore)

    await page.click('#btn-upload-doc')
    await page.waitForSelector('#doc-upload-wizard:not(.hidden)')

    await page.locator('#doc-upload-wizard button:has(i.fa-xmark)').click()
    await expect(page.locator('#doc-upload-wizard')).toHaveClass(/\bhidden\b/)

    const scrollAfterX = await page.evaluate(() => {
        const scroller = document.getElementById('doc-list-scroll-container')
        return scroller ? scroller.scrollTop : null
    })
    expect(scrollAfterX).toBe(120)
})
