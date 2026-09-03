/* ============================================================
   一记 · 极简记账  —  app.js
   纯前端 PWA：localStorage 持久化 / 离线可用 / 暗色模式
   数据模型与产品方案中的 8 表保持一致（对象数组 + 同步字段）
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const nowMs = () => Date.now();
  const DAY = 86400000;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const ymd = (d) => { d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => { const d = parseYmd(s); const t = new Date(); const today = ymd(t); const y = new Date(t.getTime() - DAY); const yd = ymd(y);
    if (s === today) return '今天'; if (s === yd) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
  const fmtDateFull = (s) => { const d = parseYmd(s); const w = '日一二三四五六'[d.getDay()]; return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + w; };

  const CUR = '¥';
  function money(n, { sign = false, dec = 2 } = {}) {
    const neg = n < 0; let v = Math.abs(n).toFixed(dec);
    const [i, f] = v.split('.');
    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let out = (dec ? ii + '.' + f : ii);
    if (neg) out = '-' + CUR + out; else if (sign) out = '+' + CUR + out; else out = CUR + out;
    return out;
  }
  const colorOf = (t) => (t === 'inc' ? 'inc' : t === 'transfer' ? 'accent' : 'exp');

  /* ---------- 存储层 ---------- */
  const KEY = 'yiji_db_v1';
  let DB = null;
  const deviceId = (() => { let d = localStorage.getItem('yiji_dev'); if (!d) { d = uid(); localStorage.setItem('yiji_dev', d); } return d; })();

  let autoRecovered = false; // 本次启动是否从自动备份自愈（根治 localStorage 偶发被清空）
  // 校验备份 JSON 是否为有效账本（至少含一个账本）
  function isValidBackup(json) {
    try { const o = JSON.parse(json); return !!(o && o.books && o.books.length); } catch (e) { return false; }
  }
  // 从备份找回账本：桌面版读 userData/backups 文件（独立于 localStorage，清档/重装也不丢）；网页版退化为 localStorage 滚动快照
  async function recoverFromBackup() {
    try {
      if (isElec() && window.electronAPI && window.electronAPI.readBackupFile) {
        const c = await window.electronAPI.readBackupFile('auto_latest.json');
        if (c && isValidBackup(c)) return c;
      }
      const web = localStorage.getItem('yiji_autobackup_v1');
      if (web && isValidBackup(web)) return web;
    } catch (e) { /* 自愈失败绝不阻断主流程 */ }
    return null;
  }
  // 自愈式加载：localStorage 读不到/为空/损坏时，先尝试从自动备份恢复，恢复成功写回 localStorage；
  // 只有在任何备份都没有（全新用户）时才 seed()，从根本上杜绝「间歇性被重置成空账本」
  async function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    let obj = null;
    try { obj = raw ? JSON.parse(raw) : null; } catch (e) { obj = null; }
    if (obj && obj.books && obj.books.length) { DB = obj; return DB; }
    const backup = await recoverFromBackup();
    if (backup) {
      try { DB = JSON.parse(backup); } catch (e) { DB = null; }
      if (DB && DB.books && DB.books.length) {
        autoRecovered = true;
        try { save(); } catch (e) { /* 回写失败也不影响本次恢复 */ }
        return DB;
      }
    }
    seed();
    return DB;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(DB)); autoBackup(); }

  /* ---------- 备份 / 导出 / 恢复（防数据丢失） ---------- */
  function isElec() { return !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron); }
  function dateStamp(d) { const x = d || new Date(); const p = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}_${p(x.getHours())}-${p(x.getMinutes())}`; }
  // 每次保存自动留底：桌面版写 userData/backups（清档删不到）；网页版退化为 localStorage 滚动快照
  function autoBackup() {
    try {
      const json = localStorage.getItem(KEY); if (!json) return;
      if (isElec() && window.electronAPI.saveBackupFile) {
        window.electronAPI.saveBackupFile('auto_latest.json', json).catch(() => {});
      } else {
        try { localStorage.setItem('yiji_autobackup_v1', json); } catch (e) { /* 容量超限忽略 */ }
      }
    } catch (e) { /* 备份失败绝不阻断主流程 */ }
  }
  function webDownload(json, fname) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    } catch (e) { toast('导出失败：' + e.message); }
  }
  function exportBackup() {
    const json = localStorage.getItem(KEY);
    if (!json) { toast('没有可导出的数据'); return; }
    const fname = `一记账本备份_${dateStamp()}.json`;
    if (isElec() && window.electronAPI.saveBackupFile) {
      window.electronAPI.saveBackupFile(fname, json).then(r => { if (r && r.ok) toast('已备份到本地：' + (r.path || fname)); }).catch(() => {});
    }
    webDownload(json, fname); // 同时下载一份到下载目录，方便另存到安全位置
  }
  function doImportJSON(text) {
    try {
      const remote = JSON.parse(text);
      if (!remote || !remote.books || !remote.books.length) throw new Error('不是有效的一记账本文件');
      DB = mergeDB(JSON.parse(JSON.stringify(DB)), remote);
      save(); toast('已从备份恢复（已合并到当前账本）'); nav('home');
    } catch (e) { toast('恢复失败：' + e.message); }
  }
  function importBackup() {
    if (isElec() && window.electronAPI.pickImportFile) {
      window.electronAPI.pickImportFile().then(content => { if (content) doImportJSON(content); }).catch(() => {});
      return;
    }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { if (inp.files[0]) { const fr = new FileReader(); fr.onload = () => doImportJSON(fr.result); fr.readAsText(inp.files[0]); } };
    inp.click();
  }
  function getBook() { return DB.books.find(b => b.id === DB.settings.book_id && !b.is_deleted) || DB.books.find(b => !b.is_deleted) || DB.books[0]; }
  function curBookId() { return getBook().id; }
  const accsOf = (bid) => DB.accounts.filter(a => !a.is_hidden && a.book_id === bid);
  function bookNetWorth(bid) { return accsOf(bid).reduce((s, a) => s + a.balance, 0); }
  function bookTxCount(bid) { return DB.transactions.filter(t => !t.is_deleted && t.book_id === bid).length; }

  function seed() {
    const bid = uid();
    DB = {
      books: [{ id: bid, name: '我的账本', icon: '📒', color: '#2f7d4f', currency: '¥', is_active: true, default_account_id: null,
        created_at: nowMs(), updated_at: nowMs(), sync_status: 'synced', is_deleted: 0, device_id: deviceId }],
      accounts: [], categories: [], transactions: [], budgets: [], tags: [], recurring: [], snapshots: [],
      settings: { book_id: bid, theme_mode: 'light', currency: '¥', app_lock_enabled: 0, default_account_id: null, created_at: nowMs(), updated_at: nowMs(), sync_status: 'synced', is_deleted: 0, device_id: deviceId }
    };
    save();
  }

  /* ---------- 数据操作 ---------- */
  let budgetMute = false; // 定期账单批量补记 / CSV 导入期间关闭逐笔预算提醒，避免刷屏
  function addTx(t) {
    const b = curBookId();
    t.id = uid(); t.book_id = b; t.is_deleted = 0; t.sync_status = 'pending';
    t.created_at = nowMs(); t.updated_at = nowMs(); t.device_id = deviceId;
    if (!t.transaction_date) t.transaction_date = ymd();
    DB.transactions.push(t);
    applyBalance(t, 1); save();
    if (!budgetMute) { const w = budgetWarn(t); if (w) setTimeout(() => toast(w), 320); }
  }
  function applyBalance(t, dir) {
    const amt = Math.abs(t.amount);
    const acc = (id) => DB.accounts.find(a => a.id === id);
    if (t.type === 'exp') { const a = acc(t.account_id); if (a) a.balance -= dir * amt; }
    else if (t.type === 'inc') { const a = acc(t.account_id); if (a) a.balance += dir * amt; }
    else if (t.type === 'transfer') { const f = acc(t.account_id), g = acc(t.to_account_id); if (f) f.balance -= dir * amt; if (g) g.balance += dir * amt; }
    DB.accounts.forEach(a => { a.updated_at = nowMs(); a.sync_status = 'pending'; });
  }
  function delTx(id) {
    const t = DB.transactions.find(x => x.id === id); if (!t) return;
    applyBalance(t, -1);
    t.is_deleted = 1; t.sync_status = 'pending'; t.updated_at = nowMs(); save();
  }
  function toggleFav(id) {
    const t = DB.transactions.find(x => x.id === id); if (!t) return;
    t.favorite = t.favorite ? 0 : 1; t.sync_status = 'pending'; t.updated_at = nowMs();
    if (t.favorite) { if (t.fav_amount == null) t.fav_amount = t.amount; if (t.fav_label == null) t.fav_label = ''; }
    else { t.fav_label = ''; t.fav_amount = null; }
    save();
    toast(t.favorite ? '已收藏到常用' : '已取消收藏');
    renderFlow(); if ($('#viewHome').hidden === false) renderHome();
  }
  function favList() { return liveTx().filter(t => t.favorite).slice(0, 8); }
  function updTx(id, patch) {
    const t = DB.transactions.find(x => x.id === id); if (!t) return;
    // 撤销旧余额影响
    applyBalance(t, -1);
    Object.assign(t, patch, { updated_at: nowMs(), sync_status: 'pending' });
    applyBalance(t, 1); save();
  }
  const liveTx = () => DB.transactions.filter(t => !t.is_deleted && t.book_id === curBookId());
  const cats = (type) => DB.categories.filter(c => !c.is_hidden && c.book_id === curBookId() && (!type || c.type === type));
  const catById = (id) => DB.categories.find(c => c.id === id);
  const accById = (id) => DB.accounts.find(a => a.id === id && !a.is_hidden);

  function netWorth() { return accsOf(curBookId()).reduce((s, a) => s + a.balance, 0); }
  function monthTx(dateStr) {
    const m = dateStr.slice(0, 7);
    return liveTx().filter(t => t.transaction_date.slice(0, 7) === m);
  }
  function periodSum(dateStr, type) {
    return monthTx(dateStr).filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
  }

  /* ---------- 定期账单（自动记账） ---------- */
  function nextDate(ds, freq) {
    const d = parseYmd(ds);
    if (freq === 'daily') return ymd(new Date(d.getTime() + DAY));
    if (freq === 'weekly') return ymd(new Date(d.getTime() + 7 * DAY));
    if (freq === 'monthly') { const dom = d.getDate(); let y = d.getFullYear(), m = d.getMonth() + 1; m++; if (m > 12) { m -= 12; y++; } const max = new Date(y, m, 0).getDate(); return ymd(new Date(y, m - 1, Math.min(dom, max))); }
    if (freq === 'yearly') return ymd(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
    return ds;
  }
  // 启动时为所有生效中的规则补记已到期（含过去遗漏）的账单
  function processRecurring() {
    const today = ymd(); let made = 0;
    budgetMute = true;
    DB.recurring.filter(r => !r.is_deleted && r.is_active && r.book_id === curBookId()).forEach(r => {
      if (!accById(r.account_id)) return;
      let guard = 0;
      while (r.next_execute_date <= today && guard < 500) {
        const cat = r.type === 'transfer' ? null : (catById(r.category_id) ? r.category_id : (cats(r.type)[0] ? cats(r.type)[0].id : null));
        addTx({ type: r.type, amount: r.amount, account_id: r.account_id, category_id: cat, to_account_id: null, note: (r.note || r.name) + '（定期）', transaction_date: r.next_execute_date });
        r.last_execute_date = r.next_execute_date;
        r.next_execute_date = nextDate(r.next_execute_date, r.frequency);
        r.updated_at = nowMs(); r.sync_status = 'pending';
        made++; guard++;
      }
    });
    budgetMute = false;
    if (made) { save(); const al = budgetAlerts(); if (al.length) setTimeout(() => toast('定期账单已记：' + al.join('、')), 600); }
    return made;
  }

  /* ---------- 弹层 / toast ---------- */
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 1600);
  }
  function openSheet(modal, html) {
    modal.innerHTML = '<div class="sheet">' + html + '</div>';
    modal.hidden = false;
    modal.onclick = (e) => { if (e.target === modal) closeSheet(modal); };
  }
  function closeSheet(modal) { modal.hidden = true; modal.innerHTML = ''; modal.onclick = null; }

  /* ---------- 顶部栏 / 导航 ---------- */
  const titles = { home: ['一记', '今天'], flow: ['流水', '按日浏览'], stats: ['统计', '收支洞察'], me: ['我的', '设置与数据'] };
  function setTop(view) { $('#topTitle').textContent = titles[view][0]; $('#topSub').textContent = titles[view][1]; }
  let curView = 'home';
  function nav(view) {
    curView = view;
    ['home', 'flow', 'stats', 'me'].forEach(v => { $('#view' + v[0].toUpperCase() + v.slice(1)).hidden = (v !== view); });
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.action === ('nav-' + view)));
    setTop(view);
    ({ home: renderHome, flow: renderFlow, stats: renderStats, me: renderMe })[view]();
    window.scrollTo(0, 0);
  }

  /* ============================================================
     首页
     ============================================================ */
  function renderHome() {
    const v = $('#viewHome'); const nw = netWorth();
    const inc = monthTx(ymd()).filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
    const exp = monthTx(ymd()).filter(t => t.type === 'exp' || t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
    const recent = liveTx().slice().sort((a, b) => (b.transaction_date + b.created_at).localeCompare(a.transaction_date + a.created_at)).slice(0, 8);
    const recHtml = recent.length ? recent.map(txRow).join('') : '<div class="empty"><div class="eb">🪙</div>还没有记录，点击中间的 ＋ 记一笔吧</div>';
    const accBreak = accsOf(curBookId()).slice().sort((x, y) => y.balance - x.balance);
    const breakHtml = accBreak.length ? `<div class="acc-break">${accBreak.map(a => `<div class="acc-row" data-go="accounts"><span class="ai">${a.icon}</span><span class="an">${a.name}</span><b class="mono ${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</b></div>`).join('')}</div>` : '';
    v.innerHTML =
      `<div class="balance-hero">
        <div class="lab">净资产合计（${getBook().name}）</div>
        <div class="big mono">${money(nw)}</div>
        <div class="tri">
          <div>本月收入<b class="mono">${money(inc)}</b></div>
          <div>本月支出<b class="mono">${money(exp)}</b></div>
          <div>结余<b class="mono">${money(inc - exp)}</b></div>
        </div>
        ${breakHtml}
      </div>
      ${budgetBanner()}
      ${(cats('exp').length === 0 && cats('inc').length === 0) ? `<div class="card" data-go="cats" style="cursor:pointer"><div class="list-row"><div class="ico" style="background:var(--brand-soft)">🏷️</div><div class="meta"><div class="t">还没有任何分类</div><div class="s">点此先建立你的支出 / 收入分类</div></div><span class="arrow">›</span></div></div>` : ''}
      ${accsOf(curBookId()).length === 0 ? `<div class="card" data-go="accounts" style="cursor:pointer"><div class="list-row"><div class="ico" style="background:var(--brand-soft)">🏦</div><div class="meta"><div class="t">还没有任何账户</div><div class="s">点此先添加你的现金 / 银行卡等</div></div><span class="arrow">›</span></div></div>` : ''}
      <div class="quick-grid">
        <button class="quick" data-action="open-rec"><span class="qi">➕</span>记一笔</button>
        <button class="quick" data-action="open-transfer"><span class="qi">🔁</span>转账</button>
        <button class="quick" data-action="nav-flow"><span class="qi">📜</span>流水</button>
        <button class="quick" data-action="nav-stats"><span class="qi">📊</span>统计</button>
      </div>
      ${recent.length ? `<div class="reuse-strip"><div class="rs-label">照上次再记一笔</div><div class="rs-row">${recent.slice(0, 6).map(t => { const c = catById(t.category_id); const nm = c ? c.name : (t.type === 'transfer' ? '转账' : '未分类'); const sign = t.type === 'inc' ? '+' : t.type === 'transfer' ? '' : '-'; return `<button class="reuse-chip" data-reuse="${t.id}"><span style="color:${c ? c.color : '#999'}">${c ? c.icon : '•'}</span>${nm}<b class="mono">${sign}${money(t.amount)}</b></button>`; }).join('')}</div></div>` : ''}
      ${favList().length ? `<div class="reuse-strip"><div class="rs-label">常用（点一下再记 · ✎ 可改名/改金额）</div><div class="rs-row">${favList().map(t => { const c = catById(t.category_id); const catName = c ? c.name : (t.type === 'transfer' ? '转账' : '未分类'); const nm = t.fav_label || catName; const amt = t.fav_amount != null ? Number(t.fav_amount) : t.amount; const sign = t.type === 'inc' ? '+' : t.type === 'transfer' ? '' : '-'; return `<div class="fav-item"><button class="reuse-chip fav" data-favreuse="${t.id}"><span style="color:${c ? c.color : '#999'}">${c ? c.icon : '•'}</span>${nm}<b class="mono">${sign}${money(amt)}</b></button><button class="fav-edit" data-favedit="${t.id}" title="改名 / 改金额">✎</button></div>`; }).join('')}</div></div>` : ''}
      <div class="card"><h3>最近记录</h3>${recHtml}</div>`;
    $$('[data-reuse]', v).forEach(b => b.onclick = () => reuseTx(b.dataset.reuse));
    $$('[data-favreuse]', v).forEach(b => b.onclick = () => reuseTx(b.dataset.favreuse));
    $$('[data-favedit]', v).forEach(b => b.onclick = (e) => { e.stopPropagation(); openFavEdit(b.dataset.favedit); });
    $$('[data-go]', v).forEach(b => b.onclick = () => meGo(b.dataset.go));
  }

  /* ============================================================
     流水（日历 + 分组列表 + 滑动）
     ============================================================ */
  let flowFilter = null; // 'YYYY-MM-DD' 或 null
  let flowSearch = '';  // 流水搜索关键字
  let flowType = 'all'; // 'all' | 'exp' | 'inc' | 'transfer'
  let calMonth = new Date();
  function renderFlow() {
    const v = $('#viewFlow');
    const types = [['all', '全部'], ['exp', '支出'], ['inc', '收入'], ['transfer', '转账']];
    v.innerHTML = `<div class="flow-tools">
      <input class="flow-search" id="flowSearch" placeholder="🔍 搜索备注 / 分类 / 金额" value="${flowSearch.replace(/"/g, '&quot;')}">
      <div class="ftype-chips">${types.map(([k, lab]) => `<button class="ftype ${flowType === k ? 'on' : ''}" data-ftype="${k}">${lab}</button>`).join('')}</div>
    </div>
    <div class="card" id="calCard"></div><div id="flowList"></div>`;
    $('#flowSearch', v).oninput = (e) => { flowSearch = e.target.value.trim(); renderFlowList(); };
    $$('[data-ftype]', v).forEach(b => b.onclick = () => { flowType = b.dataset.ftype; $$('[data-ftype]', v).forEach(x => x.classList.toggle('on', x === b)); renderFlowList(); });
    renderCalendar();
    renderFlowList();
  }
  function renderCalendar() {
    const card = $('#calCard'); if (!card) return;
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const txByDay = {};
    liveTx().forEach(t => { const k = t.transaction_date.slice(0, 7); if (k === ymd(new Date(y, m, 1)).slice(0, 7)) { txByDay[t.transaction_date] = (txByDay[t.transaction_date] || 0) + 1; } });
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<div></div>';
    const today = ymd();
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + pad(m + 1) + '-' + pad(d);
      const cls = ['cal-cell']; if (ds === today) cls.push('today'); if (ds === flowFilter) cls.push('sel');
      const dot = txByDay[ds] ? '<span class="dot"></span>' : '';
      cells += `<div class="${cls.join(' ')}" data-date="${ds}">${d}${dot}</div>`;
    }
    card.innerHTML = `<div class="cal-head"><button class="x" data-cal="-1>‹</button><span class="mon">${y}年${m + 1}月</span><button class="x" data-cal="1">›</button></div>
      <div class="cal-grid"><div class="wd">日</div><div class="wd">一</div><div class="wd">二</div><div class="wd">三</div><div class="wd">四</div><div class="wd">五</div><div class="wd">六</div>${cells}</div>`;
    $$('.cal-cell', card).forEach(c => c.onclick = () => { const d = c.dataset.date; flowFilter = (flowFilter === d ? null : d); renderFlowList(); $$('.cal-cell', card).forEach(x => x.classList.toggle('sel', x.dataset.date === flowFilter)); });
    $$('[data-cal]', card).forEach(b => b.onclick = () => { const step = Number(b.dataset.cal[0] === '-' ? -1 : 1); calMonth = new Date(y, m + step, 1); renderCalendar(); renderFlowList(); });
  }
  function renderFlowList() {
    const box = $('#flowList'); if (!box) return;
    let list = liveTx().slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at - a.created_at);
    if (flowFilter) list = list.filter(t => t.transaction_date === flowFilter);
    if (flowType !== 'all') list = list.filter(t => t.type === flowType);
    if (flowSearch) {
      const q = flowSearch.toLowerCase();
      list = list.filter(t => {
        const c = catById(t.category_id); const cn = c ? c.name : '';
        return (t.note && t.note.toLowerCase().includes(q)) || cn.toLowerCase().includes(q) || String(t.amount).includes(q);
      });
    }
    if (!list.length) { box.innerHTML = '<div class="empty"><div class="eb">🗒️</div>' + ((flowSearch || flowType !== 'all') ? '没有匹配的记录' : (flowFilter ? '这一天没有记录' : '暂无流水')) + '</div>'; return; }
    // 按日分组
    const groups = {};
    list.forEach(t => { (groups[t.transaction_date] = groups[t.transaction_date] || []).push(t); });
    let html = '';
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(day => {
      const arr = groups[day];
      const e = arr.filter(t => t.type !== 'inc').reduce((s, t) => s + t.amount, 0);
      const i = arr.filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
      html += `<div class="day-head"><span>${fmtDate(day)}</span><span>收 ${money(i)} · 支 ${money(e)}</span></div>`;
      html += arr.map(txRowSwipe).join('');
    });
    box.innerHTML = html;
    bindSwipe();
  }

  /* 普通行（首页/无滑动） */
  function txRow(t) {
    const c = catById(t.category_id); const a = accById(t.account_id);
    const sign = t.type === 'inc' ? '+' : t.type === 'transfer' ? '' : '-';
    const col = colorOf(t.type);
    const title = t.type === 'transfer' ? ('转账 → ' + (accById(t.to_account_id) || {}).name) : (c ? c.name : '未分类');
    const sub = (a ? a.name : '') + (t.note ? ' · ' + t.note : '');
    return `<div class="recent-item">
      <div class="ico" style="background:${c ? c.color + '22' : '#eee'};color:${c ? c.color : '#999'}">${c ? c.icon : '•'}</div>
      <div class="meta"><div class="t">${title}</div><div class="s">${sub}</div></div>
      <div class="${col} mono" style="font-weight:700">${sign}${money(t.amount)}</div>
    </div>`;
  }
  /* 可滑动行（流水） */
  function txRowSwipe(t) {
    const c = catById(t.category_id); const a = accById(t.account_id);
    const sign = t.type === 'inc' ? '+' : t.type === 'transfer' ? '' : '-';
    const col = colorOf(t.type);
    const title = t.type === 'transfer' ? ('转账 → ' + (accById(t.to_account_id) || {}).name) : (c ? c.name : '未分类');
    const sub = (a ? a.name : '') + (t.note ? ' · ' + t.note : '');
    return `<div class="tx-item" data-id="${t.id}">
      <div class="tx-bg"><div class="act edit" data-edit="${t.id}">编辑</div><div class="act del" data-del="${t.id}">删除</div></div>
      <div class="tx-fg">
        <div class="ico" style="background:${c ? c.color + '22' : '#eee'};color:${c ? c.color : '#999'}">${c ? c.icon : '•'}</div>
        <div class="meta"><div class="t">${title}</div><div class="s">${sub}</div></div>
        <button class="favbtn ${t.favorite ? 'on' : ''}" data-fav="${t.id}" title="收藏到常用">★</button>
        <div class="${col} mono" style="font-weight:700">${sign}${money(t.amount)}</div>
      </div>
    </div>`;
  }
  function bindSwipe() {
    $$('.tx-item').forEach(item => {
      const fg = $('.tx-fg', item); let sx = 0, dx = 0, open = false;
      fg.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; dx = 0; fg.style.transition = 'none'; }, { passive: true });
      fg.addEventListener('touchmove', (e) => { dx = e.touches[0].clientX - sx; if (!open && dx > 0) dx = 0; if (dx < -120) dx = -120; fg.style.transform = 'translateX(' + dx + 'px)'; }, { passive: true });
      fg.addEventListener('touchend', () => { fg.style.transition = 'transform .18s'; if (dx < -60) { fg.style.transform = 'translateX(-140px)'; open = true; } else { fg.style.transform = ''; open = false; } });
      const edit = $('.edit', item), del = $('.del', item), fav = $('.favbtn', item);
      if (edit) edit.onclick = () => openRec({ id: item.dataset.id });
      if (del) del.onclick = () => { if (confirm('确定删除这条记录？')) { delTx(item.dataset.id); toast('已删除'); renderFlow(); if ($('#viewHome').hidden === false) renderHome(); } };
      if (fav) fav.onclick = (e) => { e.stopPropagation(); toggleFav(item.dataset.id); };
    });
  }

  /* ============================================================
     统计（饼图 + 趋势线 + 预算）
     ============================================================ */
  let statRange = 'month'; // month | year
  function renderStats() {
    const v = $('#viewStats');
    const ref = statRange === 'month' ? ymd() : ymd().slice(0, 4) + '-01-01';
    let list, periodLabel;
    if (statRange === 'month') { list = monthTx(ymd()); periodLabel = '本月'; }
    else { const y = ymd().slice(0, 4); list = liveTx().filter(t => t.transaction_date.slice(0, 4) === y); periodLabel = y + '年'; }
    const inc = list.filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
    const exp = list.filter(t => t.type !== 'inc').reduce((s, t) => s + t.amount, 0);
    // 支出分类汇总
    const byCat = {};
    list.filter(t => t.type !== 'inc').forEach(t => { byCat[t.category_id] = (byCat[t.category_id] || 0) + t.amount; });
    const catArr = Object.keys(byCat).map(id => ({ c: catById(id), v: byCat[id] })).filter(x => x.c).sort((a, b) => b.v - a.v);
    const palette = ['#e8704a', '#2b6fe0', '#9b59b6', '#e8a33d', '#e0508a', '#d64545', '#16a3a3', '#8a8f99', '#2f9e57', '#1677ff'];
    const pie = catArr.length ? pieChart(catArr, palette) : '<div class="empty">本期暂无支出</div>';
    const legend = catArr.length ? '<div class="legend">' + catArr.map((x, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${x.c.name} ${money(x.v)}</span>`).join('') + '</div>' : '';
    // 趋势线
    const trend = trendLine(list, statRange);
    // 预算
    const bud = renderBudgets(list);
    v.innerHTML =
      `<div class="seg" style="display:flex">
        <button data-range="month" class="${statRange === 'month' ? 'on' : ''}">本月</button>
        <button data-range="year" class="${statRange === 'year' ? 'on' : ''}">本年</button>
      </div>
      <div class="stat-cards">
        <div class="c"><div class="l">${periodLabel}支出</div><div class="v exp">${money(exp)}</div></div>
        <div class="c"><div class="l">${periodLabel}收入</div><div class="v inc">${money(inc)}</div></div>
        <div class="c"><div class="l">结余</div><div class="v">${money(inc - exp)}</div></div>
      </div>
      <div class="card"><h3>支出构成</h3>${pie}${legend}</div>
      <div class="card"><h3>收支趋势</h3>${trend}</div>
      ${bud}`;
    $$('[data-range]', v).forEach(b => b.onclick = () => { statRange = b.dataset.range; renderStats(); });
  }
  function pieChart(arr, palette) {
    const total = arr.reduce((s, x) => s + x.v, 0); if (!total) return '';
    const R = 70, cx = 90, cy = 90, r = 54; let a0 = -Math.PI / 2, svg = '';
    arr.forEach((x, i) => {
      const ang = x.v / total * Math.PI * 2; const a1 = a0 + ang;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = ang > Math.PI ? 1 : 0;
      svg += `<path d="M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${palette[i % palette.length]}"></path>`;
      a0 = a1;
    });
    return `<svg viewBox="0 0 180 180" width="180" height="180" style="display:block;margin:6px auto">${svg}<circle cx="${cx}" cy="${cy}" r="${R - r + 8}" fill="var(--card)"></circle><text x="90" y="86" text-anchor="middle" font-size="13" fill="var(--sub)">总支出</text><text x="90" y="104" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${money(total)}</text></svg>`;
  }
  function trendLine(list, range) {
    // 按日聚合收/支
    const byDay = {};
    list.forEach(t => { const d = t.transaction_date; byDay[d] = byDay[d] || { inc: 0, exp: 0 }; if (t.type === 'inc') byDay[d].inc += t.amount; else byDay[d].exp += t.amount; });
    const keys = Object.keys(byDay).sort();
    if (!keys.length) return '<div class="empty">本期暂无数据</div>';
    const W = 320, H = 140, pl = 6, pr = 6, pt = 10, pb = 18;
    const max = Math.max(1, ...keys.map(k => Math.max(byDay[k].inc, byDay[k].exp)));
    const n = keys.length; const stepX = (W - pl - pr) / Math.max(1, n - 1);
    const yOf = (v) => H - pb - v / max * (H - pt - pb);
    const line = (key) => keys.map((k, i) => (i ? 'L' : 'M') + (pl + i * stepX).toFixed(1) + ' ' + yOf(byDay[k][key]).toFixed(1)).join(' ');
    const dots = (key) => keys.map((k, i) => `<circle cx="${(pl + i * stepX).toFixed(1)}" cy="${yOf(byDay[k][key]).toFixed(1)}" r="2.2" fill="${key === 'inc' ? 'var(--inc)' : 'var(--exp)'}"></circle>`).join('');
    const labels = keys.length > 1 ? `<text x="${pl}" y="${H - 4}" font-size="9" fill="var(--sub)">${keys[0].slice(5)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end" font-size="9" fill="var(--sub)">${keys[n - 1].slice(5)}</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      <path d="${line('inc')}" fill="none" stroke="var(--inc)" stroke-width="2"></path>
      <path d="${line('exp')}" fill="none" stroke="var(--exp)" stroke-width="2"></path>${dots('inc')}${dots('exp')}${labels}</svg>
      <div class="legend"><span><i style="background:var(--inc)"></i>收入</span><span><i style="background:var(--exp)"></i>支出</span></div>`;
  }
  function renderBudgets(list) {
    const bs = DB.budgets.filter(b => !b.is_deleted && b.book_id === curBookId());
    if (!bs.length) return '<div class="card"><h3>预算</h3><div class="muted">尚未设置预算，去「我的 → 预算」添加</div></div>';
    const ref = statRange === 'month' ? ymd() : ymd();
    const spent = {};
    list.filter(t => t.type !== 'inc').forEach(t => { spent[t.category_id] = (spent[t.category_id] || 0) + t.amount; });
    const rows = bs.map(b => {
      const c = catById(b.category_id); const used = spent[b.category_id] || 0;
      const pct = Math.min(100, Math.round(used / b.amount * 100));
      const over = used > b.amount;
      return `<div style="margin:10px 0">
        <div class="row"><span>${c ? c.icon + ' ' + c.name : '分类'}</span><span class="mono ${over ? 'exp' : ''}">${money(used)} / ${money(b.amount)}</span></div>
        <div style="height:8px;background:var(--bg);border-radius:6px;margin-top:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${over ? 'var(--exp)' : 'var(--brand)'}"></div></div>
      </div>`;
    }).join('');
    return `<div class="card"><h3>预算执行</h3>${rows}</div>`;
  }
  // 单笔记账后：判断该分类在本周期（月/年）的预算状态，返回提醒文案或 null
  function budgetWarn(t) {
    if (t.type !== 'exp' || !t.category_id) return null;
    const bk = curBookId();
    const budgets = DB.budgets.filter(b => !b.is_deleted && b.book_id === bk && b.category_id === t.category_id);
    if (!budgets.length) return null;
    const ds = t.transaction_date || ymd();
    const ym = ds.slice(0, 7), y = ds.slice(0, 4);
    const spentOf = (b) => liveTx().filter(x => x.type === 'exp' && x.category_id === b.category_id &&
      (b.period === 'year' ? x.transaction_date.slice(0, 4) === y : x.transaction_date.slice(0, 7) === ym)).reduce((s, x) => s + x.amount, 0);
    const msgs = [];
    budgets.forEach(b => {
      const c = catById(b.category_id); const used = spentOf(b);
      const pct = b.amount > 0 ? used / b.amount : 0; const th = b.warn_threshold || 80;
      if (pct > 1) msgs.push(`「${c ? c.name : '该分类'}」已超预算：${money(used)} / ${money(b.amount)}（超 ${money(used - b.amount)}）`);
      else if (pct >= th / 100) msgs.push(`「${c ? c.name : '该分类'}」预算预警 ${Math.round(pct * 100)}%，剩 ${money(b.amount - used)}`);
    });
    return msgs.length ? msgs.join('；') : null;
  }
  // 整账本预算汇总（用于定期账单批量补记后的总提醒）
  function budgetAlerts() {
    const bk = curBookId(); const ym = ymd().slice(0, 7), y = ymd().slice(0, 4);
    const out = [];
    DB.budgets.filter(b => !b.is_deleted && b.book_id === bk).forEach(b => {
      const c = catById(b.category_id);
      const used = liveTx().filter(x => x.type === 'exp' && x.category_id === b.category_id &&
        (b.period === 'year' ? x.transaction_date.slice(0, 4) === y : x.transaction_date.slice(0, 7) === ym)).reduce((s, x) => s + x.amount, 0);
      const pct = b.amount > 0 ? used / b.amount : 0;
      if (pct > 1) out.push(`「${c ? c.name : '该分类'}」已超预算 ${Math.round(pct * 100)}%`);
    });
    return out;
  }
  // 首页预算飘红横幅：超支(红)/临界(橙)，点一下进预算页
  function budgetBanner() {
    const bk = curBookId(); const ym = ymd().slice(0, 7), y = ymd().slice(0, 4);
    const items = [];
    DB.budgets.filter(b => !b.is_deleted && b.book_id === bk).forEach(b => {
      const c = catById(b.category_id);
      const used = liveTx().filter(x => x.type === 'exp' && x.category_id === b.category_id &&
        (b.period === 'year' ? x.transaction_date.slice(0, 4) === y : x.transaction_date.slice(0, 7) === ym)).reduce((s, x) => s + x.amount, 0);
      const pct = b.amount > 0 ? used / b.amount : 0; const th = b.warn_threshold || 80;
      if (pct > 1) items.push({ level: 'over', name: c ? c.name : '该分类', pct, used, amount: b.amount });
      else if (pct >= th / 100) items.push({ level: 'warn', name: c ? c.name : '该分类', pct, used, amount: b.amount });
    });
    if (!items.length) return '';
    items.sort((a, b) => b.pct - a.pct);
    const over = items.filter(i => i.level === 'over').length;
    const warn = items.filter(i => i.level === 'warn').length;
    const head = over ? `有 ${over} 个分类已超预算` : `有 ${warn} 个分类接近预算上限`;
    const tail = over && warn ? `，${warn} 个临界` : '';
    const sub = items.slice(0, 3).map(i => `${i.name} ${Math.round(i.pct * 100)}%（${money(i.used)}/${money(i.amount)}）`).join(' · ') + (items.length > 3 ? ' …' : '');
    return `<div class="budget-banner ${over ? 'over' : 'warn'}" data-go="budgets">
      <div class="bb-ico">${over ? '⚠️' : '🔔'}</div>
      <div class="bb-main"><div class="bb-t">${head}${tail}</div><div class="bb-s">${sub}</div></div>
      <span class="arrow">›</span>
    </div>`;
  }

  /* ============================================================
      我的
      ============================================================ */
  function renderMe() {
    const v = $('#viewMe'); const s = DB.settings;
    const themeOn = s.theme_mode === 'dark';
    v.innerHTML =
      `<div class="card" id="bookCard">
        <div class="list-row" id="bookRow" data-go="books"><div class="ico" style="background:var(--brand-soft)">📚</div><div class="meta"><div class="t">账本</div><div class="s">${getBook().name} · ${DB.books.filter(b => !b.is_deleted).length} 本 · 点此切换/新建</div></div><span class="arrow">›</span></div>
      </div>
      <div class="card">
        <div class="list-row" data-go="accounts"><div class="ico" style="background:var(--brand-soft)">🏦</div><div class="meta"><div class="t">账户管理</div><div class="s">${accsOf(curBookId()).length} 个账户</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="cats"><div class="ico" style="background:var(--brand-soft)">🏷️</div><div class="meta"><div class="t">分类管理</div><div class="s">${cats().length} 个分类</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="budgets"><div class="ico" style="background:var(--brand-soft)">🎯</div><div class="meta"><div class="t">预算</div><div class="s">${DB.budgets.filter(b => !b.is_deleted && b.book_id === curBookId()).length} 条</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="tags"><div class="ico" style="background:var(--brand-soft)">🔖</div><div class="meta"><div class="t">标签</div><div class="s">${DB.tags.filter(t => !t.is_deleted && t.book_id === curBookId()).length} 个</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="recurring"><div class="ico" style="background:var(--brand-soft)">🔁</div><div class="meta"><div class="t">定期账单</div><div class="s">${DB.recurring.filter(r => !r.is_deleted && r.is_active && r.book_id === curBookId()).length} 条生效中</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="assets"><div class="ico" style="background:var(--brand-soft)">💼</div><div class="meta"><div class="t">资产总览</div><div class="s">净资产 ${money(netWorth())}</div></div><span class="arrow">›</span></div>
      </div>
      <div class="card">
        <div class="list-row" id="themeRow"><div class="ico" style="background:var(--brand-soft)">🌙</div><div class="meta"><div class="t">深色模式</div></div><span class="chip ${themeOn ? 'on' : ''}" id="themeChip">${themeOn ? '已开' : '关闭'}</span></div>
        <div class="list-row" data-go="lock"><div class="ico" style="background:var(--brand-soft)">🔒</div><div class="meta"><div class="t">应用锁</div><div class="s">${DB.settings.app_lock_enabled ? '已开启' : '未开启'}</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="export"><div class="ico" style="background:var(--brand-soft)">📤</div><div class="meta"><div class="t">导出数据（CSV）</div><div class="s">备份到本地文件</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="import"><div class="ico" style="background:var(--brand-soft)">📥</div><div class="meta"><div class="t">导入数据（CSV）</div><div class="s">从文件恢复</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="backup"><div class="ico" style="background:var(--brand-soft)">💾</div><div class="meta"><div class="t">完整备份（JSON）</div><div class="s">导出全部账本为文件，最稳妥</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="restore"><div class="ico" style="background:var(--brand-soft)">♻️</div><div class="meta"><div class="t">从备份恢复（JSON）</div><div class="s">合并回当前账本</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="sync"><div class="ico" style="background:var(--brand-soft)">☁️</div><div class="meta"><div class="t">数据同步</div><div class="s">${DB.settings.last_sync_at ? '上次 ' + new Date(DB.settings.last_sync_at).toLocaleString() : 'WebDAV 未配置'}</div></div><span class="arrow">›</span></div>
        <div class="list-row" data-go="voice"><div class="ico" style="background:var(--brand-soft)">🎤</div><div class="meta"><div class="t">语音记账</div><div class="s">说一句自动记一笔</div></div><span class="arrow">›</span></div>
      </div>
      <div class="section-title">数据与隐私</div>
      <button class="btn ghost" data-go="about">关于一记</button>
      <button class="btn danger" data-go="reset">清空全部数据</button>`;
    $('#themeRow').onclick = () => { const on = DB.settings.theme_mode !== 'dark'; DB.settings.theme_mode = on ? 'dark' : 'light'; applyTheme(); save(); renderMe(); };
    $$('[data-go]', v).forEach(r => r.onclick = () => meGo(r.dataset.go));
  }
  function meGo(go) {
    if (go === 'books') return openBooks();
    if (go === 'accounts') return openAccounts();
    if (go === 'cats') return openCats();
    if (go === 'budgets') return openBudgets();
    if (go === 'tags') return openTags();
    if (go === 'recurring') return openRecurring();
    if (go === 'assets') return openAssets();
    if (go === 'lock') return openLock();
    if (go === 'export') return exportCSV();
    if (go === 'import') return importCSV();
    if (go === 'backup') return exportBackup();
    if (go === 'restore') return importBackup();
    if (go === 'sync') return openSync();
    if (go === 'voice') return openVoice();
    if (go === 'about') return openAbout();
    if (go === 'reset') return doReset();
  }
  /* ---------- 账本（多账本切换） ---------- */
  const BOOK_ICONS = ['📒', '🏠', '✈️', '💑', '🐱', '🚗', '🍽️', '🎓', '💼', '🌟'];
  const BOOK_COLORS = ['#2f7d4f', '#2b6fe0', '#e8704a', '#9b59b6', '#e8a33d', '#16a3a3', '#e0508a', '#d64545', '#1677ff', '#8a8f99'];
  function switchBook(id) {
    if (!DB.books.find(b => b.id === id && !b.is_deleted)) return;
    DB.settings.book_id = id; save();
    renderHome(); renderFlow(); renderStats(); renderMe();
    toast('已切换到「' + getBook().name + '」');
  }
  function openBooks() {
    const list = DB.books.filter(b => !b.is_deleted);
    const rows = list.map(b => {
      const active = b.id === curBookId();
      return `<div class="list-row book-row ${active ? 'on' : ''}" data-book="${b.id}" style="cursor:pointer">
        <div class="ico" style="background:${b.color}22;color:${b.color}">${b.icon}</div>
        <div class="meta"><div class="t">${b.name}</div><div class="s">${active ? '当前 · ' : ''}净资产 ${money(bookNetWorth(b.id))} · ${bookTxCount(b.id)} 笔</div></div>
        ${list.length > 1 ? `<button data-delbook="${b.id}" style="margin-left:auto;font-size:16px;border:none;background:none;color:var(--muted);cursor:pointer;padding:6px 8px">🗑</button>` : ''}
      </div>`;
    }).join('');
    openSheet($('#formModal'), `<h3>账本管理 <button class="x" data-close>×</button></h3>
      <div class="muted" style="margin-bottom:8px;font-size:13px">每本账本拥有独立的账户、分类与流水，互不干扰。</div>
      ${rows}
      <button class="btn" id="addBook" style="margin-top:10px">＋ 新建账本</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-book]', $('#formModal')).forEach(r => r.onclick = (e) => { if (e.target.closest('[data-delbook]')) return; closeSheet($('#formModal')); switchBook(r.dataset.book); });
    $$('[data-delbook]', $('#formModal')).forEach(b => b.onclick = (e) => { e.stopPropagation(); delBook(b.dataset.delbook); });
    $('#addBook', $('#formModal')).onclick = () => newBook();
  }
  function newBook() {
    let icon = BOOK_ICONS[0], color = BOOK_COLORS[0];
    openSheet($('#formModal'), `<h3>新建账本 <button class="x" data-close>×</button></h3>
      <div class="lbl">名称</div><input class="field" id="bk_name" placeholder="如 家庭账本 / 旅行账本">
      <div class="lbl">图标</div><div class="cat-grid" id="bk_icons">${BOOK_ICONS.map(i => `<div class="cat-cell" data-i="${i}" style="${i === icon ? 'border-color:var(--brand);background:var(--brand-soft)' : ''}"><div class="ci" style="background:var(--bg)">${i}</div></div>`).join('')}</div>
      <div class="lbl">颜色</div><div class="cat-grid" id="bk_colors">${BOOK_COLORS.map(col => `<div class="cat-cell" data-col="${col}" style="${col === color ? 'border-color:var(--brand)' : ''}"><div class="ci" style="background:${col}22;color:${col}">●</div></div>`).join('')}</div>
      <div class="form-actions"><button class="btn" id="bk_save" style="flex:1">创建并进入</button></div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-i]', $('#formModal')).forEach(b => b.onclick = () => { icon = b.dataset.i; $$('[data-i]', $('#formModal')).forEach(x => x.style.borderColor = x === b ? 'var(--brand)' : 'transparent'); b.style.background = 'var(--brand-soft)'; });
    $$('[data-col]', $('#formModal')).forEach(b => b.onclick = () => { color = b.dataset.col; $$('[data-col]', $('#formModal')).forEach(x => x.style.borderColor = 'transparent'); b.style.borderColor = 'var(--brand)'; });
    $('#bk_save', $('#formModal')).onclick = () => {
      const nm = $('#bk_name', $('#formModal')).value.trim(); if (!nm) return toast('请填写账本名称');
      createBook(nm, icon, color);
    };
  }
  function createBook(name, icon, color) {
    const bid = uid();
    DB.books.push({ id: bid, name, icon, color, currency: '¥', is_active: true, default_account_id: null, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId });
    const A = (n, type, ic, col, bal) => DB.accounts.push({ id: uid(), book_id: bid, name: n, type, icon: ic, color: col, initial_balance: bal, balance: bal, credit_limit: 0, bill_day: 1, repayment_day: 10, sort_order: DB.accounts.length, is_hidden: 0, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId });
    A('现金', 'cash', '💵', '#3a9d63', 0);
    const C = (n, type, ic, col) => DB.categories.push({ id: uid(), book_id: bid, name: n, type, icon: ic, color: col, parent_id: null, sort_order: DB.categories.length, is_hidden: 0, is_system: 1, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId });
    C('餐饮', 'exp', '🍜', '#e8704a'); C('交通', 'exp', '🚌', '#2b6fe0'); C('购物', 'exp', '🛍️', '#9b59b6');
    C('居住', 'exp', '🏠', '#e8a33d'); C('娱乐', 'exp', '🎮', '#e0508a'); C('医疗', 'exp', '💊', '#d64545');
    C('通讯', 'exp', '📱', '#16a3a3'); C('其他', 'exp', '📦', '#8a8f99');
    C('工资', 'inc', '💰', '#2f9e57'); C('红包', 'inc', '🧧', '#ef6b6b'); C('理财', 'inc', '📈', '#1677ff');
    C('其他收入', 'inc', '✨', '#9b59b6');
    const nb = DB.books.find(x => x.id === bid); nb.default_account_id = DB.accounts.find(a => a.book_id === bid && a.name === '现金').id;
    save(); closeSheet($('#formModal')); switchBook(bid);
  }
  function delBook(id) {
    const b = DB.books.find(x => x.id === id); if (!b) return;
    if (DB.books.filter(x => !x.is_deleted).length <= 1) { toast('至少保留一个账本'); return; }
    if (!confirm('删除账本「' + b.name + '」？其下所有账户、分类、流水将一并删除，且不可恢复。')) return;
    DB.books = DB.books.filter(x => x.id !== id);
    DB.accounts = DB.accounts.filter(a => a.book_id !== id);
    DB.categories = DB.categories.filter(c => c.book_id !== id);
    DB.transactions = DB.transactions.filter(t => t.book_id !== id);
    DB.budgets = DB.budgets.filter(x => x.book_id !== id);
    DB.tags = DB.tags.filter(t => t.book_id !== id);
    DB.recurring = DB.recurring.filter(r => r.book_id !== id);
    if (DB.settings.book_id === id) DB.settings.book_id = DB.books.find(x => !x.is_deleted).id;
    save(); openBooks(); renderHome(); renderFlow(); renderStats(); renderMe();
    toast('已删除「' + b.name + '」');
  }
  function applyTheme() { document.documentElement.setAttribute('data-theme', DB.settings.theme_mode === 'dark' ? 'dark' : 'light'); }

  /* ---------- 账户管理 ---------- */
  function openAccounts() {
    const list = accsOf(curBookId()).sort((x, y) => x.sort_order - y.sort_order);
    const rows = list.map(a => `<div class="list-row" data-acc="${a.id}"><div class="ico" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
      <div class="meta"><div class="t">${a.name}</div><div class="s">${typeName(a.type)}</div></div>
      <div class="mono" style="font-weight:700">${money(a.balance)}</div></div>`).join('') || '<div class="empty">还没有账户</div>';
    openSheet($('#formModal'), `<h3>账户管理 <button class="x" data-close>×</button></h3>${rows}
      <button class="btn" id="addAcc">＋ 添加账户</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-acc]', $('#formModal')).forEach(r => r.onclick = () => editAccount(r.dataset.acc));
    $('#addAcc', $('#formModal')).onclick = () => editAccount(null);
  }
  const typeName = (t) => ({ cash: '现金', bank: '银行卡', wallet: '电子钱包', credit: '信用卡', invest: '投资账户' }[t] || t);
  function editAccount(id) {
    const a = id ? DB.accounts.find(x => x.id === id) : null;
    openSheet($('#formModal'), `<h3>${a ? '编辑账户' : '添加账户'} <button class="x" data-close>×</button></h3>
      <div class="lbl">名称</div><input class="field" id="f_name" value="${a ? a.name : ''}" placeholder="如 现金 / 工资卡">
      <div class="lbl">类型</div>
      <div class="seg" style="display:flex;flex-wrap:wrap" id="f_types">
        ${['cash', 'bank', 'wallet', 'credit', 'invest'].map(t => `<button data-t="${t}" class="${a && a.type === t ? 'on' : ''}">${typeName(t)}</button>`).join('')}
      </div>
      <div class="lbl">当前余额（${CUR}）</div><input class="field" id="f_bal" type="number" inputmode="decimal" value="${a ? a.balance : 0}">
      <div class="form-actions">
        ${a ? '<button class="btn danger" id="f_del" style="flex:1">删除</button>' : ''}
        <button class="btn" id="f_save" style="flex:2">保存</button>
      </div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    let typ = a ? a.type : 'cash';
    $$('[data-t]', $('#formModal')).forEach(b => b.onclick = () => { typ = b.dataset.t; $$('[data-t]', $('#formModal')).forEach(x => x.classList.toggle('on', x === b)); });
    $('#f_save', $('#formModal')).onclick = () => {
      const name = $('#f_name', $('#formModal')).value.trim(); if (!name) return toast('请填写名称');
      const bal = parseFloat($('#f_bal', $('#formModal')).value) || 0;
      if (a) { const diff = bal - a.balance; a.name = name; a.type = typ; a.balance = bal; a.updated_at = nowMs(); a.sync_status = 'pending'; }
      else { DB.accounts.push({ id: uid(), book_id: curBookId(), name, type: typ, icon: '💳', color: '#2f7d4f', initial_balance: bal, balance: bal, credit_limit: 0, bill_day: 1, repayment_day: 10, sort_order: DB.accounts.length, is_hidden: 0, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId }); }
      save(); closeSheet($('#formModal')); openAccounts(); renderHome();
    };
    if (a) $('#f_del', $('#formModal')).onclick = () => { if (confirm('删除账户？相关记录会保留但归为「未知」')) { a.is_hidden = 1; a.is_deleted = 1; a.sync_status = 'pending'; save(); closeSheet($('#formModal')); openAccounts(); } };
  }

  /* ---------- 分类管理 ---------- */
  function openCats() {
    const exp = cats('exp'), inc = cats('inc');
    const cell = (c) => `<div class="cat-cell" data-cat="${c.id}" style="border-color:${c.color}33"><div class="ci" style="background:${c.color}22;color:${c.color}">${c.icon}</div>${c.name}</div>`;
    openSheet($('#formModal'), `<h3>分类管理 <button class="x" data-close>×</button></h3>
      <div class="section-title">支出</div><div class="cat-grid">${exp.map(cell).join('')}</div>
      <div class="section-title">收入</div><div class="cat-grid">${inc.map(cell).join('')}</div>
      <button class="btn" id="addCat">＋ 添加分类</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-cat]', $('#formModal')).forEach(r => r.onclick = () => editCat(r.dataset.cat));
    $('#addCat', $('#formModal')).onclick = () => editCat(null);
  }
  const ICONS = ['🍜', '🚌', '🛍️', '🏠', '🎮', '💊', '📱', '📦', '💰', '🧧', '📈', '✨', '☕', '🍺', '✈️', '🎁', '📚', '💡', '🐱', '🚗'];
  const CATCOLORS = ['#e8704a', '#2b6fe0', '#9b59b6', '#e8a33d', '#e0508a', '#d64545', '#16a3a3', '#2f9e57', '#1677ff', '#8a8f99'];
  function editCat(id) {
    const c = id ? catById(id) : null;
    openSheet($('#formModal'), `<h3>${c ? '编辑分类' : '添加分类'} <button class="x" data-close>×</button></h3>
      <div class="lbl">类型</div>
      <div class="seg" style="display:flex" id="c_types">
        <button data-t="exp" class="${c && c.type === 'exp' ? 'on' : ''}">支出</button>
        <button data-t="inc" class="${c && c.type === 'inc' ? 'on' : ''}">收入</button>
      </div>
      <div class="lbl">名称</div><input class="field" id="c_name" value="${c ? c.name : ''}" placeholder="分类名称">
      <div class="lbl">图标</div><div class="cat-grid" id="c_icons">${ICONS.map(i => `<div class="cat-cell" data-i="${i}" style="${c && c.icon === i ? 'border-color:var(--brand);background:var(--brand-soft)' : ''}"><div class="ci" style="background:var(--bg)">${i}</div></div>`).join('')}</div>
      <div class="lbl">颜色</div><div class="cat-grid" id="c_colors">${CATCOLORS.map(col => `<div class="cat-cell" data-col="${col}" style="${c && c.color === col ? 'border-color:var(--brand)' : ''}"><div class="ci" style="background:${col}22;color:${col}">●</div></div>`).join('')}</div>
      <div class="form-actions">
        ${c && !c.is_system ? '<button class="btn danger" id="c_del" style="flex:1">删除</button>' : ''}
        <button class="btn" id="c_save" style="flex:2">保存</button>
      </div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    let typ = c ? c.type : 'exp', icon = c ? c.icon : ICONS[0], color = c ? c.color : CATCOLORS[0];
    $$('[data-t]', $('#formModal')).forEach(b => b.onclick = () => { typ = b.dataset.t; $$('[data-t]', $('#formModal')).forEach(x => x.classList.toggle('on', x === b)); });
    $$('[data-i]', $('#formModal')).forEach(b => b.onclick = () => { icon = b.dataset.i; $$('[data-i]', $('#formModal')).forEach(x => x.style.borderColor = x === b ? 'var(--brand)' : 'transparent'); b.style.background = 'var(--brand-soft)'; });
    $$('[data-col]', $('#formModal')).forEach(b => b.onclick = () => { color = b.dataset.col; $$('[data-col]', $('#formModal')).forEach(x => x.style.borderColor = 'transparent'); b.style.borderColor = 'var(--brand)'; });
    $('#c_save', $('#formModal')).onclick = () => {
      const name = $('#c_name', $('#formModal')).value.trim(); if (!name) return toast('请填写名称');
      if (c) { c.name = name; c.type = typ; c.icon = icon; c.color = color; c.updated_at = nowMs(); c.sync_status = 'pending'; }
      else { DB.categories.push({ id: uid(), book_id: curBookId(), name, type: typ, icon, color, parent_id: null, sort_order: DB.categories.length, is_hidden: 0, is_system: 0, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId }); }
      save(); closeSheet($('#formModal')); openCats(); renderMe();
    };
    if (c && !c.is_system) $('#c_del', $('#formModal')).onclick = () => { if (confirm('删除分类？已用该分类的记录将变为「未分类」')) { c.is_hidden = 1; c.is_deleted = 1; c.sync_status = 'pending'; save(); closeSheet($('#formModal')); openCats(); renderMe(); } };
  }

  /* ---------- 预算 ---------- */
  function openBudgets() {
    const list = DB.budgets.filter(b => !b.is_deleted && b.book_id === curBookId());
    const rows = list.length ? list.map(b => { const c = catById(b.category_id); return `<div class="list-row" data-b="${b.id}"><div class="ico" style="background:${(c ? c.color : '#999')}22;color:${c ? c.color : '#999'}">${c ? c.icon : '🎯'}</div><div class="meta"><div class="t">${c ? c.name : '分类'}（${b.period === 'month' ? '月度' : '年度'}）</div></div><div class="mono">${money(b.amount)}</div></div>`; }).join('') : '<div class="empty">还没有预算</div>';
    openSheet($('#formModal'), `<h3>预算 <button class="x" data-close>×</button></h3>${rows}<button class="btn" id="addB">＋ 添加预算</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-b]', $('#formModal')).forEach(r => r.onclick = () => editBudget(r.dataset.b));
    $('#addB', $('#formModal')).onclick = () => editBudget(null);
  }
  function editBudget(id) {
    const b = id ? DB.budgets.find(x => x.id === id) : null;
    const opts = cats('exp').map(c => `<option value="${c.id}" ${b && b.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
    openSheet($('#formModal'), `<h3>${b ? '编辑预算' : '添加预算'} <button class="x" data-close>×</button></h3>
      <div class="lbl">分类（仅支出）</div><select class="field" id="b_cat">${opts}</select>
      <div class="lbl">周期</div>
      <div class="seg" style="display:flex" id="b_per"><button data-p="month" class="${!b || b.period === 'month' ? 'on' : ''}">月度</button><button data-p="year" class="${b && b.period === 'year' ? 'on' : ''}">年度</button></div>
      <div class="lbl">金额（${CUR}）</div><input class="field" id="b_amt" type="number" inputmode="decimal" value="${b ? b.amount : ''}" placeholder="如 2000">
      <div class="form-actions">
        ${b ? '<button class="btn danger" id="b_del" style="flex:1">删除</button>' : ''}
        <button class="btn" id="b_save" style="flex:2">保存</button>
      </div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    let per = b ? b.period : 'month';
    $$('[data-p]', $('#formModal')).forEach(x => x.onclick = () => { per = x.dataset.p; $$('[data-p]', $('#formModal')).forEach(z => z.classList.toggle('on', z === x)); });
    $('#b_save', $('#formModal')).onclick = () => {
      const cat = $('#b_cat', $('#formModal')).value; const amt = parseFloat($('#b_amt', $('#formModal')).value);
      if (!cat || !amt || amt <= 0) return toast('请完善信息');
      if (b) { b.category_id = cat; b.period = per; b.amount = amt; b.updated_at = nowMs(); b.sync_status = 'pending'; }
      else { DB.budgets.push({ id: uid(), book_id: curBookId(), category_id: cat, period: per, amount: amt, warn_threshold: 80, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId }); }
      save(); closeSheet($('#formModal')); openBudgets(); renderStats();
    };
    if (b) $('#b_del', $('#formModal')).onclick = () => { b.is_deleted = 1; b.sync_status = 'pending'; save(); closeSheet($('#formModal')); openBudgets(); renderStats(); };
  }

  /* ---------- 标签 ---------- */
  function openTags() {
    const list = DB.tags.filter(t => !t.is_deleted && t.book_id === curBookId());
    const chips = list.length ? list.map(t => `<span class="chip" data-tag="${t.id}" style="${t.color ? 'background:' + t.color + '22;color:' + t.color : ''}">${t.name} ✕</span>`).join('') : '<div class="empty">还没有标签</div>';
    openSheet($('#formModal'), `<h3>标签 <button class="x" data-close>×</button></h3><div style="margin:8px 0">${chips}</div>
      <div class="lbl">名称</div><input class="field" id="t_name" placeholder="如 必要 / 可选"><button class="btn" id="t_add">＋ 添加</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-tag]', $('#formModal')).forEach(r => r.onclick = () => { const t = DB.tags.find(x => x.id === r.dataset.tag); if (t) { t.is_deleted = 1; save(); openTags(); } });
    $('#t_add', $('#formModal')).onclick = () => { const n = $('#t_name', $('#formModal')).value.trim(); if (!n) return toast('请填写名称'); DB.tags.push({ id: uid(), book_id: curBookId(), name: n, color: CATCOLORS[DB.tags.length % CATCOLORS.length], created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId }); save(); openTags(); };
  }

  /* ---------- 定期账单 ---------- */
  function freqName(f) { return { daily: '每日', weekly: '每周', monthly: '每月', yearly: '每年' }[f] || f; }
  function openRecurring() {
    const list = DB.recurring.filter(r => !r.is_deleted && r.book_id === curBookId()).sort((a, b) => a.next_execute_date.localeCompare(b.next_execute_date));
    const rows = list.length ? list.map(r => {
      const c = catById(r.category_id); const a = accById(r.account_id); const col = r.type === 'inc' ? 'inc' : 'exp';
      return `<div class="list-row" data-r="${r.id}" style="${r.is_active ? '' : 'opacity:.45'}">
        <div class="ico" style="background:${(c ? c.color : '#999') + '22'};color:${c ? c.color : '#999'}">${c ? c.icon : (r.type === 'inc' ? '💰' : '🔁')}</div>
        <div class="meta"><div class="t">${r.name} <span class="muted">· ${freqName(r.frequency)}</span></div><div class="s">${a ? a.name : '账户'} · 下次 ${fmtDate(r.next_execute_date)}</div></div>
        <div class="${col} mono" style="font-weight:700">${r.type === 'inc' ? '+' : '-'}${money(r.amount)}</div></div>`;
    }).join('') : '<div class="empty">还没有定期账单</div>';
    openSheet($('#formModal'), `<h3>定期账单 <button class="x" data-close>×</button></h3>
      <div class="muted">设置后，每次打开应用会自动补记已到期的账单（如工资、房租、订阅），过去遗漏的也会一次性补齐。</div>
      ${rows}
      <button class="btn" id="addR">＋ 添加定期账单</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-r]', $('#formModal')).forEach(x => x.onclick = () => editRecurring(x.dataset.r));
    $('#addR', $('#formModal')).onclick = () => editRecurring(null);
  }
  function editRecurring(id) {
    const r = id ? DB.recurring.find(x => x.id === id) : null;
    const rType = r ? r.type : 'exp';
    const catOpts = cats(rType).map(c => `<option value="${c.id}" ${r && r.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
    const accOpts = accsOf(curBookId()).map(a => `<option value="${a.id}" ${r && r.account_id === a.id ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('');
    openSheet($('#formModal'), `<h3>${r ? '编辑定期账单' : '添加定期账单'} <button class="x" data-close>×</button></h3>
      <div class="lbl">名称</div><input class="field" id="r_name" value="${r ? r.name : ''}" placeholder="如 每月工资 / 房租 / 视频会员">
      <div class="lbl">类型</div>
      <div class="seg" style="display:flex" id="r_types">
        <button data-t="exp" class="${!r || r.type === 'exp' ? 'on' : ''}">支出</button>
        <button data-t="inc" class="${r && r.type === 'inc' ? 'on' : ''}">收入</button>
      </div>
      <div class="lbl">金额（${CUR}）</div><input class="field" id="r_amt" type="number" inputmode="decimal" value="${r ? r.amount : ''}" placeholder="如 5000">
      <div class="lbl">分类</div><select class="field" id="r_cat">${catOpts}</select>
      <div class="lbl">账户</div><select class="field" id="r_acc">${accOpts}</select>
      <div class="lbl">频率</div>
      <div class="seg" style="display:flex" id="r_freq">
        ${['daily', 'weekly', 'monthly', 'yearly'].map(f => `<button data-f="${f}" class="${(r && r.frequency === f) || (!r && f === 'monthly') ? 'on' : ''}">${freqName(f)}</button>`).join('')}
      </div>
      <div class="lbl">首次 / 下次执行日期</div><input type="date" class="field" id="r_date" value="${r ? r.next_execute_date : ymd()}">
      <div class="lbl">备注（可选）</div><input class="field" id="r_note" value="${r ? r.note || '' : ''}" placeholder="如 自动扣款">
      <label class="row" style="margin-top:10px"><span>启用自动记账</span><input type="checkbox" id="r_on" ${r ? (r.is_active ? 'checked' : '') : 'checked'}></label>
      <div class="form-actions">
        ${r ? '<button class="btn danger" id="r_del" style="flex:1">删除</button>' : ''}
        <button class="btn" id="r_now" style="flex:1">立即记一次</button>
        <button class="btn" id="r_save" style="flex:2">保存</button>
      </div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $$('[data-t]', $('#formModal')).forEach(b => b.onclick = () => { const typ = b.dataset.t; $$('[data-t]', $('#formModal')).forEach(x => x.classList.toggle('on', x === b)); const sel = $('#r_cat', $('#formModal')); sel.innerHTML = cats(typ).map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join(''); });
    $$('[data-f]', $('#formModal')).forEach(b => b.onclick = () => { $$('[data-f]', $('#formModal')).forEach(x => x.classList.toggle('on', x === b)); });
    $('#r_now', $('#formModal')).onclick = () => saveRecurring(r, true);
    $('#r_save', $('#formModal')).onclick = () => saveRecurring(r, false);
    if (r) $('#r_del', $('#formModal')).onclick = () => { if (confirm('删除这条定期账单？')) { r.is_deleted = 1; r.sync_status = 'pending'; save(); closeSheet($('#formModal')); openRecurring(); } };
  }
  function saveRecurring(r, now) {
    const name = $('#r_name', $('#formModal')).value.trim(); if (!name) return toast('请填写名称');
    const amt = parseFloat($('#r_amt', $('#formModal')).value); if (!amt || amt <= 0) return toast('请填写有效金额');
    const cat = $('#r_cat', $('#formModal')).value; const acc = $('#r_acc', $('#formModal')).value;
    const freqEl = $('#r_freq', $('#formModal')).querySelector('.on'); const freq = freqEl ? freqEl.dataset.f : 'monthly';
    const date = $('#r_date', $('#formModal')).value || ymd();
    const note = $('#r_note', $('#formModal')).value.trim();
    const on = $('#r_on', $('#formModal')).checked;
    const typEl = $('#r_types', $('#formModal')).querySelector('.on'); const typ = typEl ? typEl.dataset.t : 'exp';
    if (now) { addTx({ type: typ, amount: amt, account_id: acc, category_id: typ === 'transfer' ? null : cat, to_account_id: null, note: (note || name) + '（定期）', transaction_date: ymd() }); toast('已记一次'); }
    if (r) { r.name = name; r.type = typ; r.amount = amt; r.category_id = cat; r.account_id = acc; r.frequency = freq; r.next_execute_date = date; r.note = note; r.is_active = on ? 1 : 0; r.updated_at = nowMs(); r.sync_status = 'pending'; }
    else { DB.recurring.push({ id: uid(), book_id: curBookId(), name, type: typ, amount: amt, category_id: cat, account_id: acc, frequency: freq, next_execute_date: date, last_execute_date: null, is_auto: 1, is_active: on ? 1 : 0, note, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId }); }
    save(); closeSheet($('#formModal')); openRecurring(); renderHome();
  }

  /* ---------- 资产总览 ---------- */
  function assetDonut(accs) {
    const pos = accs.filter(a => a.balance > 0);
    const total = pos.reduce((s, a) => s + a.balance, 0);
    if (!total) return '<div class="empty">暂无正资产</div>';
    const R = 70, cx = 90, cy = 90, r = 54; let a0 = -Math.PI / 2, svg = '';
    pos.forEach(a => {
      const ang = a.balance / total * Math.PI * 2; const a1 = a0 + ang;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = ang > Math.PI ? 1 : 0;
      svg += `<path d="M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${a.color}"></path>`;
      a0 = a1;
    });
    const legend = pos.map(a => `<span><i style="background:${a.color}"></i>${a.name} ${money(a.balance)}</span>`).join('');
    return `<svg viewBox="0 0 180 180" width="180" height="180" style="display:block;margin:6px auto">${svg}<circle cx="${cx}" cy="${cy}" r="${R - r + 8}" fill="var(--card)"></circle><text x="90" y="86" text-anchor="middle" font-size="13" fill="var(--sub)">正资产</text><text x="90" y="104" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${money(total)}</text></svg><div class="legend">${legend}</div>`;
  }
  function assetTrend() {
    const s = (DB.snapshots || []).slice(-30);
    if (s.length < 2) return '<div class="muted">每天打开应用会自动记录净资产，几天后这里就有趋势曲线了。</div>';
    const W = 320, H = 140, pl = 6, pr = 6, pt = 10, pb = 18;
    const vals = s.map(x => x.net); const max = Math.max.apply(null, vals.concat([1])), min = Math.min.apply(null, vals.concat([0]));
    const range = Math.max(1, max - min); const n = s.length; const stepX = (W - pl - pr) / Math.max(1, n - 1);
    const yOf = (v) => H - pb - (v - min) / range * (H - pt - pb);
    const line = () => s.map((x, i) => (i ? 'L' : 'M') + (pl + i * stepX).toFixed(1) + ' ' + yOf(x.net).toFixed(1)).join(' ');
    const dots = s.map((x, i) => `<circle cx="${(pl + i * stepX).toFixed(1)}" cy="${yOf(x.net).toFixed(1)}" r="2.2" fill="var(--brand)"></circle>`).join('');
    const labels = `<text x="${pl}" y="${H - 4}" font-size="9" fill="var(--sub)">${s[0].date.slice(5)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end" font-size="9" fill="var(--sub)">${s[n - 1].date.slice(5)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><path d="${line()}" fill="none" stroke="var(--brand)" stroke-width="2"></path>${dots}${labels}</svg>`;
  }
  function openAssets() {
    const nw = netWorth();
    const accs = accsOf(curBookId()).sort((x, y) => y.balance - x.balance);
    const pos = accs.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0) || 1;
    const rows = accs.map(a => {
      const pct = a.balance > 0 ? Math.round(a.balance / pos * 100) : 0;
      return `<div class="list-row">
        <div class="ico" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
        <div class="meta" style="flex:1"><div class="t">${a.name}</div><div class="s">${typeName(a.type)}</div></div>
        <div style="width:96px">
          <div class="mono" style="text-align:right;font-weight:700">${money(a.balance)}</div>
          <div style="height:5px;background:var(--bg);border-radius:4px;margin-top:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${a.color}"></div></div>
        </div>
      </div>`;
    }).join('') || '<div class="empty">还没有账户</div>';
    openSheet($('#formModal'), `<h3>资产总览 <button class="x" data-close>×</button></h3>
      <div class="balance-hero"><div class="lab">净资产</div><div class="big mono">${money(nw)}</div><div class="s" style="opacity:.7">${accs.length} 个账户 · 正资产合计 ${money(pos)}</div></div>
      <div class="card"><h3>净资产趋势</h3>${assetTrend()}</div>
      <div class="card"><h3>账户构成</h3>${assetDonut(accs)}${rows}</div>
      <button class="btn ghost" data-close>关闭</button>`);
    $$('[data-close]', $('#formModal')).forEach(b => b.onclick = () => closeSheet($('#formModal')));
  }

  /* ============================================================
     记账（计算器键盘 + 分类/账户/日期/备注）
     ============================================================ */
  let rec = null;
  function openRec(editId) {
    const t = editId ? DB.transactions.find(x => x.id === editId) : null;
    const fa = accsOf(curBookId());
    const expCats = cats('exp'), incCats = cats('inc');
    if (!t) {
      if (!expCats.length && !incCats.length) { toast('请先在「我的 → 分类管理」添加分类'); meGo('cats'); return; }
      if (!fa.length) { toast('请先在「我的 → 账户管理」添加账户'); meGo('accounts'); return; }
    }
    const defAcc = getBook().default_account_id || (fa[0] && fa[0].id);
    const defCat = expCats[0] || incCats[0] || null;
    rec = {
      id: t ? t.id : null, type: t ? t.type : 'exp',
      expr: t ? String(t.amount) : '0', catId: t ? t.category_id : (defCat ? defCat.id : null),
      accId: t ? t.account_id : defAcc,
      toAccId: t ? t.to_account_id : (fa[1] ? fa[1].id : defAcc),
      date: t ? t.transaction_date : ymd(), note: t ? (t.note || '') : '',
      tagIds: t ? (t.tag_ids || []) : []
    };
    renderRec();
  }
  /* 一键复用：照某笔交易的值，打开一张空白新记录填好表 */
  function reuseTx(id) {
    const t = DB.transactions.find(x => x.id === id); if (!t) return;
    openRec(null);
    rec.type = t.type;
    rec.expr = String(t.fav_amount != null ? t.fav_amount : t.amount);
    rec.catId = t.category_id;
    rec.accId = t.account_id || (getBook().default_account_id || (accsOf(curBookId())[0] && accsOf(curBookId())[0].id));
    rec.toAccId = t.to_account_id || rec.toAccId;
    rec.date = ymd();
    rec.note = t.note || '';
    renderRec();
  }
  // 编辑常用模板：改名 + 默认金额（独立于原交易）
  function openFavEdit(id) {
    const t = DB.transactions.find(x => x.id === id); if (!t) return;
    const c = catById(t.category_id);
    const catName = c ? c.name : (t.type === 'transfer' ? '转账' : '未分类');
    const label0 = t.fav_label || '';
    const amt0 = t.fav_amount != null ? Number(t.fav_amount) : t.amount;
    openSheet($('#formModal'), `<h3>编辑常用 <button class="x" data-close>×</button></h3>
      <div class="muted" style="font-size:13px;margin-bottom:8px">分类：${catName} · 点「常用」里的条目即按此模板再记一笔</div>
      <div class="lbl">显示名称（留空则用分类名）</div>
      <input class="field" id="fav_label" placeholder="${catName}" value="${label0.replace(/"/g, '&quot;')}">
      <div class="lbl">默认金额（元）</div>
      <input class="field" id="fav_amount" type="number" inputmode="decimal" step="0.01" value="${amt0}">
      <div class="form-actions"><button class="btn ghost" id="fav_clear">恢复为原记录</button><button class="btn" id="fav_save" style="flex:1">保存</button></div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $('#fav_save', $('#formModal')).onclick = () => {
      const lab = $('#fav_label', $('#formModal')).value.trim();
      const am = parseFloat($('#fav_amount', $('#formModal')).value);
      if (isNaN(am) || am < 0) return toast('请输入有效金额');
      t.fav_label = lab; t.fav_amount = am; t.sync_status = 'pending'; t.updated_at = nowMs(); save();
      closeSheet($('#formModal')); renderHome(); toast('已更新常用模板');
    };
    $('#fav_clear', $('#formModal')).onclick = () => {
      t.fav_label = ''; t.fav_amount = null; t.sync_status = 'pending'; t.updated_at = nowMs(); save();
      closeSheet($('#formModal')); renderHome(); toast('已恢复为原记录');
    };
  }
  function renderRec() {
    const r = rec;
    const catList = cats(r.type);
    if (!catList.find(c => c.id === r.catId)) r.catId = catList[0] ? catList[0].id : null;
    const accOpts = accsOf(curBookId()).map(a => `<option value="${a.id}" ${a.id === r.accId ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('');
    const toOpts = accsOf(curBookId()).map(a => `<option value="${a.id}" ${a.id === r.toAccId ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('');
    const catCells = catList.map(c => `<div class="cat-cell ${c.id === r.catId ? 'on' : ''}" data-cat="${c.id}"><div class="ci" style="background:${c.color}22;color:${c.color}">${c.icon}</div>${c.name}</div>`).join('') || '<div class="muted">该类型暂无分类，去「我的」添加</div>';
    const shown = r.expr.replace(/\./g, '.');
    const html = `<h3>${r.id ? '编辑记录' : '记一笔'} <button class="x" data-close>×</button></h3>
      <div class="type-tabs">
        <button data-type="exp" class="${r.type === 'exp' ? 'on' : ''}">支出</button>
        <button data-type="inc" class="${r.type === 'inc' ? 'on' : ''}">收入</button>
        <button data-type="transfer" class="${r.type === 'transfer' ? 'on' : ''}">转账</button>
      </div>
      <div class="amt-display"><span class="cur">${CUR}</span><span id="recAmt">${shown}</span></div>
      <div class="calc">
        ${['7', '8', '9', '÷'].map(k => `<button class="${/÷/.test(k) ? 'op' : ''}" data-k="${k}">${k}</button>`).join('')}
        ${['4', '5', '6', '×'].map(k => `<button class="${/×/.test(k) ? 'op' : ''}" data-k="${k}">${k}</button>`).join('')}
        ${['1', '2', '3', '−'].map(k => `<button class="${/−/.test(k) ? 'op' : ''}" data-k="${k}">${k}</button>`).join('')}
        ${['C', '0', '.', '+'].map(k => `<button class="${/[+C.]/.test(k) ? 'op' : ''}" data-k="${k}">${k}</button>`).join('')}
        <button class="op" data-k="⌫" style="grid-column:span 1">⌫</button>
        <button class="eq" data-k="=" style="grid-column:span 3">＝</button>
      </div>
      <div class="lbl">分类</div><div class="cat-grid" id="recCats">${catCells}</div>
      <div class="lbl">账户</div>
      <div class="pick-line" id="recAcc">${accById(r.accId) ? accById(r.accId).icon + ' ' + accById(r.accId).name : '选择账户'} ›</div>
      ${r.type === 'transfer' ? `<div class="lbl">转入账户</div><div class="pick-line" id="recTo">${accById(r.toAccId) ? accById(r.toAccId).icon + ' ' + accById(r.toAccId).name : '选择账户'} ›</div>` : ''}
      <div class="lbl">日期</div><div class="pick-line" id="recDate">${fmtDateFull(r.date)} ›</div>
      <div class="lbl">备注</div><input class="field" id="recNote" placeholder="加个备注…" value="${r.note}">
      <button class="btn" id="recSave" style="margin-top:14px">保存</button>`;
    openSheet($('#recModal'), html);
    $('[data-close]', $('#recModal')).onclick = () => closeSheet($('#recModal'));
    $$('[data-type]', $('#recModal')).forEach(b => b.onclick = () => { rec.type = b.dataset.type; renderRec(); });
    $$('[data-k]', $('#recModal')).forEach(b => b.onclick = () => calc(b.dataset.k));
    $$('[data-cat]', $('#recModal')).forEach(c => c.onclick = () => { rec.catId = c.dataset.cat; $$('[data-cat]', $('#recModal')).forEach(x => x.classList.toggle('on', x === c)); });
    if ($('#recAcc', $('#recModal'))) $('#recAcc', $('#recModal')).onclick = () => pickAccount('accId');
    if ($('#recTo', $('#recModal'))) $('#recTo', $('#recModal')).onclick = () => pickAccount('toAccId');
    if ($('#recDate', $('#recModal'))) $('#recDate', $('#recModal')).onclick = () => pickDate();
    if ($('#recSave', $('#recModal'))) $('#recSave', $('#recModal')).onclick = () => saveRec();
  }
  function calc(k) {
    let e = rec.expr;
    if (k === 'C') e = '0';
    else if (k === '⌫') e = e.length > 1 ? e.slice(0, -1) : '0';
    else if (k === '=') { try { const val = evalExpr(e); e = (Math.round(val * 100) / 100).toString(); } catch (err) { e = e; } }
    else if (k === '.') { if (!e.split(/[+\-×÷]/).pop().includes('.')) e += '.'; }
    else if (['+', '−', '×', '÷'].includes(k)) { if (/[+\-×÷]$/.test(e)) e = e.slice(0, -1) + k; else e += k; }
    else e = (e === '0' ? k : e + k);
    rec.expr = e; $('#recAmt', $('#recModal')).textContent = e;
  }
  function evalExpr(s) { s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'); return Function('"use strict";return (' + s + ')')(); }
  function pickAccount(field) {
    const opts = accsOf(curBookId()).map(a => `<div class="list-row" data-pa="${a.id}"><div class="ico" style="background:${a.color}22;color:${a.color}">${a.icon}</div><div class="meta"><div class="t">${a.name}</div><div class="s">${typeName(a.type)}</div></div><div class="mono">${money(a.balance)}</div></div>`).join('');
    openSheet($('#pickerModal'), `<h3>选择账户 <button class="x" data-close>×</button></h3>${opts}`);
    $('[data-close]', $('#pickerModal')).onclick = () => closeSheet($('#pickerModal'));
    $$('[data-pa]', $('#pickerModal')).forEach(r => r.onclick = () => { rec[field] = r.dataset.pa; closeSheet($('#pickerModal')); renderRec(); });
  }
  let pickYm = new Date();
  function pickDate() {
    const y = pickYm.getFullYear(), m = pickYm.getMonth();
    const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate();
    let cells = ''; for (let i = 0; i < first; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) { const ds = y + '-' + pad(m + 1) + '-' + pad(d); cells += `<div class="cal-cell ${ds === rec.date ? 'sel' : ''}" data-pd="${ds}">${d}</div>`; }
    openSheet($('#pickerModal'), `<h3>选择日期 <button class="x" data-close>×</button></h3>
      <div class="cal-head"><button class="x" data-pm="-1">‹</button><span class="mon">${y}年${m + 1}月</span><button class="x" data-pm="1">›</button></div>
      <div class="cal-grid"><div class="wd">日</div><div class="wd">一</div><div class="wd">二</div><div class="wd">三</div><div class="wd">四</div><div class="wd">五</div><div class="wd">六</div>${cells}</div>`);
    $('[data-close]', $('#pickerModal')).onclick = () => closeSheet($('#pickerModal'));
    $$('[data-pm]', $('#pickerModal')).forEach(b => b.onclick = () => { pickYm = new Date(y, m + (b.dataset.pm === '1' ? 1 : -1), 1); pickDate(); });
    $$('[data-pd]', $('#pickerModal')).forEach(c => c.onclick = () => { rec.date = c.dataset.pd; closeSheet($('#pickerModal')); renderRec(); });
  }
  function saveRec() {
    let amt;
    try { amt = Math.round(evalExpr(rec.expr) * 100) / 100; } catch (e) { return toast('金额无效'); }
    if (!isFinite(amt) || amt <= 0) return toast('请输入有效金额');
    if (rec.type !== 'transfer' && !rec.catId) return toast('请选择分类');
    if (rec.type === 'transfer' && rec.accId === rec.toAccId) return toast('转入账户不能相同');
    const payload = {
      type: rec.type, amount: amt, account_id: rec.accId,
      to_account_id: rec.type === 'transfer' ? rec.toAccId : null,
      category_id: rec.type === 'transfer' ? null : rec.catId,
      note: $('#recNote', $('#recModal')).value.trim(), transaction_date: rec.date
    };
    if (rec.id) { updTx(rec.id, payload); toast('已更新'); } else { addTx(payload); toast('已记录'); }
    closeSheet($('#recModal'));
    if (!$('#viewHome').hidden) renderHome();
    if (!$('#viewFlow').hidden) renderFlow();
    if (!$('#viewStats').hidden) renderStats();
  }

  /* ---------- 导入 / 导出 CSV ---------- */
  function exportCSV() {
    const rows = [['kind', 'date', 'type', 'category', 'account', 'to_account', 'amount', 'note', 'name', 'frequency', 'active']];
    liveTx().sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)).forEach(t => {
      rows.push(['tx', t.transaction_date, t.type, (catById(t.category_id) || {}).name || '', (accById(t.account_id) || {}).name || '', (accById(t.to_account_id) || {}).name || '', t.amount, t.note || '', '', '', '']);
    });
    const recCount = DB.recurring.filter(r => !r.is_deleted && r.book_id === curBookId()).length;
    DB.recurring.filter(r => !r.is_deleted && r.book_id === curBookId()).forEach(r => {
      rows.push(['recurring', r.next_execute_date, r.type, (catById(r.category_id) || {}).name || '', (accById(r.account_id) || {}).name || '', '', r.amount, r.note || '', r.name, r.frequency, r.is_active]);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '一记备份_' + ymd() + '.csv'; a.click();
    URL.revokeObjectURL(a.href); toast('已导出 ' + (rows.length - 1) + ' 条（含 ' + recCount + ' 条定期账单）');
  }
  function importCSV() {
    openSheet($('#formModal'), `<h3>导入数据 <button class="x" data-close>×</button></h3>
      <div class="muted">CSV 含「交易」与「定期账单」两类，表头带 kind 列。<br>仅追加新数据，不会覆盖现有；旧格式（无 kind 列）也兼容。</div>
      <div class="lbl">选择文件</div><input type="file" id="csvFile" accept=".csv,text/csv" class="field">
      <button class="btn" id="csvGo">导入</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    $('#csvGo', $('#formModal')).onclick = () => {
      const f = $('#csvFile', $('#formModal')).files[0]; if (!f) return toast('请选择文件');
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result; const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
        if (!lines.length) return;
        const header = parseCSVLine(lines[0]).map(h => h.trim());
        const hasKind = header.indexOf('kind') >= 0;
        const ix = (name) => header.indexOf(name);
        let n = 0, nr = 0;
        budgetMute = true;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]); if (!cols.length) continue;
          const at = (name, pos) => hasKind ? (ix(name) >= 0 ? cols[ix(name)] : '') : (cols[pos] !== undefined ? cols[pos] : '');
          const kind = hasKind ? (cols[ix('kind')] || 'tx') : 'tx';
          if (kind === 'recurring') {
            const name = (at('name', 8) || '').trim();
            const freq = (at('frequency', 9) || 'monthly').trim();
            const active = (at('active', 10) || '1').trim();
            const catName = at('category', 2), accName = at('account', 3), amount = +at('amount', 6);
            const date = at('date', 1) || ymd(), rtype = (at('type', 2) || 'exp').trim(), rnote = at('note', 7) || '';
            const acc = DB.accounts.find(a => a.name === accName); if (!acc || !name || !amount) continue;
            const cat = DB.categories.find(c => c.name === catName);
            DB.recurring.push({ id: uid(), book_id: curBookId(), name, type: rtype, amount, category_id: cat ? cat.id : (cats(rtype)[0] ? cats(rtype)[0].id : null), account_id: acc.id, frequency: freq || 'monthly', next_execute_date: date, last_execute_date: null, is_auto: 1, is_active: (active === '1' || active === 'true') ? 1 : 0, note: rnote, created_at: nowMs(), updated_at: nowMs(), sync_status: 'pending', is_deleted: 0, device_id: deviceId });
            nr++;
          } else {
            const date = at('date', 0), type = at('type', 1), catName = at('category', 2), accName = at('account', 3), toName = at('to_account', 4), amount = +at('amount', 5), note = at('note', 6) || '';
            const acc = DB.accounts.find(a => a.name === accName); if (!acc) continue;
            const cat = DB.categories.find(c => c.name === catName);
            if (type === 'transfer') { const to = DB.accounts.find(a => a.name === toName); if (!to) continue; addTx({ type: 'transfer', amount: +amount, account_id: acc.id, to_account_id: to.id, category_id: null, note, transaction_date: date }); }
            else addTx({ type, amount: +amount, account_id: acc.id, category_id: cat ? cat.id : cats(type)[0].id, note, transaction_date: date });
            n++;
          }
        }
        budgetMute = false;
        const made = processRecurring();
        closeSheet($('#formModal'));
        toast('已导入 ' + n + ' 笔交易 · ' + nr + ' 条定期' + (made ? ' · 自动补记 ' + made + ' 笔' : ''));
        renderHome(); renderFlow(); renderStats(); renderMe();
      };
      reader.readAsText(f);
    };
  }
  function parseCSVLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else { if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
    }
    out.push(cur); return out;
  }

  /* ---------- 关于 / 重置 ---------- */
  function openAbout() {
    openSheet($('#formModal'), `<h3>关于一记 <button class="x" data-close>×</button></h3>
      <p class="muted">极简录入 + 深度洞察的个人记账工具。<br>纯本地存储，数据不出设备，离线可用，可安装到手机桌面。</p>
      <p class="muted">版本 v1.0 · 数据存于本机浏览器 localStorage</p>
      <button class="btn ghost" data-close>知道了</button>`);
    $$('[data-close]', $('#formModal')).forEach(b => b.onclick = () => closeSheet($('#formModal')));
  }
  function doReset() {
    if (confirm('确定清空全部数据？此操作不可恢复（建议先导出备份）。\n清空后将回到空账本，请自行添加分类与账户。')) {
      localStorage.removeItem(KEY); seed(); applyTheme(); renderMe(); nav('home');
      toast('已清空，开始建立你自己的账本');
    }
  }

  /* ============================================================
     事件绑定 / 启动
     ============================================================ */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const a = t.dataset.action;
      if (a === 'nav-home') nav('home');
      else if (a === 'nav-flow') nav('flow');
      else if (a === 'nav-stats') nav('stats');
      else if (a === 'nav-me') nav('me');
      else if (a === 'open-rec') openRec(null);
      else if (a === 'open-transfer') { openRec(null); rec.type = 'transfer'; renderRec(); }
    });
  }
  async function init() {
    await load(); applyTheme();
    recordSnapshot();
    const made = processRecurring();
    if (made) setTimeout(() => toast('已自动补记 ' + made + ' 笔定期账单'), 500);
    bindGlobal(); nav('home');
    if (DB.settings.app_lock_enabled && DB.settings.pin_hash) showLock();
    if (autoRecovered) setTimeout(() => toast('检测到本地账本异常，已从自动备份恢复数据'), 400);
  }
  // 每日打开应用时记录一次净资产快照，用于总览趋势
  function recordSnapshot() {
    if (!DB.snapshots) DB.snapshots = [];
    const today = ymd();
    const last = DB.snapshots[DB.snapshots.length - 1];
    if (last && last.date === today) return;
    DB.snapshots.push({ date: today, net: netWorth(), created_at: nowMs() });
    if (DB.snapshots.length > 365) DB.snapshots = DB.snapshots.slice(-365);
    save();
  }

  /* ---------- 应用锁（隐私） ---------- */
  function hashPin(p) { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return 'p' + h; }
  function showLock() {
    const ov = document.createElement('div');
    ov.id = 'lockScreen';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px';
    ov.innerHTML = `<div style="font-size:42px">🔒</div>
      <div style="font-weight:700;font-size:18px;color:var(--ink)">一记已锁定</div>
      <div id="lockDots" style="display:flex;gap:12px"></div>
      <div id="lockMsg" style="color:var(--exp);font-size:13px;height:16px"></div>
      <div id="lockPad" style="display:grid;grid-template-columns:repeat(3,64px);gap:12px"></div>`;
    document.body.appendChild(ov);
    let pin = '';
    const dots = () => { const d = ov.querySelector('#lockDots'); let h = ''; for (let i = 0; i < 4; i++) h += `<div style="width:14px;height:14px;border-radius:50%;background:${i < pin.length ? 'var(--brand)' : 'transparent'};border:2px solid var(--brand)"></div>`; d.innerHTML = h; };
    const pad = ov.querySelector('#lockPad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    keys.forEach(k => {
      const b = document.createElement('button'); b.textContent = k;
      b.style.cssText = 'height:64px;border:none;border-radius:16px;background:var(--card);font-size:22px;color:var(--ink);font-weight:600;' + (k === '' ? 'visibility:hidden' : 'cursor:pointer');
      b.onclick = () => { if (k === '') return; if (k === '⌫') { pin = pin.slice(0, -1); dots(); return; } if (pin.length < 4) { pin += k; dots(); if (pin.length === 4) setTimeout(tryUnlock, 120); } };
      pad.appendChild(b);
    });
    dots();
    function tryUnlock() {
      if (hashPin(pin) === DB.settings.pin_hash) { ov.remove(); }
      else { ov.querySelector('#lockMsg').textContent = '密码错误，重试'; pin = ''; dots(); if (ov.animate) ov.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 200 }); }
    }
  }
  function enterPin(title, cb) {
    openSheet($('#formModal'), `<h3>${title} <button class="x" data-close>×</button></h3>
      <div id="pinDots" style="display:flex;gap:14px;justify-content:center;margin:14px 0"></div>
      <div id="pinPad" style="display:grid;grid-template-columns:repeat(3,72px);gap:12px;justify-content:center"></div>
      <button class="btn ghost" data-close style="margin-top:10px">取消</button>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    let pin = '';
    const dots = () => { const d = $('#pinDots', $('#formModal')); if (!d) return; let h = ''; for (let i = 0; i < 4; i++) h += `<div style="width:16px;height:16px;border-radius:50%;background:${i < pin.length ? 'var(--brand)' : 'transparent'};border:2px solid var(--brand)"></div>`; d.innerHTML = h; };
    const pad = $('#pinPad', $('#formModal'));
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    keys.forEach(k => {
      const b = document.createElement('button'); b.textContent = k;
      b.style.cssText = 'height:72px;border:none;border-radius:16px;background:var(--card);font-size:24px;color:var(--ink);font-weight:600;' + (k === '' ? 'visibility:hidden' : 'cursor:pointer');
      b.onclick = () => { if (k === '') return; if (k === '⌫') { pin = pin.slice(0, -1); dots(); return; } if (pin.length < 4) { pin += k; dots(); if (pin.length === 4) setTimeout(() => cb(pin), 120); } };
      pad.appendChild(b);
    });
    dots();
  }
  function verifyThen(ok) {
    enterPin('输入当前密码', (pin) => { if (hashPin(pin) === DB.settings.pin_hash) { closeSheet($('#formModal')); ok(); } else toast('密码错误'); });
  }
  function setPinFlow() {
    enterPin('设置新密码（4位）', (p1) => {
      if (p1.length < 4) { toast('至少 4 位'); return; }
      enterPin('再次输入确认', (p2) => {
        if (p1 !== p2) { toast('两次不一致'); return; }
        DB.settings.pin_hash = hashPin(p1); DB.settings.app_lock_enabled = 1; save();
        closeSheet($('#formModal')); toast('密码已设置'); renderMe();
      });
    });
  }
  function openLock() {
    const s = DB.settings; const on = !!s.app_lock_enabled;
    openSheet($('#formModal'), `<h3>应用锁 <button class="x" data-close>×</button></h3>
      <div class="muted">开启后，每次打开一记需输入密码，保护本地隐私（密码仅存于本机）。</div>
      <div class="row" style="margin:12px 0"><span>启用应用锁</span><span class="chip ${on ? 'on' : ''}">${on ? '已开' : '关闭'}</span></div>
      ${on ? `<button class="btn" id="lockChange">修改密码</button><button class="btn danger" id="lockOff">关闭应用锁</button>` : `<button class="btn" id="lockSet">设置密码</button>`}`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    if (!on) $('#lockSet', $('#formModal')).onclick = () => { closeSheet($('#formModal')); setPinFlow(); };
    else {
      $('#lockChange', $('#formModal')).onclick = () => { closeSheet($('#formModal')); setPinFlow(); };
      $('#lockOff', $('#formModal')).onclick = () => { closeSheet($('#formModal')); verifyThen(() => { DB.settings.app_lock_enabled = 0; DB.settings.pin_hash = ''; save(); toast('已关闭'); renderMe(); }); };
    }
  }

  /* ---------- 数据同步（WebDAV：离线优先 + 逐记录 LWW 合并） ---------- */
  // Unicode 安全的 Basic Auth 编码（密码含中文也不崩）
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function normFolder(u) { u = (u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/\/?$/, '/'); }
  function syncFolderUrl() { const s = DB.settings; return normFolder(s.webdav_url) + encodeURIComponent('一记') + '/'; }
  function syncFileUrl() { return syncFolderUrl() + 'yiji_db_v1.json'; }
  // 合并本地与远端：统一 book_id 到远端那一本；逐记录按 updated_at 取新（LWW）；
  // 删除用墓碑(is_deleted=1 + updated_at 已更新)自然胜出；settings 仅保留本地偏好，只对齐 book_id
  function mergeDB(local, remote) {
    local = JSON.parse(JSON.stringify(local)); remote = JSON.parse(JSON.stringify(remote));
    const TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'tags', 'recurring', 'snapshots'];
    const canon = (remote.books && remote.books[0] && remote.books[0].id) || (local.books && local.books[0] && local.books[0].id);
    const remap = (r) => { if (r && r.book_id && r.book_id !== canon) r.book_id = canon; };
    TABLES.forEach(t => { (local[t] || []).forEach(remap); (remote[t] || []).forEach(remap); });
    if (local.settings) local.settings.book_id = canon;
    if (remote.settings) remote.settings.book_id = canon;
    local.books = (remote.books && remote.books.length) ? remote.books : local.books;
    TABLES.forEach(t => {
      const lm = new Map((local[t] || []).map(r => [r.id, r]));
      (remote[t] || []).forEach(r => {
        const ex = lm.get(r.id);
        if (!ex) lm.set(r.id, r);
        else if (r.updated_at > ex.updated_at) lm.set(r.id, r); // 更新时间新者胜；相等保留本地，避免来回抖动
      });
      local[t] = Array.from(lm.values());
    });
    return local;
  }
  function setSyncStatus(msg) { const el = $('#syncStatus'); if (el) el.textContent = msg; }
  async function syncNow() {
    const s = DB.settings; setSyncStatus('同步中…');
    try {
      if (!s.webdav_url) throw new Error('请先填写 WebDAV 地址');
      const auth = 'Basic ' + b64((s.webdav_user || '') + ':' + (s.webdav_pass || ''));
      const folder = syncFolderUrl(), file = syncFileUrl();
      try { await fetch(folder, { method: 'MKCOL', headers: { Authorization: auth } }); } catch (e) { /* 目录可能已存在 */ }
      let remote = null;
      const r = await fetch(file, { headers: { Authorization: auth } });
      if (r.status === 401) throw new Error('认证失败（用户名或密码错误）');
      if (r.status === 403) throw new Error('无权限（检查目录读写）');
      if (r.ok) { try { remote = await r.json(); } catch (e) { remote = null; } }
      else if (r.status !== 404) throw new Error('拉取失败 HTTP ' + r.status);
      let payload = JSON.parse(JSON.stringify(DB));
      if (remote && remote.books) payload = mergeDB(payload, remote);
      const put = await fetch(file, { method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (put.status === 401) throw new Error('认证失败');
      if (!put.ok) throw new Error('上传失败 HTTP ' + put.status);
      DB = payload; DB.settings = Object.assign({}, DB.settings, { last_sync_at: nowMs() }); save();
      setSyncStatus('已同步 · ' + new Date().toLocaleString()); toast('同步完成'); renderMe();
    } catch (e) { setSyncStatus('失败：' + e.message); toast('同步失败：' + e.message); }
  }
  async function testConnection() {
    const s = DB.settings; setSyncStatus('测试连接中…');
    try {
      if (!s.webdav_url) throw new Error('请先填写 WebDAV 地址');
      const auth = 'Basic ' + b64((s.webdav_user || '') + ':' + (s.webdav_pass || ''));
      const r = await fetch(syncFolderUrl(), { method: 'MKCOL', headers: { Authorization: auth } });
      if (r.status === 401) throw new Error('认证失败');
      if (r.status === 403 || (r.status >= 400 && r.status !== 404 && r.status !== 405)) throw new Error('连接失败 HTTP ' + r.status);
      setSyncStatus('连接正常 ✓'); toast('连接正常');
    } catch (e) { setSyncStatus('失败：' + e.message); toast('连接失败：' + e.message); }
  }
  function openSync() {
    const s = DB.settings;
    const last = s.last_sync_at ? '上次同步：' + new Date(s.last_sync_at).toLocaleString() : '尚未同步';
    openSheet($('#formModal'), `<h3>数据同步（WebDAV） <button class="x" data-close>×</button></h3>
      <div class="muted">把账本备份到你的 WebDAV（NAS / 云盘等），多台设备填同一个地址即可互相同步。文件存于「一记」子文件夹的 yiji_db_v1.json。</div>
      <label class="fld">WebDAV 文件夹地址<input id="wdUrl" class="inp" value="${s.webdav_url || ''}" placeholder="https://dav.example.com/remote.php/dav/files/你/"></label>
      <label class="fld">用户名<input id="wdUser" class="inp" value="${s.webdav_user || ''}" placeholder="可选"></label>
      <label class="fld">密码<input id="wdPass" class="inp" type="password" value="${s.webdav_pass || ''}" placeholder="可选"></label>
      <div id="syncStatus" class="muted" style="margin:8px 0">${last}</div>
      <div class="row" style="gap:10px">
        <button class="btn ghost" id="wdTest">测试连接</button>
        <button class="btn" id="wdSync">立即同步</button>
      </div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    const readCfg = () => { s.webdav_url = $('#wdUrl', $('#formModal')).value.trim(); s.webdav_user = $('#wdUser', $('#formModal')).value; s.webdav_pass = $('#wdPass', $('#formModal')).value; save(); };
    $('#wdTest', $('#formModal')).onclick = () => { readCfg(); testConnection(); };
    $('#wdSync', $('#formModal')).onclick = () => { readCfg(); syncNow(); };
  }
  if (typeof window !== 'undefined') window.Yiji = { mergeDB: mergeDB, syncNow: syncNow, testConnection: testConnection, openSync: openSync };

  /* ---------- 语音记账 ---------- */
  // 离线解析：金额(正则) + 类型/账户/分类(关键词)。识别由 webkitSpeechRecognition 提供，此处只负责把文本变成一笔账
  // —— 语音金额：支持中文数字与口语（三十五块五 / 两千 / 五毛 / 十二块八）——
  const CN_DIGIT = { '零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000,'亿':100000000 };
  function parseCnInt(s) {
    s = String(s || '');
    if (!s) return NaN;
    let total = 0, section = 0, cur = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i], v = CN_DIGIT[ch];
      if (v == null) return NaN;
      if (v === 100000000) { total += (section + cur) * v; section = 0; cur = 0; }
      else if (v === 10000) { total += (section + cur) * v; section = 0; cur = 0; }
      else if (v === 1000 || v === 100 || v === 10) { cur = (cur === 0 ? 1 : cur) * v; section += cur; cur = 0; }
      else { cur = v; }
    }
    return total + section + cur;
  }
  function cnToNum(s) {
    if (s == null) return NaN;
    s = String(s).replace(/[，,\s]/g, '');
    if (!s) return 0;
    let intPart = s, decPart = '';
    const di = s.indexOf('点');
    if (di >= 0) { intPart = s.slice(0, di); decPart = s.slice(di + 1); }
    let intVal = parseCnInt(intPart);
    if (isNaN(intVal)) intVal = 0;
    if (decPart) {
      let dec = '';
      for (const ch of decPart) { const v = CN_DIGIT[ch]; if (typeof v === 'number' && v < 10) dec += v; else if (v === 0) dec += '0'; }
      return parseFloat(intVal + '.' + (dec || '0'));
    }
    return intVal;
  }
  function extractAmount(text) {
    if (!text) return 0;
    const am = text.match(/(\d+(?:\.\d+)?)/);
    if (am) return parseFloat(am[1]);
    const CN = '[零一二两三四五六七八九十百千万亿点〇]+';
    let m = text.match(new RegExp('(' + CN + ')(?:块|元|圆)(?:(' + CN + ')(毛|角)?)?'));
    if (m) {
      const yuan = cnToNum(m[1]);
      if (m[2] != null) { const jiao = cnToNum(m[2]); return (isNaN(yuan) ? 0 : yuan) + (isNaN(jiao) ? 0 : jiao) / 10; }
      return isNaN(yuan) ? 0 : yuan;
    }
    m = text.match(new RegExp('(' + CN + ')(毛|角)'));
    if (m) { const jiao = cnToNum(m[1]); return isNaN(jiao) ? 0 : jiao / 10; }
    m = text.match(new RegExp('(' + CN + ')'));
    if (m) { const v = cnToNum(m[1]); return isNaN(v) ? 0 : v; }
    return 0;
  }
  function parseVoice(text) {
    text = (text || '').trim();
    const res = { raw: text, type: 'exp', amount: 0, categoryId: null, accountId: DB.settings.default_account_id, toAccountId: null, note: text };
    if (!text) return res;
    if (/(工资|薪水|月薪|收入|到账|发了|收到|收|红包|赚|收益|退款|报销)/.test(text)) res.type = 'inc';
    else if (/(转给|转帐|转账|转至|转到|还给|还钱)/.test(text)) res.type = 'transfer';
    res.amount = extractAmount(text) || 0;
    const accByName = (kw) => DB.accounts.find(a => !a.is_hidden && a.name.indexOf(kw) >= 0);
    if (/微信/.test(text)) { const a = accByName('微信'); if (a) res.accountId = a.id; }
    else if (/支付宝/.test(text)) { const a = accByName('支付宝'); if (a) res.accountId = a.id; }
    else if (/现金|钱包/.test(text)) { const a = accByName('现金'); if (a) res.accountId = a.id; }
    else if (/卡|银行|工资卡/.test(text)) { const a = accByName('工资卡') || accByName('银行'); if (a) res.accountId = a.id; }
    if (res.type === 'transfer' && /微信/.test(text)) { const a = accByName('微信'); if (a) res.toAccountId = a.id; }
    const MAP = [
      ['餐饮', /(吃|饭|餐|午饭|早饭|晚饭|晚餐|面|粉|外卖|咖啡|奶茶|小吃|火锅|烧烤|食堂|包子|宵夜)/],
      ['交通', /(地铁|公交|打车|滴滴|出租|油|加油|高铁|火车|机票|车票|过路|停车|骑行)/],
      ['购物', /(买|购|淘宝|京东|衣服|鞋|包|超市|商城|数码|护肤)/],
      ['居住', /(房租|水电|物业|燃气|宽带|家居|装修)/],
      ['娱乐', /(电影|游戏|唱|KTV|ktv|玩|旅游|演出|门票|健身)/],
      ['医疗', /(药|医|看病|医院|挂号|保健|体检|牙)/],
      ['通讯', /(话费|流量|电话费|充值|宽带)/],
      ['工资', /(工资|薪水|月薪)/],
      ['红包', /(红包)/],
      ['理财', /(理财|基金|股票|收益|投资)/]
    ];
    for (const [name, re] of MAP) {
      if (re.test(text)) { const c = DB.categories.find(x => x.name === name && x.type === (res.type === 'inc' ? 'inc' : 'exp')); if (c) { res.categoryId = c.id; break; } }
    }
    if (!res.categoryId) { const fb = DB.categories.find(x => x.name === (res.type === 'inc' ? '其他收入' : '其他') && x.type === (res.type === 'inc' ? 'inc' : 'exp')); if (fb) res.categoryId = fb.id; }
    return res;
  }
  function openVoice() {
    openSheet($('#formModal'), `<h3>语音记账 <button class="x" data-close>×</button></h3>
      <div class="muted">说一句就行，例如「午饭 35 元」「微信收红包 200」「打车 28 到公司」。金额也支持中文口语，如「三十五块五」「两千」「五毛」。需授予麦克风权限并联网（语音识别走系统/云端识别服务）。</div>
      <div id="voiceText" class="muted" style="margin:12px 0;min-height:22px">点击下方开始说话…</div>
      <button class="btn" id="voiceBtn" style="width:100%">🎤 开始说话</button>
      <div id="voicePreview" style="margin-top:12px"></div>`);
    $('[data-close]', $('#formModal')).onclick = () => closeSheet($('#formModal'));
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    const txt = $('#voiceText', $('#formModal')), prev = $('#voicePreview', $('#formModal')), btn = $('#voiceBtn', $('#formModal'));
    let rec = null, listening = false;
    function renderPreview(p) {
      const ty = p.type === 'inc' ? '收入' : p.type === 'transfer' ? '转账' : '支出';
      const cat = p.categoryId && catById(p.categoryId) ? catById(p.categoryId).name : '未识别';
      const acc = p.accountId && accById(p.accountId) ? accById(p.accountId).name : '默认';
      prev.innerHTML = `<div class="card" style="padding:10px">
        <div style="font-weight:700;font-size:16px">${ty} ${money(p.amount)}</div>
        <div class="muted">分类：${cat} ｜ 账户：${acc}${p.type === 'transfer' && p.toAccountId && accById(p.toAccountId) ? ' → ' + accById(p.toAccountId).name : ''}</div>
        <div class="muted">备注：${p.raw}</div>
        <div class="row" style="margin-top:8px;gap:8px"><button class="btn" id="voiceOk">确认记账</button><button class="btn ghost" id="voiceAgain">重说</button></div>
      </div>`;
      $('#voiceOk', $('#formModal')).onclick = () => { if (!p.amount) { toast('没识别到金额'); return; } addTx({ type: p.type, amount: p.amount, category_id: p.categoryId, account_id: p.accountId, to_account_id: p.toAccountId, note: p.raw }); toast('已记一笔'); closeSheet($('#formModal')); };
      $('#voiceAgain', $('#formModal')).onclick = () => { prev.innerHTML = ''; txt.textContent = '点击下方开始说话…'; start(); };
    }
    function start() {
      if (!SR) { txt.textContent = '当前环境不支持语音识别（请用桌面版并授权麦克风）'; return; }
      try { rec = new SR(); } catch (e) { txt.textContent = '无法创建识别器：' + e.message; return; }
      rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
      rec.onresult = (e) => {
        let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
        txt.textContent = s;
        const last = e.results[e.results.length - 1];
        if (last && last.isFinal) renderPreview(parseVoice(s));
      };
      rec.onerror = (e) => { txt.textContent = '识别出错：' + ((e && e.error) || e); };
      rec.onend = () => { listening = false; btn.textContent = '🎤 开始说话'; };
      try { rec.start(); listening = true; btn.textContent = '聆听中…（点此停止）'; } catch (e) { txt.textContent = '无法启动：' + e.message; }
    }
    btn.onclick = () => { if (listening) { try { rec && rec.stop(); } catch (e) {} listening = false; btn.textContent = '🎤 开始说话'; } else start(); };
  }
  if (typeof window !== 'undefined' && window.Yiji) { window.Yiji.parseVoice = parseVoice; window.Yiji.openVoice = openVoice; window.Yiji.extractAmount = extractAmount; window.Yiji.cnToNum = cnToNum; window.Yiji.load = load; window.Yiji.reuseTx = reuseTx; window.Yiji.addTx = addTx; window.Yiji.getRec = () => rec; window.Yiji.listTx = () => DB.transactions; window.Yiji.cats = cats; window.Yiji.accounts = () => DB.accounts; window.Yiji.netWorth = netWorth; window.Yiji.budgetWarn = budgetWarn; window.Yiji.budgetAlerts = budgetAlerts; window.Yiji.setBudgetMute = (v) => { budgetMute = v; }; window.Yiji.budgets = () => DB.budgets; window.Yiji.curBookId = curBookId; window.Yiji.toggleFav = toggleFav; window.Yiji.favList = favList; window.Yiji.getBooks = () => DB.books.filter(b => !b.is_deleted); window.Yiji.getBook = getBook; window.Yiji.switchBook = switchBook; window.Yiji.createBook = createBook; window.Yiji.bookNetWorth = bookNetWorth; window.Yiji.bookTxCount = bookTxCount; window.Yiji.budgetBanner = budgetBanner; window.Yiji.openFavEdit = openFavEdit; window.Yiji.openRec = openRec; window.Yiji.renderHome = renderHome;
window.Yiji.setFlowFilter = (type, q) => { flowType = type; flowSearch = q || ''; renderFlowList(); };
window.Yiji.flowListHtml = () => { const b = $('#flowList'); return b ? b.innerHTML : ''; };
window.Yiji.nav = nav; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
