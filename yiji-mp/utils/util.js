// 通用工具：日期与金额格式化

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 年月，如 2026-09
function ym(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

// 年月日，如 2026-09-03
function ymd(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 友好显示：今天 / 昨天 / M月D日
function friendlyDate(s) {
  const t = new Date();
  const today = ymd(t);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = ymd(y);
  if (s === today) return '今天';
  if (s === yesterday) return '昨天';
  const p = s.split('-');
  if (p.length === 3) return p[1] + '月' + p[2] + '日';
  return s;
}

// 金额格式化：千分位 + 两位小数
function fmt(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { pad, ym, ymd, friendlyDate, fmt };
