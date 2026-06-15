const { test, expect } = require('@playwright/test')

test('切片设置页文案渲染与内容迁移', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
    })
    await page.goto('/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('#kb-list-view')

    await page.waitForSelector('#knowledge-list-body')
    await page.locator('#knowledge-list-body [onclick*="showKbDetail"]').first().click()

    await page.waitForSelector('#kb-detail-view:not(.hidden)')
    await page.waitForSelector('#doc-list-tab:not(.hidden)')

    await page.evaluate(() => {
        if (typeof window.enterBatchOperationMode === 'function') window.enterBatchOperationMode()
    })
    await page.getByRole('button', { name: '批量切片' }).click()

    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')
    await expect(page.locator('#batch-slice-settings-page-title')).toHaveText('切片设置')
    await expect(page.getByText('在此配置切片与处理规则')).toBeVisible()

    const titleFits = await page.locator('#batch-slice-settings-page-title').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    const descFits = await page.getByText('在此配置切片与处理规则').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(titleFits).toBeTruthy()
    expect(descFits).toBeTruthy()

    await expect(page.locator('#create-kb-slice-delimiter')).toBeVisible()
    await expect(page.locator('#create-kb-slice-size')).toBeVisible()
    await expect(page.locator('#create-kb-slice-overlap')).toBeVisible()
})

test('保存后文档列表“设置”列显示选中策略名称', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
    })
    await page.goto('/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('#knowledge-list-body')
    await page.locator('#knowledge-list-body [onclick*="showKbDetail"]').first().click()

    await page.waitForSelector('#doc-list-tab:not(.hidden)')
    const firstRowSettingBtn = page.locator('#doc-list-body tr').first().locator('button[aria-label="打开切片设置"]')
    await expect(firstRowSettingBtn).toHaveText('设置')

    await page.evaluate(() => {
        const btn = document.querySelector('#doc-list-body tr button[aria-label="打开切片设置"]')
        const attr = btn ? btn.getAttribute('onclick') || '' : ''
        const m = attr.match(/\[\'([^\']+)\'\]/)
        const id = m ? m[1] : null
        if (id) window.batchSliceTargetDocIds = [id]
        if (typeof window.openBatchSliceSettingsPage === 'function') window.openBatchSliceSettingsPage()
    })
    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')

    await page.evaluate(() => {
        if (typeof window.selectSliceStrategy === 'function') window.selectSliceStrategy('special')
    })
    await page.locator('#batch-slice-settings-page [aria-label="保存"]').click({ force: true })

    await page.evaluate(() => {
        if (typeof window.closeBatchSliceSettingsPage === 'function') window.closeBatchSliceSettingsPage()
    })
    await page.waitForSelector('#doc-list-tab:not(.hidden)')
    await expect(firstRowSettingBtn).toHaveText('模版切片')
})

test('切片设置页 ESC 关闭返回', async ({ page }) => {
    const projectName = test.info().project.name
    test.skip(projectName.includes('iphone') || projectName.includes('android'), '移动端项目跳过 ESC 键盘测试')
    test.setTimeout(90_000)

    await page.addInitScript(() => {
        localStorage.setItem('vagent_token', 'e2e_mock_token')
    })
    await page.goto('/#/knowledge', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('#kb-list-view')
    await page.waitForSelector('#knowledge-list-body')
    await page.locator('#knowledge-list-body [onclick*="showKbDetail"]').first().click()

    await page.waitForSelector('#doc-list-tab:not(.hidden)')
    await page.evaluate(() => {
        if (typeof window.enterBatchOperationMode === 'function') window.enterBatchOperationMode()
    })
    await page.getByRole('button', { name: '批量切片' }).click()
    await page.waitForSelector('#batch-slice-settings-page:not(.hidden)')

    await page.keyboard.press('Escape')
    await expect(page.locator('#batch-slice-settings-page')).toHaveClass(/\bhidden\b/)
    await page.waitForSelector('#doc-list-tab:not(.hidden)')
})
