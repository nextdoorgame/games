/*
 * GitHub Pages 本身不能執行 server.mjs。
 * 若已將後端部署到其他服務，請把公開的 HTTPS 網址填在下方，結尾不要加斜線。
 * 本機以 npm run web 執行時，留空會自動使用目前網址。
 */
window.GOMOKU_CONFIG = {
  apiBaseUrl: ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? window.location.origin
    : "https://gomoku-online-x78w.onrender.com"
};
