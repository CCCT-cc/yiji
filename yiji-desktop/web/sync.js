/* 一记 · 云端同步前端模块（无依赖，配合 yiji-server 使用）
 * 暴露 window.YijiSync：open() 打开面板 / isLoggedIn() / account()
 * 数据通过 yiji-server 加密存储，前端只负责上传/拉取与合并。
 */
(function () {
  'use strict';
  var LS_KEY = 'yiji_cloud_v1';
  var DEFAULT_URL = 'http://localhost:8787';

  function cloud() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
  function setCloud(o) { if (o) localStorage.setItem(LS_KEY, JSON.stringify(o)); else localStorage.removeItem(LS_KEY); }
  function baseUrl() { var c = cloud(); return (c && c.url) || DEFAULT_URL; }
  function Y() { return window.Yiji; }
  function box() { return document.getElementById('formModal'); }

  function api(path, opts, base) {
    var url = (base || baseUrl()).replace(/\/+$/, '') + path;
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body && body.error) || ('请求失败 ' + res.status));
        return body;
      });
    });
  }

  function headers(token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function isLoggedIn() { var c = cloud(); return !!(c && c.token); }
  function account() { var c = cloud(); return c ? c.email : ''; }

  function push() {
    var c = cloud();
    if (!c || !c.token) throw new Error('未登录');
    var DB = Y().getDB();
    var ledger = JSON.stringify(DB);
    return api('/api/sync/', { method: 'PUT', headers: headers(c.token), body: JSON.stringify({ ledger: ledger }) }).then(function () {
      DB.settings.last_sync_at = Date.now();
      Y().setDB(DB); Y().save();
    });
  }

  function pull() {
    var c = cloud();
    if (!c || !c.token) throw new Error('未登录');
    return api('/api/sync/', { method: 'GET', headers: headers(c.token) }).then(function (r) {
      if (!r.exists) return false;
      var remote = JSON.parse(r.ledger);
      var local = Y().getDB();
      var merged = Y().mergeDB(JSON.parse(JSON.stringify(local)), remote);
      merged.settings.last_sync_at = r.updatedAt || Date.now();
      Y().setDB(merged); Y().save();
      return true;
    });
  }

  function syncNow() {
    if (!isLoggedIn()) throw new Error('请先登录');
    return push().then(function () { return pull(); }).then(function () {
      Y().toast('已同步到云端');
      Y().nav('home');
    });
  }

  function register(email, password, url) {
    return api('/api/auth/register', { method: 'POST', headers: headers(), body: JSON.stringify({ email: email, password: password }) }, url)
      .then(function (r) {
        setCloud({ token: r.token, email: email, syncSalt: r.syncSalt, url: url });
        return push().then(function () { return r.user; });
      });
  }

  function login(email, password, url) {
    return api('/api/auth/login', { method: 'POST', headers: headers(), body: JSON.stringify({ email: email, password: password }) }, url)
      .then(function (r) {
        setCloud({ token: r.token, email: email, syncSalt: r.syncSalt, url: url });
        return r.user;
      });
  }

  function logout() {
    var c = cloud();
    if (c && c.token) { try { api('/api/auth/logout', { method: 'POST', headers: headers(c.token) }); } catch (e) {} }
    setCloud(null);
  }

  function openAuth() {
    var c = cloud() || {};
    var html = ''
      + '<h3>云端同步 · 一记账号 <button class="x" data-close>×</button></h3>'
      + '<div class="muted">登录后账本会加密备份到你的专属云端，换手机 / 重装 / 清档都能一键找回。数据仅你可见。</div>'
      + '<label class="lbl">同步服务器地址</label>'
      + '<input class="field" id="cy_url" value="' + (c.url || DEFAULT_URL) + '" placeholder="http://localhost:8787">'
      + '<label class="lbl">邮箱</label>'
      + '<input class="field" id="cy_email" value="' + (c.email || '') + '" placeholder="you@example.com">'
      + '<label class="lbl">密码（至少 6 位，登录注册共用）</label>'
      + '<input class="field" id="cy_pass" type="password" placeholder="设置或输入密码">'
      + '<div class="form-actions">'
      + '  <button class="btn" id="cy_login">登录</button>'
      + '  <button class="btn ghost" id="cy_reg">注册新账号</button>'
      + '</div>';
    Y().openSheet(box(), html);
    var b = box();
    b.querySelector('.x[data-close]').onclick = function () { Y().closeSheet(box()); };
    b.querySelector('#cy_login').onclick = function () {
      var url = b.querySelector('#cy_url').value.trim();
      var email = b.querySelector('#cy_email').value.trim();
      var pw = b.querySelector('#cy_pass').value;
      login(email, pw, url).then(function () {
        Y().toast('登录成功');
        return pull().then(function () { Y().toast('已从云端载入账本'); Y().nav('home'); }).catch(function () {});
      }).then(openDashboard).catch(function (e) { Y().toast('登录失败：' + e.message); });
    };
    b.querySelector('#cy_reg').onclick = function () {
      var url = b.querySelector('#cy_url').value.trim();
      var email = b.querySelector('#cy_email').value.trim();
      var pw = b.querySelector('#cy_pass').value;
      if (pw.length < 6) { Y().toast('密码至少 6 位'); return; }
      register(email, pw, url).then(function () {
        Y().toast('注册成功，已上传当前账本');
      }).then(openDashboard).catch(function (e) { Y().toast('注册失败：' + e.message); });
    };
  }

  function openDashboard() {
    var c = cloud();
    if (!c || !c.token) return openAuth();
    var html = ''
      + '<h3>云端同步 <button class="x" data-close>×</button></h3>'
      + '<div class="muted">已登录：<b>' + (c.email || '') + '</b></div>'
      + '<div class="muted">服务器：' + (c.url || DEFAULT_URL) + '</div>'
      + '<button class="btn" id="cy_sync">立即同步（上传并拉取）</button>'
      + '<button class="btn ghost" id="cy_pull">仅从云端恢复</button>'
      + '<button class="btn danger" id="cy_out">退出登录</button>';
    Y().openSheet(box(), html);
    var b = box();
    b.querySelector('.x[data-close]').onclick = function () { Y().closeSheet(box()); };
    b.querySelector('#cy_sync').onclick = function () {
      syncNow().then(function () { Y().closeSheet(box()); }).catch(function (e) { Y().toast('同步失败：' + e.message); });
    };
    b.querySelector('#cy_pull').onclick = function () {
      pull().then(function (ok) {
        Y().toast(ok ? '已从云端恢复' : '云端暂无备份');
        Y().closeSheet(box()); Y().nav('home');
      }).catch(function (e) { Y().toast('恢复失败：' + e.message); });
    };
    b.querySelector('#cy_out').onclick = function () {
      logout(); Y().toast('已退出登录'); openAuth();
    };
  }

  function open() { if (isLoggedIn()) openDashboard(); else openAuth(); }

  window.YijiSync = { open: open, isLoggedIn: isLoggedIn, account: account, syncNow: syncNow, push: push, pull: pull, login: login, register: register, logout: logout };
})();
