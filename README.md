# EPREL 專業商用冰箱節能數據收割系統

![Node.js](https://img.shields.io/badge/node.js-6.x-green)
![Puppeteer](https://img.shields.io/badge/library-Puppeteer--Stealth-orange)
![ITRI](https://img.shields.io/badge/Research-ITRI%20GEL-blue)

## 📌 專案概述
本專案為一套高性能的自動化數據採集工具，專為蒐集 **歐盟產品資料庫 (EPREL)** 中的「專業商用冷凍冷藏櫃 (Professional Refrigerated Storage Cabinets)」節能標籤數據而開發。

透過自動化流程，本系統能處理數萬筆產品資訊，實時攔截後端 API 數據，並自動完成清洗、去重與能源等級分類。

## ✨ 核心功能
- **隱身瀏覽 (Stealth Browsing)**：整合 `puppeteer-extra-plugin-stealth` 插件，有效規避網站防火牆的自動偵測。
- **API 數據攔截**：直接獲取 EPREL 後端 JSON 數據，避免傳統 DOM 解析可能產生的位移誤差，確保數據 100% 準確。
- **自動化分類存檔**：系統會根據能源效率分級（APPP, APP, AP, A, B, C 等）自動建立 Excel 分頁，便於後續數據分析。
- **數據完整性保護**：
  - **動態去重**：基於 `Set` 邏輯，自動過濾翻頁過程中產生的重複數據。
  - **異常處理**：針對缺失註冊號的產品自動生成追蹤 ID，確保收割過程不漏掉任何一筆資料。
- **實時統計顯示**：執行時終端機會同步顯示各能源等級的筆數分佈與佔比，即時掌握整體市場節能趨勢。

## 🛠️ 技術棧
- **核心引擎**: Node.js
- **自動化框架**: Puppeteer & Puppeteer-Extra
- **數據處理**: XLSX (SheetJS)
- **開發背景**: 台灣新竹工研院 (ITRI) 專業開發環境

## 🚀 快速上手

### 前置作業
- 安裝 Node.js (建議 v16 以上版本)
- 安裝 npm 相關套件

### 安裝步驟
1. 複製此儲存庫：
   ```bash
   git clone [https://github.com/YORROY123/EPREL-Scraper-Professional-refrigerated-storage-cabinets.git](https://github.com/YORROY123/EPREL-Scraper-Professional-refrigerated-storage-cabinets.git)
   ```
2. 安裝套件：
   ```bash
   npm install
   ```
3. 執行爬蟲：
   ```bash
   node diy_scraper.js
   ```
>提示：瀏覽器啟動後，請手動點擊「Accept Cookies」並將每頁顯示筆數切換至「100」，以獲得最佳收割效率。

## 📊 數據輸出結果

系統將生成 EPREL_Final_Report.xlsx，內含：
- All_Data：所有收割資料
- Class APPP：所有 APPP 等級資料
- Class APP：所有 APP 等級資料
- Class AP：所有 AP 等級資料
- Class A：所有 A 等級資料
- Class B：所有 B 等級資料
- Class C：所有 C 等級資料


## ⚖️ 免責聲明

本工具僅供能源效率研究與學術分析使用。使用者應遵守目標網站的使用條款及相關法律規範。

開發者：林子揚 (Lin, Tzu-Yang) 工研院 綠能與環境研究所 (GEL) 研究人員

---

