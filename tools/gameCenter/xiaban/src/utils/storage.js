// 模块化重构：由 paper-theater-runner.html 拆出
// localStorage JSON 存取封装（游戏存档 / 设置 / 清档）
export function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
export function setJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
export function removeJSON(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}
