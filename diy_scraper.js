const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const xlsx = require('xlsx');

puppeteer.use(StealthPlugin());

async function runScraper() {
    console.log('🚀 啟動 16.6 數據去重 + 自動分頁存檔版...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const [page] = await browser.pages();
    let allProducts = [];
    const seenIds = new Set(); // 用於即時去重

    // 數據攔截器
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/products/') && !url.includes('/labels')) {
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    const items = Array.isArray(data) ? data : (data.hits || data.content || data.data || []);

                    items.forEach(item => {
                        const id = item.eprelRegistrationNumber;
                        if (id && !seenIds.has(id)) {
                            seenIds.add(id);
                            allProducts.push(item);
                        }
                    });
                    console.log(`✅ [攔截成功] 目前去重後總計： ${allProducts.length} 筆`);
                }
            } catch (e) { }
        }
    });

    console.log('🌐 前往網頁中...');
    await page.goto('https://eprel.ec.europa.eu/screen/product/professionalrefrigeratedstoragecabinets', { waitUntil: 'networkidle2' });

    console.log('⏳ 10秒準備：請點掉 Cookie 並切換到 100 筆/頁...');
    await new Promise(r => setTimeout(r, 10000));

    let pageCount = 1;
    let lastSavedCount = 0;

    while (true) {
        // --- 核心修正：只要數據有增加，就更新那份「唯一的 Excel」 ---
        if (allProducts.length > lastSavedCount) {
            updateLiveExcel(allProducts);
            lastSavedCount = allProducts.length;
        }

        console.log(`📃 正在掃描第 ${pageCount} 頁... (目前唯一資料: ${allProducts.length} 筆)`);

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const clickResult = await page.evaluate(() => {
            function findNextButton() {
                const elements = Array.from(document.querySelectorAll('button, .p-paginator-next, .p-ripple, span'));
                return elements.find(el => {
                    const text = el.innerText || "";
                    const html = el.innerHTML || "";
                    const isNext = text.includes('Next') || html.includes('pi-angle-right');
                    return isNext && el.offsetWidth > 0 && !el.disabled && !el.classList.contains('p-disabled');
                });
            }
            const btn = findNextButton();
            if (btn) { btn.click(); return 'SUCCESS'; }
            return 'NOT_FOUND';
        });

        if (clickResult === 'SUCCESS') {
            console.log('➡️ 執行翻頁...');
            let waitTime = 0;
            const currentCount = allProducts.length;
            while (allProducts.length <= currentCount && waitTime < 12) {
                await new Promise(r => setTimeout(r, 1000));
                waitTime++;
                if (waitTime === 6) await page.keyboard.press('Enter');
            }

            if (allProducts.length > currentCount) {
                pageCount++;
            } else {
                console.log('⚠️ 嘗試補強點擊 (Tab + Enter)...');
                await page.keyboard.press('Tab');
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 4000));
                if (allProducts.length <= currentCount) break;
                pageCount++;
            }
        } else {
            console.log('🏁 找不到按鈕，結束。');
            break;
        }
    }

    console.log(`📊 任務完成，最終資料筆數：${allProducts.length}`);
    await browser.close();
}

// 核心功能：生成包含多個分頁的 Excel
function updateLiveExcel(data) {
    try {
        const workbook = xlsx.utils.book_new();

        // 1. 全部資料分頁
        const allSheet = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(workbook, allSheet, 'All_Data');

        // 2. 按能源等級分類分頁
        const groups = data.reduce((acc, item) => {
            const cls = item.energyClass || 'Unknown';
            if (!acc[cls]) acc[cls] = [];
            acc[cls].push(item);
            return acc;
        }, {});

        // 排序等級（A到G）並建立分頁
        const levels = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Unknown'];
        levels.forEach(lvl => {
            if (groups[lvl] && groups[lvl].length > 0) {
                const sheet = xlsx.utils.json_to_sheet(groups[lvl]);
                // Excel 分頁名稱長度限制為 31 字元
                xlsx.utils.book_append_sheet(workbook, sheet, `Class ${lvl}`.substring(0, 31));
            }
        });

        // 儲存檔案（每次都會覆蓋舊的，保持最新）
        const fileName = 'EPREL_Final_Report.xlsx';
        xlsx.writeFile(workbook, fileName);
        console.log(`💾 [同步存檔] 已更新 ${fileName} (總表 + ${Object.keys(groups).length} 個分類分頁)`);
    } catch (e) {
        console.error('❌ 存檔出錯:', e.message);
    }
}

runScraper().catch(console.error);