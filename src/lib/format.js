/**
 * 展示格式化 —— 时间统一走这里，避免每处各写一遍 toLocaleString 导致格式不一。
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 2026-10-01 22:08 */
export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 2026-10-01 */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 相对时间：刚刚 / 3 分钟前 / 2 天前 / 具体日期 */
export function formatRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - Number(ts);
  if (diff < 0) return formatDateTime(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(ts);
}

/** 到期描述：永不 / 2026-10-01（还剩 3 天） */
export function formatExpiry(ts) {
  if (!ts) return '永久有效';
  const remain = Number(ts) - Date.now();
  if (remain <= 0) return `${formatDate(ts)}（已到期）`;
  const days = Math.ceil(remain / 86400000);
  return `${formatDate(ts)}（还剩 ${days} 天）`;
}
