# 五子棋 Gomoku

一個可直接執行的線上五子棋 MVP，包含：

- 遊戲大廳與在線玩家名單
- 一對一邀請、接受／婉拒與跨分頁即時對局
- 單人模式，提供初級、進階、困難三級 AI
- 單人 AI 採用 Rapfi WebAssembly：初級搜尋 0.5 秒、進階 1.5 秒、困難全力搜尋 3.5 秒
- Rapfi 在背景 Worker 執行；WASM 不支援或載入失敗時自動切換原生 JavaScript AI
- 單人執黑或執白，以及回到上一步、重新開始
- 三戰兩勝／五戰三勝系列賽、局末續戰確認與每局交換黑白
- 線上邀請者可決定第一局先手或後手，棋局快照具版本防倒退保護
- 橫、直、斜向五子勝負判定與瀏覽器本機對戰紀錄
- 響應式桌面與手機版面

## 執行網頁版

```bash
npm install
npm start
```

開啟 [http://localhost:5173](http://localhost:5173)。如要測試線上邀請，可再開一個無痕視窗；每個分頁會被視為獨立玩家。

## 執行 macOS 桌面版

```bash
npm run desktop
```

## 部署 Koyeb 後端

Koyeb 可以直接從這個 GitHub repository 使用 Node.js Buildpack 部署：

- Repository：`tingchuchi/gomoku-online`
- Branch：`main`
- Run command：`npm start`
- Service type：Web Service
- Instance：Free
- Environment variable：`HOST=0.0.0.0`

Koyeb 會自動提供 `PORT`，`server.mjs` 會讀取並使用它。部署完成後，將 Koyeb 的 HTTPS 網址填入 `config.js`，再推送到 GitHub Pages。

> Koyeb 在 2026 年加入 Mistral 後，新註冊帳戶需要付費方案；以上設定保留給既有 Koyeb 帳戶使用。

## 部署 Render 免費後端

專案根目錄的 [`render.yaml`](render.yaml) 已定義免費 Web Service：

- Region：Singapore
- Build command：`npm ci --omit=dev`
- Start command：`npm start`
- Health check：`/`
- Instance：Free

在 Render 建立 Blueprint 並連接 `tingchuchi/gomoku-online` 後會自動部署。取得 `https://...onrender.com` 網址後，將它填入 `config.js`，GitHub Pages 即可使用線上大廳。

目前部署網址：[`https://gomoku-online-x78w.onrender.com`](https://gomoku-online-x78w.onrender.com)

## 部署到 GitHub Pages

專案已包含 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)。推送到 `main` 分支後，GitHub Actions 會自動整理靜態檔案並部署，因此也支援 `https://帳號.github.io/倉庫名稱/` 這類子路徑網址。

1. 在 GitHub 建立 repository，將此專案推送到 `main`。
2. 進入 repository 的 **Settings → Pages**。
3. 將 **Source** 設定為 **GitHub Actions**。
4. 到 **Actions** 查看 `Deploy GitHub Pages`，完成後即可開啟 Pages 網址。

GitHub Pages 僅提供靜態託管，所以單人 AI、悔棋與本機紀錄可直接使用；線上大廳需要另外部署 `server.mjs`。

### 啟用 Pages 上的線上大廳

後端部署完成後，編輯 [`config.js`](config.js)：

```js
window.GOMOKU_CONFIG = {
  apiBaseUrl: "https://你的後端網址.example.com"
};
```

後端網址必須支援 HTTPS。`server.mjs` 已加入跨網域請求支援；正式環境可設定 `ALLOWED_ORIGIN=https://帳號.github.io`，限制允許的前端來源。

## 打包 macOS app

```bash
npm run build:mac
```

## 架構說明

前端使用原生 HTML、CSS 與 JavaScript，無框架依賴。`server.mjs` 同時提供本機靜態檔案、大廳邀請與棋局 API；目前資料保存在伺服器記憶體，重啟後會清除，適合 MVP 與測試。正式部署時可將玩家、邀請與棋局狀態換成 Redis／資料庫，並把輪詢升級成 WebSocket。

## Rapfi 授權

單人模式整合 [Rapfi](https://github.com/dhbloo/rapfi) WebAssembly 引擎，依 GNU GPL v3 授權。完整授權文字與可重現建置資訊位於 `vendor/rapfi/`；本專案使用的 Rapfi 二進位由官方原始碼自行編譯，未修改引擎 C++ 原始碼。
