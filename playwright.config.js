const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:8000',
        headless: true,
    },
    webServer: {
        command: 'python3 server.py',
        url: 'http://localhost:8000/',
        reuseExistingServer: true,
        timeout: 30_000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        {
            name: 'firefox',
            use: {
                browserName: 'firefox',
                launchOptions: {
                    env: {
                        MOZ_DISABLE_CONTENT_SANDBOX: '1',
                        MOZ_DISABLE_GMP_SANDBOX: '1',
                        MOZ_DISABLE_RDD_SANDBOX: '1',
                        MOZ_DISABLE_GPU_SANDBOX: '1',
                    },
                },
                firefoxUserPrefs: {
                    'security.sandbox.content.level': 0,
                },
            },
        },
        { name: 'webkit', use: { browserName: 'webkit' } },
        {
            name: 'webkit-iphone',
            use: {
                ...devices['iPhone 12'],
                browserName: 'webkit',
            },
        },
        {
            name: 'chromium-android',
            use: {
                ...devices['Pixel 5'],
                browserName: 'chromium',
            },
        },
    ],
})
