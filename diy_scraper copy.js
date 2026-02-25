const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const xlsx = require('xlsx');

puppeteer.use(StealthPlugin());

async function runScraper() {
    console.log('🚀 啟動 16.8 歐盟分級 + 即時統計版...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const [page] = await browser.pages();
    let allProducts = [];
    const seenIds = new Set();

    // 攔截器：處理假 ID 與標記
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/products/') && !url.includes('/labels')) {
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    const items = Array.isArray(data) ? data : (data.hits || data.content || data.data || []);

                    items.forEach(item => {
                        let isFake = false;
                        if (!item.eprelRegistrationNumber) {
                            item.eprelRegistrationNumber = `FAKE_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                            isFake = true;
                        }

                        const id = item.eprelRegistrationNumber;
                        if (!seenIds.has(id)) {
                            seenIds.add(id);
                            if (isFake) item.WAS_MISSING_ID = true;
                            allProducts.push(item);
                        }
                    });
                }
            } catch (e) { }
        }
    });

    await page.goto('https://eprel.ec.europa.eu/screen/product/professionalrefrigeratedstoragecabinets', { waitUntil: 'networkidle2' });
    console.log('⏳ 10秒準備：請完成 Cookie 點擊與 100 筆切換...');
    await new Promise(r => setTimeout(r, 10000));

    let pageCount = 1;
    let lastSavedCount = 0;

    while (true) {
        if (allProducts.length > lastSavedCount) {
            updateLiveExcelAndStats(allProducts);
            lastSavedCount = allProducts.length;
        }

        console.log(`\n📃 掃描進度：第 ${pageCount} 頁 (唯一資料總計: ${allProducts.length} 筆)`);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const clickResult = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, .p-paginator-next, .p-ripple, span'));
            const btn = elements.find(el => {
                const t = el.innerText || "";
                const h = el.innerHTML || "";
                return (t.includes('Next') || h.includes('pi-angle-right')) && el.offsetWidth > 0 && !el.disabled && !el.classList.contains('p-disabled');
            });
            if (btn) { btn.click(); return 'SUCCESS'; }
            return 'NOT_FOUND';
        });

        if (clickResult === 'SUCCESS') {
            let waitTime = 0;
            const currentCount = allProducts.length;
            while (allProducts.length <= currentCount && waitTime < 12) {
                await new Promise(r => setTimeout(r, 1000));
                waitTime++;
                if (waitTime === 6) await page.keyboard.press('Enter');
            }
            pageCount++;
            if (allProducts.length <= currentCount && waitTime >= 12) break;
        } else {
            break;
        }
    }
    console.log(`📊 掃描完畢，共 ${allProducts.length} 筆。`);
    await browser.close();
}

function updateLiveExcelAndStats(data) {
    try {
        const cleanedData = data.map(item => {
            const newItem = { ...item };
            if (newItem.WAS_MISSING_ID) {
                newItem.eprelRegistrationNumber = "";
                delete newItem.WAS_MISSING_ID;
            }
            return newItem;
        });

        // 定義分級
        const levels = ['APPP', 'APP', 'AP', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
        const groups = cleanedData.reduce((acc, item) => {
            // 對應原始資料的等級名稱
            let cls = item.energyClass || 'Unknown';
            if (cls === 'A+++') cls = 'APPP';
            if (cls === 'A++') cls = 'APP';
            if (cls === 'A+') cls = 'AP';

            if (!acc[cls]) acc[cls] = [];
            acc[cls].push(item);
            return acc;
        }, {});

        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(cleanedData), 'All_Data');

        // 終端機統計顯示
        console.log('--- 📊 當前分級統計 ---');
        levels.concat(['Unknown']).forEach(lvl => {
            if (groups[lvl]) {
                const count = groups[lvl].length;
                const percent = ((count / cleanedData.length) * 100).toFixed(1);
                console.log(`[${lvl}]: ${count} 筆 (${percent}%)`);

                const sheet = xlsx.utils.json_to_sheet(groups[lvl]);
                xlsx.utils.book_append_sheet(workbook, sheet, `Class ${lvl}`);
            }
        });
        console.log('----------------------');

        xlsx.writeFile(workbook, 'EPREL_Final_Report.xlsx');
    } catch (e) {
        console.error('❌ 處理失敗:', e.message);
    }
}

runScraper().catch(console.error);