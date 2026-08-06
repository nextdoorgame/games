import { accountRequest, currentAccount, login, restoreSession } from "./account.js";

const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#loginPanel");
const adminPanel = $("#adminPanel");
const loginMessage = $("#loginMessage");
const adminMessage = $("#adminMessage");
const formatCoins = (value) => `${Number(value || 0).toLocaleString("zh-TW")} ♪`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));

function showAdmin() {
  const account = currentAccount();
  loginPanel.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  $("#adminName").textContent = `${account.displayName} 的帳號管理`;
}

async function loadAccounts() {
  adminMessage.textContent = "";
  try {
    const data = await accountRequest("/api/admin/accounts");
    const accounts = data.accounts || [];
    $("#summary").textContent = `目前共 ${accounts.length} 個帳號`;
    $("#accountsBody").innerHTML = accounts.map((account) => `<tr><td><small>${escapeHtml(account.id)}</small></td><td><strong>${escapeHtml(account.displayName)}</strong><br><small>${escapeHtml(account.username)}</small></td><td class="balance">${formatCoins(account.balance)}</td><td><small>${new Date(account.updatedAt).toLocaleString("zh-TW")}</small></td><td><div class="actions"><button class="coin-button secondary" data-id="${escapeHtml(account.id)}" data-name="${escapeHtml(account.displayName)}">調整金幣</button><button class="delete-button danger" data-id="${escapeHtml(account.id)}" data-name="${escapeHtml(account.displayName)}">刪除</button></div></td></tr>`).join("") || "<tr><td colspan=\"5\">尚無帳號</td></tr>";
  } catch (error) { adminMessage.textContent = error.message; }
}

$("#loginButton").addEventListener("click", async () => {
  loginMessage.textContent = "";
  try { await login({ username: $("#username").value, password: $("#password").value }); showAdmin(); await loadAccounts(); }
  catch (error) { loginMessage.textContent = error.message; }
});

$("#refreshButton").addEventListener("click", loadAccounts);
$("#accountsBody").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { id, name } = button.dataset;
  if (button.classList.contains("coin-button")) {
    const amount = window.prompt(`調整 ${name} 的織音幣\n輸入正數增加、負數扣除：`, "1000");
    if (amount === null) return;
    try { await accountRequest(`/api/admin/accounts/${encodeURIComponent(id)}/coins`, { method: "POST", body: JSON.stringify({ amount: Number(amount), reason: "admin_dashboard" }) }); await loadAccounts(); }
    catch (error) { adminMessage.textContent = error.message; }
  }
  if (button.classList.contains("delete-button")) {
    if (!window.confirm(`確定永久刪除「${name}」嗎？此操作無法復原。`)) return;
    try { await accountRequest(`/api/admin/accounts/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadAccounts(); }
    catch (error) { adminMessage.textContent = error.message; }
  }
});

restoreSession().then(async () => { if (currentAccount()) { showAdmin(); await loadAccounts(); } });
