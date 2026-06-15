const { chromium } = require('playwright')

async function run() {
    const browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
    })

    await page.goto('http://localhost:8000/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 60_000 })
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
    await page.evaluate(() => window.openBatchSliceSettingsPage())
    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')

    async function measure(label) {
        const metrics = await page.evaluate(() => {
            const cancelEl = document.querySelector('#batch-slice-settings-page [aria-label="取消"]')
            const saveEl = document.querySelector('#batch-slice-settings-page [aria-label="保存"]')
            if (!cancelEl || !saveEl) return null
            const a = cancelEl.getBoundingClientRect()
            const b = saveEl.getBoundingClientRect()
            return {
                viewport: { w: window.innerWidth, h: window.innerHeight },
                cancel: { top: a.top, left: a.left, width: a.width, height: a.height },
                save: { top: b.top, left: b.left, width: b.width, height: b.height },
                horizontalGap: Math.max(0, b.left - (a.left + a.width)),
                verticalGap: Math.max(0, b.top - (a.top + a.height)),
            }
        })
        return { label, metrics }
    }

    const result = []
    result.push(await measure('390x844'))

    await page.setViewportSize({ width: 320, height: 700 })
    await page.waitForTimeout(200)
    result.push(await measure('320x700'))

    console.log(JSON.stringify(result, null, 2))
    await browser.close()
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})

