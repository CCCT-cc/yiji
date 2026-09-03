// 一记 · 数据层（纯本地，wx.storage）
// 数据全部存于本机，不上传任何服务器。

const LEDGERS_KEY = 'yiji_ledgers_v1';
const CUR_KEY = 'yiji_cur_ledger_v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 结构默认值（非用户数据）：新建账本时带入，用户可随时增删改
const DEFAULT_CATEGORIES = [
  { id: 'c_food', name: '餐饮', icon: '🍜', type: 'expense' },
  { id: 'c_trans', name: '交通', icon: '🚌', type: 'expense' },
  { id: 'c_shop', name: '购物', icon: '🛍️', type: 'expense' },
  { id: 'c_fun', name: '娱乐', icon: '🎮', type: 'expense' },
  { id: 'c_home', name: '居家', icon: '🏠', type: 'expense' },
  { id: 'c_medical', name: '医疗', icon: '💊', type: 'expense' },
  { id: 'c_edu', name: '学习', icon: '📚', type: 'expense' },
  { id: 'c_other', name: '其他', icon: '📦', type: 'expense' },
  { id: 'c_salary', name: '工资', icon: '💰', type: 'income' },
  { id: 'c_redpacket', name: '红包', icon: '🧧', type: 'income' },
  { id: 'c_other_in', name: '其他收入', icon: '➕', type: 'income' }
];

const DEFAULT_ACCOUNTS = [
  { id: 'a_cash', name: '现金', icon: '💵', type: 'cash', initial: 0 },
  { id: 'a_card', name: '银行卡', icon: '💳', type: 'card', initial: 0 },
  { id: 'a_alipay', name: '支付宝', icon: '🔵', type: 'alipay', initial: 0 },
  { id: 'a_wechat', name: '微信钱包', icon: '🟢', type: 'wechat', initial: 0 }
];

const ACCOUNT_ICONS = ['💵', '💳', '🔵', '🟢', '🏦', '📱', '💰', '👛', '🪙', '💎'];
const CATEGORY_ICONS = ['🍜', '🚌', '🛍️', '🎮', '🏠', '💊', '📚', '📦', '💰', '🧧', '➕', '☕', '✈️', '🎁', '🐱', '⛽'];

function defaultLedger() {
  return {
    id: uid(),
    name: '默认账本',
    icon: '📒',
    accounts: DEFAULT_ACCOUNTS.map((a) => Object.assign({}, a)),
    categories: DEFAULT_CATEGORIES.map((c) => Object.assign({}, c)),
    transactions: [],
    budgets: {} // { '2026-09': 3000 }
  };
}

function readLedgers() {
  return wx.getStorageSync(LEDGERS_KEY) || [];
}

function writeLedgers(list) {
  wx.setStorageSync(LEDGERS_KEY, list);
}

function ensureInit() {
  let list = readLedgers();
  if (!list || list.length === 0) {
    list = [defaultLedger()];
    writeLedgers(list);
    wx.setStorageSync(CUR_KEY, list[0].id);
  } else {
    const cur = wx.getStorageSync(CUR_KEY);
    if (!cur || !list.find((l) => l.id === cur)) {
      wx.setStorageSync(CUR_KEY, list[0].id);
    }
  }
  return list;
}

function getLedgers() {
  return readLedgers();
}

function getCurrentLedger() {
  const list = readLedgers();
  const cur = wx.getStorageSync(CUR_KEY);
  return list.find((l) => l.id === cur) || list[0] || null;
}

function setCurrentLedger(id) {
  wx.setStorageSync(CUR_KEY, id);
}

function saveLedger(ledger) {
  const list = readLedgers();
  const i = list.findIndex((l) => l.id === ledger.id);
  if (i >= 0) list[i] = ledger;
  else list.push(ledger);
  writeLedgers(list);
  return ledger;
}

// 账户当前余额 = 初始余额 + 该账户所有交易
function accountBalance(ledger, accountId) {
  const acc = (ledger.accounts || []).find((a) => a.id === accountId);
  let bal = acc && typeof acc.initial === 'number' ? acc.initial : 0;
  (ledger.transactions || []).forEach((t) => {
    if (t.accountId === accountId) {
      bal += (t.type === 'income' ? 1 : -1) * (Number(t.amount) || 0);
    }
  });
  return bal;
}

function netWorth(ledger) {
  return (ledger.accounts || []).reduce((s, a) => s + accountBalance(ledger, a.id), 0);
}

// 指定年月的收支汇总
function monthSummary(ledger, ym) {
  let income = 0;
  let expense = 0;
  (ledger.transactions || []).forEach((t) => {
    if (t.date && t.date.indexOf(ym) === 0) {
      if (t.type === 'income') income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    }
  });
  return { income, expense };
}

// 指定年月的分类汇总（按 type）
function categoryStats(ledger, ym, type) {
  const map = {};
  (ledger.transactions || []).forEach((t) => {
    if (t.date && t.date.indexOf(ym) === 0 && t.type === type) {
      map[t.categoryId] = (map[t.categoryId] || 0) + (Number(t.amount) || 0);
    }
  });
  return map;
}

function addTransaction(ledger, t) {
  ledger.transactions = ledger.transactions || [];
  ledger.transactions.push({
    id: t.id || uid(),
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type,
    amount: Number(t.amount) || 0,
    date: t.date,
    note: t.note || ''
  });
  return saveLedger(ledger);
}

function removeTransaction(ledger, id) {
  ledger.transactions = (ledger.transactions || []).filter((t) => t.id !== id);
  return saveLedger(ledger);
}

function addAccount(ledger, a) {
  ledger.accounts = ledger.accounts || [];
  ledger.accounts.push({
    id: uid(),
    name: a.name,
    icon: a.icon || '💵',
    type: a.type || 'cash',
    initial: Number(a.initial) || 0
  });
  return saveLedger(ledger);
}

function updateAccount(ledger, id, patch) {
  const acc = (ledger.accounts || []).find((a) => a.id === id);
  if (acc) Object.assign(acc, patch);
  return saveLedger(ledger);
}

function removeAccount(ledger, id) {
  ledger.accounts = (ledger.accounts || []).filter((a) => a.id !== id);
  // 该账户下的交易一并移除
  ledger.transactions = (ledger.transactions || []).filter((t) => t.accountId !== id);
  return saveLedger(ledger);
}

function addCategory(ledger, c) {
  ledger.categories = ledger.categories || [];
  ledger.categories.push({
    id: uid(),
    name: c.name,
    icon: c.icon || '📦',
    type: c.type || 'expense'
  });
  return saveLedger(ledger);
}

function removeCategory(ledger, id) {
  ledger.categories = (ledger.categories || []).filter((c) => c.id !== id);
  return saveLedger(ledger);
}

function addLedger(name) {
  const l = defaultLedger();
  l.name = name || '新账本';
  l.accounts = [];
  l.categories = [];
  l.transactions = [];
  saveLedger(l);
  return l;
}

function updateLedger(id, patch) {
  const list = readLedgers();
  const l = list.find((x) => x.id === id);
  if (l) Object.assign(l, patch);
  writeLedgers(list);
  return l;
}

function removeLedger(id) {
  let list = readLedgers();
  if (list.length <= 1) return false; // 至少保留一个账本
  list = list.filter((l) => l.id !== id);
  writeLedgers(list);
  const cur = wx.getStorageSync(CUR_KEY);
  if (cur === id) wx.setStorageSync(CUR_KEY, list[0].id);
  return true;
}

function setBudget(ledger, ym, amount) {
  ledger.budgets = ledger.budgets || {};
  ledger.budgets[ym] = Number(amount) || 0;
  return saveLedger(ledger);
}

function exportCSV(ledger) {
  const catMap = {};
  (ledger.categories || []).forEach((c) => (catMap[c.id] = c.name));
  const accMap = {};
  (ledger.accounts || []).forEach((a) => (accMap[a.id] = a.name));
  const lines = ['日期,类型,账户,分类,金额,备注'];
  (ledger.transactions || [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((t) => {
      const row = [
        t.date,
        t.type === 'income' ? '收入' : '支出',
        accMap[t.accountId] || '',
        catMap[t.categoryId] || '',
        (Number(t.amount) || 0).toFixed(2),
        (t.note || '').replace(/,/g, '，')
      ];
      lines.push(row.join(','));
    });
  return lines.join('\n');
}

module.exports = {
  uid,
  ACCOUNT_ICONS,
  CATEGORY_ICONS,
  ensureInit,
  getLedgers,
  getCurrentLedger,
  setCurrentLedger,
  saveLedger,
  accountBalance,
  netWorth,
  monthSummary,
  categoryStats,
  addTransaction,
  removeTransaction,
  addAccount,
  updateAccount,
  removeAccount,
  addCategory,
  removeCategory,
  addLedger,
  updateLedger,
  removeLedger,
  setBudget,
  exportCSV
};
