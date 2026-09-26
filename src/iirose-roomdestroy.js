/* 房间销毁器 · 趣味插件（独立小玩意，跟拉黑屏蔽没有关系）
 *
 * 只做一件事：点右下角那个 💥，用站点自己的提示弹一张「房间名   已被销毁」。
 *
 * 说清楚它是什么：
 *   - 纯本地玩笑。它只调用站点自己的 Utils.sync（messages.js:16762 就是那一行），
 *     只有执行它的这个客户端会弹；不向服务器发送任何数据，也不会影响别人的房间。
 *   - 房名按站内方式取：Cookie("roomname") 的值本来就是「类型_房名」，
 *     例如 社区_空间站、住宅_浅醉 —— 所以前缀（房间类型）是站点给的，不用手填。
 *   - 想让它说什么就说什么？控制台：__IIROSE_ROOMDESTROY__.popTip('住宅_某家')
 *
 * 卸载：__IIROSE_ROOMDESTROY__.unmount()，或删掉注入脚本后刷新页面。
 */
(function () {
  'use strict';

  const VERSION = '0.1.0';
  const VERSION_CODE = 1;          // 官方规范：数字版本号，每次发布递增 1
  const TAG = '[房间销毁器]';
  try { window.__IIROSE_ROOMDESTROY_VERSION__ = VERSION; } catch (e) { }

  // #region CORE
  const DESTROY_TIP_TEXT = '*   已被销毁';      // 站点原句，'*' 处换成房名（含 HTML，站点自己会渲染）
  const FAB_ID = 'iirose-roomdestroy-fab';
  const POS_KEY = 'iirose_roomdestroy_pos';
  const FAB_SIZE = 46;

  /* 取"类型_房名"：Cookie("roomname") → 站内房间表 roomNameJson[当前房] → 房号兜底 */
  function destroyTipRawName(deps) {
    deps = deps || {};
    const names = deps.roomNames || null;
    const rn = deps.roomn ? String(deps.roomn) : '';
    let v = '';
    if (typeof deps.cookieFn === 'function') {
      try { v = String(deps.cookieFn('roomname') || ''); } catch (e) { v = ''; }
    }
    if (!v && names && rn && names[rn]) v = String(names[rn]);
    if (!v && rn) v = rn;
    return v;
  }

  /* 拼出站点那一行提示文本；不传模板函数（或它抛错）时退化成「房名」 */
  function destroyTipText(raw, tplFn) {
    let name = '';
    if (typeof tplFn === 'function') {
      try { name = String(tplFn(29, String(raw))); } catch (e) { name = ''; }
    }
    if (!name) name = '「' + String(raw) + '」';
    return DESTROY_TIP_TEXT.replace('*', name);
  }

  /* 悬浮球摆位夹取：别让它跑出可视区（窄屏/横竖屏切换都算） */
  function clampPos(x, y, size, vw, vh) {
    const maxX = Math.max(0, (vw || 0) - size);
    const maxY = Math.max(0, (vh || 0) - size);
    return { left: Math.min(Math.max(0, x || 0), maxX), top: Math.min(Math.max(0, y || 0), maxY) };
  }
  // #endregion

  /* ========================== 运行时 ========================== */
  const G = (function () { try { return window; } catch (e) { return {}; } })();

  function warn(where, e) { try { console.warn(TAG, where, e && e.message ? e.message : e); } catch (_) { } }

  /* 真·实现：读站内状态 → 拼文本 → 调站点自己的提示通道 */
  function destroyRoomTip() {
    const deps = {
      cookieFn: (typeof Cookie === 'function') ? Cookie : null,
      roomNames: (G.Objs && G.Objs.mapHolder && G.Objs.mapHolder.Assets) ? G.Objs.mapHolder.Assets.roomNameJson : null,
      roomn: (typeof roomn !== 'undefined') ? roomn : '',
    };
    const raw = destroyTipRawName(deps);
    const text = destroyTipText(raw, (typeof Mod !== 'undefined' && Mod.template) ? Mod.template : null);
    let ok = false, err = '';
    try {
      if (typeof Utils === 'undefined' || !Utils.sync) err = 'Utils.sync 不可用（站点结构变了？）';
      else { Utils.sync(0, text); ok = true; }
    } catch (e) { err = String(e && e.message ? e.message : e); }
    return { raw: raw, text: text, ok: ok, err: err };
  }

  /* 手动指定房名（控制台小玩具） */
  function popTip(name) {
    const text = destroyTipText(String(name == null ? '' : name), (typeof Mod !== 'undefined' && Mod.template) ? Mod.template : null);
    let ok = false, err = '';
    try {
      if (typeof Utils === 'undefined' || !Utils.sync) err = 'Utils.sync 不可用';
      else { Utils.sync(0, text); ok = true; }
    } catch (e) { err = String(e && e.message ? e.message : e); }
    return { raw: String(name == null ? '' : name), text: text, ok: ok, err: err };
  }

  /* ========================== 界面 ========================== */
  let fab = null, toast = null, toastTimer = null, drag = null;

  function readPos() {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (v && typeof v.left === 'number' && typeof v.top === 'number') return v;
    } catch (e) { }
    return { left: 0, top: 0, defaulted: 1 };
  }
  function writePos(p) { try { localStorage.setItem(POS_KEY, JSON.stringify({ left: p.left, top: p.top })); } catch (e) { } }

  function defaultPos() {
    return clampPos(window.innerWidth - FAB_SIZE - 12, window.innerHeight - FAB_SIZE - 96, FAB_SIZE, window.innerWidth, window.innerHeight);
  }

  function applyPos(p) {
    if (!fab) return;
    fab.style.left = p.left + 'px';
    fab.style.top = p.top + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }

  function keepInView() {
    if (!fab) return;
    const p = clampPos(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0, FAB_SIZE, window.innerWidth, window.innerHeight);
    applyPos(p);
  }

  function showToast(msg, color) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.color = color || '#ddd';
    toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toast) toast.style.display = 'none'; }, 1800);
  }

  function fire() {
    const r = destroyRoomTip();
    if (r.ok) log('弹提示', JSON.stringify(r.raw) + ' → ' + JSON.stringify(r.text));
    else { warn('弹提示失败', r.err); showToast('失败：' + r.err, '#d98a86'); }
    return r;
  }

  function log(what, detail) { try { console.log(TAG, what, detail === undefined ? '' : detail); } catch (e) { } }

  function build() {
    if (document.getElementById(FAB_ID)) return false;

    fab = document.createElement('div');
    fab.id = FAB_ID;
    fab.setAttribute('data-roomdestroy', '1');
    fab.title = '销毁当前房间（趣味 · 站内原生提示）';
    fab.textContent = '💥';
    const st = fab.style;
    st.position = 'fixed'; st.zIndex = '2147483000'; st.width = st.height = FAB_SIZE + 'px';
    st.borderRadius = '50%'; st.background = 'rgba(58,31,31,.92)'; st.border = '1px solid #5a2a2a';
    st.color = '#ff9d9d'; st.fontSize = '20px'; st.lineHeight = FAB_SIZE + 'px'; st.textAlign = 'center';
    st.cursor = 'pointer'; st.userSelect = 'none'; st.webkitUserSelect = 'none';
    st.boxShadow = '0 4px 14px rgba(0,0,0,.45)'; st.touchAction = 'none';

    toast = document.createElement('div');
    toast.setAttribute('data-roomdestroy', '1');
    toast.style.cssText = 'position:fixed;z-index:2147483001;display:none;padding:6px 9px;background:rgba(20,20,24,.94);'
      + 'border:1px solid #3a3b44;border-radius:6px;font:12px/1.5 system-ui,"Microsoft YaHei",sans-serif;color:#ddd;'
      + 'max-width:260px;word-break:break-all;';
    document.body.appendChild(fab);
    document.body.appendChild(toast);

    const p = readPos();
    applyPos(p.defaulted ? defaultPos() : p);
    showToast('已就位：点我 = 销毁当前房间', '#9ad0a0');

    /* 拖动 + 点击（站点会吞掉默认点击，所以在 pointerup 里判定） */
    fab.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, l: parseFloat(fab.style.left) || 0, t: parseFloat(fab.style.top) || 0, moved: 0 };
      try { fab.setPointerCapture(e.pointerId); } catch (_) { }
    });
    fab.addEventListener('pointermove', function (e) {
      if (!drag) return;
      e.stopPropagation();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      applyPos(clampPos(drag.l + dx, drag.t + dy, FAB_SIZE, window.innerWidth, window.innerHeight));
    });
    fab.addEventListener('pointerup', function (e) {
      if (!drag) return;
      e.stopPropagation();
      const moved = drag.moved; drag = null;
      if (moved < 4) fire();
      else { const p = { left: parseFloat(fab.style.left) || 0, top: parseFloat(fab.style.top) || 0 }; writePos(p); showToast('摆位已记住', '#9ad0a0'); }
      if (toast) {
        const p = { left: parseFloat(fab.style.left) || 0, top: parseFloat(fab.style.top) || 0 };
        toast.style.left = Math.min(Math.max(4, p.left - 110), Math.max(4, window.innerWidth - 270)) + 'px';
        toast.style.top = Math.max(4, p.top - 34) + 'px';
      }
    });
    fab.addEventListener('pointercancel', function () { drag = null; });
    fab.addEventListener('click', function (e) { e.stopPropagation(); });   // 真正的动作在 pointerup
    window.addEventListener('resize', keepInView);
    return true;
  }

  function destroy() {
    try { if (fab && fab.parentNode) fab.parentNode.removeChild(fab); } catch (e) { }
    try { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch (e) { }
    fab = null; toast = null; drag = null;
    try { window.removeEventListener('resize', keepInView); } catch (e) { }
  }

  /* 站点会重绘 DOM，按钮被抹掉就补回来（1 次/2 秒，代价可以忽略） */
  let watchdog = null;
  function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(function () {
      try { if (document.body && !document.getElementById(FAB_ID)) { destroy(); build(); } } catch (e) { }
    }, 2000);
  }

  function boot() {
    try { build(); startWatchdog(); } catch (e) { warn('boot', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ========================== 对外入口 ========================== */
  if (!window.__IIROSE_ROOMDESTROY__) window.__IIROSE_ROOMDESTROY__ = {
    version: VERSION,
    versionCode: VERSION_CODE,
    mount: boot,
    unmount: function () { destroy(); if (watchdog) { clearInterval(watchdog); watchdog = null; } },
    destroyRoomTip: destroyRoomTip,     // 弹当前房
    popTip: popTip,                     // 指定房名
    _diag: {
      destroyTipRawName: destroyTipRawName,
      destroyTipText: destroyTipText,
      clampPos: clampPos,
      currentRoomName: function () {
        return destroyTipRawName({
          cookieFn: (typeof Cookie === 'function') ? Cookie : null,
          roomNames: (G.Objs && G.Objs.mapHolder && G.Objs.mapHolder.Assets) ? G.Objs.mapHolder.Assets.roomNameJson : null,
          roomn: (typeof roomn !== 'undefined') ? roomn : '',
        });
      },
    },
  };
})();
