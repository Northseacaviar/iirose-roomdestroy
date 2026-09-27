/* 房间销毁器 · 趣味插件
 *
 * 点右下角那个 💥，页面弹一张「<房间名>   已被销毁」。
 *
 * 纯本地玩笑：只调用页面已有的提示接口，不发送任何请求，不影响别人。
 * 房名取站点记录的「类型_房名」（例如 社区_空间站、住宅_浅醉），取不到时退用房号。
 * 指定房名：__IIROSE_ROOMDESTROY__.popTip('住宅_某家')
 * 卸载：__IIROSE_ROOMDESTROY__.unmount()
 */
(function () {
  'use strict';

  const VERSION = '0.4.0';
  const VERSION_CODE = 4;          // 官方规范：数字版本号，每次发布递增 1
  const TAG = '[房间销毁器]';
  try { window.__IIROSE_ROOMDESTROY_VERSION__ = VERSION; } catch (e) { }

  // #region CORE
  const DESTROY_TIP_TEXT = '*   已被销毁';      // 站点原句，'*' 处换成房名（含 HTML，站点自己会渲染）
  const NOTICE_TAG = '\n[趣味插件 · 非官方通知]';   // 固定角标，不可配置
  const FAB_ID = 'iirose-roomdestroy-fab';
  const BOX_ID = 'iirose-roomdestroy-box';
  const POS_KEY = 'iirose_roomdestroy_pos';
  const FAB_SIZE = 46;

  /* HTML 转义：房名一律当纯文本 */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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
    const safe = escapeHtml(raw);
    let name = '';
    if (typeof tplFn === 'function') {
      try { name = String(tplFn(29, safe)); } catch (e) { name = ''; }
    }
    if (!name) name = '「' + safe + '」';
    return DESTROY_TIP_TEXT.replace('*', name) + NOTICE_TAG;
  }

  /* 悬浮球摆位夹取：别让它跑出可视区（窄屏/横竖屏切换都算） */
  function clampPos(x, y, size, vw, vh) {
    const maxX = Math.max(0, (vw || 0) - size);
    const maxY = Math.max(0, (vh || 0) - size);
    return { left: Math.min(Math.max(0, x || 0), maxX), top: Math.min(Math.max(0, y || 0), maxY) };
  }

  /* 房号形态：站点 id 是 13 位十六进制 */
  function looksLikeRid(v) { return /^[0-9a-f]{13}$/i.test(String(v == null ? '' : v).trim()); }

  /* 提示音开关：本机偏好，默认开（存 "0" 表示关） */
  function soundOnPref(raw) { return String(raw == null || raw === '' ? '1' : raw) !== '0'; }

  /* 把"用户输入"变成站内那个完整房名，一律查表、查不到就拒绝：
   *   房号   → 查站内房间表，命中就用「类型_房名」
   *   带前缀 → 表里存在全名才认（住宅_浅醉）
   *   裸名字 → 表里按 "_" 后半段匹配，命中就补前缀（浅醉 → 住宅_浅醉）
   *   查不到 → 返回空串，由调用方拒绝
   */
  function resolveRoomName(input, deps) {
    deps = deps || {};
    const names = deps.roomNames || null;
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return '';
    if (looksLikeRid(raw)) return (names && names[raw]) ? String(names[raw]) : '';
    if (!names) return '';
    const key = raw.toLowerCase();
    for (const id in names) {
      if (!Object.prototype.hasOwnProperty.call(names, id)) continue;
      const full = String(names[id] || '');
      const cut = full.lastIndexOf('_');
      const tail = cut > 0 ? full.substr(cut + 1) : full;
      if (full.toLowerCase() === key || tail.toLowerCase() === key) return full;
    }
    return '';
  }
  // #endregion

  /* ========================== 运行时 ========================== */
  const G = (function () { try { return window; } catch (e) { return {}; } })();

  function warn(where, e) { try { console.warn(TAG, where, e && e.message ? e.message : e); } catch (_) { } }

  /* 读站内状态：cookie + 房间表 + 当前房 */
  function currentDeps() {
    return {
      cookieFn: (typeof Cookie === 'function') ? Cookie : null,
      roomNames: (G.Objs && G.Objs.mapHolder && G.Objs.mapHolder.Assets) ? G.Objs.mapHolder.Assets.roomNameJson : null,
      roomn: (typeof roomn !== 'undefined') ? roomn : '',
    };
  }

  /* ---------- 提示音 ---------- */
  const SOUND_KEY = 'iirose_roomdestroy_sound';
  const SITE_SOUND = 'mail';          // 站点自己的信箱消息提示音

  function soundOn() { try { return soundOnPref(localStorage.getItem(SOUND_KEY)); } catch (e) { return true; } }
  function setSound(on) { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) { } return !!on; }

  function synthDing() {                      // 兜底：自己合成一声"叮"（站内音取不到时）
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const t0 = ctx.currentTime;
      [1318.5, 1975.5].forEach(function (f, i) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * 0.06);
        g.gain.linearRampToValueAtTime(i ? 0.09 : 0.14, t0 + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + 0.45);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + i * 0.06); o.stop(t0 + i * 0.06 + 0.5);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) { } }, 900);
      return true;
    } catch (e) { return false; }
  }

  /* 弹的时候叮一声：优先用站内自己的系统提示音，取不到再合成 */
  function ding() {
    if (!soundOn()) return 'muted';
    try {
      if (typeof Utils !== 'undefined' && Utils.Resource && typeof Utils.Resource.notiSound === 'function') {
        Utils.Resource.notiSound(SITE_SOUND);
        return 'site';
      }
    } catch (e) { warn('站内提示音失败', e); }
    return synthDing() ? 'synth' : 'none';
  }

  /* 拿一个房名去弹（拼文本 → 调站点自己的提示通道 → 叮一声） */
  function popRaw(raw) {
    const text = destroyTipText(raw, (typeof Mod !== 'undefined' && Mod.template) ? Mod.template : null);
    let ok = false, err = '';
    try {
      if (typeof Utils === 'undefined' || !Utils.sync) err = 'Utils.sync 不可用（站点结构变了？）';
      else { Utils.sync(0, text); ok = true; }
    } catch (e) { err = String(e && e.message ? e.message : e); }
    const sound = ok ? ding() : 'none';
    return { raw: raw, text: text, ok: ok, err: err, sound: sound };
  }

  /* 弹当前房 */
  function destroyRoomTip() { return popRaw(destroyTipRawName(currentDeps())); }

  /* 弹指定房间：房号、带前缀的名字、裸名字都收；空 = 当前房 */
  function popTip(input) {
    const want = String(input == null ? '' : input).trim();
    if (!want) return destroyRoomTip();
    const name = resolveRoomName(want, currentDeps());
    if (!name) return { raw: '', text: '', ok: false, err: '没这个房间：' + want, sound: 'none' };
    return popRaw(name);
  }

  /* ========================== 界面 ========================== */
  let fab = null, toast = null, toastTimer = null, drag = null, box = null, input = null, hint = null;
  let lastPointerType = '';

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

    /* 输入框：右键 / 长按悬浮球打开，填房号或房名 */
    box = document.createElement('div');
    box.id = BOX_ID;
    box.setAttribute('data-roomdestroy', '1');
    box.style.cssText = 'position:fixed;z-index:2147483002;display:none;width:288px;padding:9px;background:rgba(20,20,24,.97);'
      + 'border:1px solid #3a3b44;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);'
      + 'font:12px/1.5 system-ui,"Microsoft YaHei",sans-serif;color:#ddd;';
    input = document.createElement('input');
    input.setAttribute('data-roomdestroy', '1');
    input.placeholder = '房号，或房名（浅醉 / 住宅_浅醉）';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;background:#101014;border:1px solid #444;'
      + 'border-radius:6px;color:#eee;font:12px/1.5 system-ui,"Microsoft YaHei",sans-serif;outline:none;';
    hint = document.createElement('div');
    hint.style.cssText = 'padding:6px 2px 7px;color:#8b8b93;font-size:11px;word-break:break-all;';
    const boxRow = document.createElement('div');
    boxRow.style.cssText = 'display:flex;gap:6px;';
    const okBtn = document.createElement('button');
    okBtn.textContent = '弹';
    okBtn.style.cssText = 'flex:1;padding:6px;background:#3a1f1f;color:#ff9d9d;border:1px solid #5a2a2a;border-radius:6px;cursor:pointer;font-weight:700;';
    const noBtn = document.createElement('button');
    noBtn.textContent = '取消';
    noBtn.style.cssText = 'flex:1;padding:6px;background:#2a2b33;color:#c9c9d0;border:1px solid #3a3b44;border-radius:6px;cursor:pointer;';
    boxRow.appendChild(okBtn); boxRow.appendChild(noBtn);
    box.appendChild(input); box.appendChild(hint); box.appendChild(boxRow);

    document.body.appendChild(fab);
    document.body.appendChild(toast);
    document.body.appendChild(box);

    input.addEventListener('input', updateHint);
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); submitInput(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeInput(); }
    });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    box.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    okBtn.addEventListener('click', function (e) { e.stopPropagation(); submitInput(); });
    noBtn.addEventListener('click', function (e) { e.stopPropagation(); closeInput(); });
    document.addEventListener('pointerdown', onDocDown, true);

    const p = readPos();
    applyPos(p.defaulted ? defaultPos() : p);
    const coarse = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    showToast(coarse ? '已就位：点我 = 输入房号 · 长按 2 秒 = 销毁当前房'
                     : '已就位：左键 = 销毁当前房 · 右键 = 输入房号', '#9ad0a0');

    /* 拖动 + 动作（站点会吞默认点击，所以在 pointerup 里判定）
     * 鼠标：左键 = 弹当前房；右键 = 输入房号（右键不弹、不销毁）
     * 触屏：点 = 输入房号；长按 2 秒 = 弹当前房
     */
    fab.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      lastPointerType = e.pointerType || '';
      if (e.button > 0) return;                  // 右键/中键：既不拖也不动作
      drag = {
        x: e.clientX, y: e.clientY, l: parseFloat(fab.style.left) || 0, t: parseFloat(fab.style.top) || 0,
        moved: 0, held: 0, touch: e.pointerType === 'touch',
      };
      try { fab.setPointerCapture(e.pointerId); } catch (_) { }
      drag.holdTimer = setTimeout(function () {   // 触屏长按 2 秒 = 销毁；鼠标长按 = 输入房号
        if (!drag || drag.moved >= 4) return;
        drag.held = 1;
        if (drag.touch) fire(); else openInput();
      }, drag.touch ? 2000 : 550);
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
      const moved = drag.moved, held = drag.held, touch = drag.touch;
      if (drag.holdTimer) clearTimeout(drag.holdTimer);
      drag = null;
      if (held) return;                          // 长按已经动作过了，别再补一次
      if (moved < 4) { if (touch) openInput(); else fire(); }   // 触屏点 = 输入房号；鼠标左键 = 销毁当前房
      else { const p = { left: parseFloat(fab.style.left) || 0, top: parseFloat(fab.style.top) || 0 }; writePos(p); showToast('摆位已记住', '#9ad0a0'); }
      if (toast) {
        const p = { left: parseFloat(fab.style.left) || 0, top: parseFloat(fab.style.top) || 0 };
        toast.style.left = Math.min(Math.max(4, p.left - 110), Math.max(4, window.innerWidth - 270)) + 'px';
        toast.style.top = Math.max(4, p.top - 34) + 'px';
      }
    });
    fab.addEventListener('pointercancel', function () { if (drag && drag.holdTimer) clearTimeout(drag.holdTimer); drag = null; });
    fab.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (lastPointerType === 'touch') return;   // 触屏长按也会冒 contextmenu，别抢长按的活
      openInput();
    });
    fab.addEventListener('click', function (e) { e.stopPropagation(); });   // 真正的动作在 pointerup
    window.addEventListener('resize', keepInView);
    return true;
  }

  function onDocDown(e) {
    if (!box || box.style.display === 'none') return;
    const t = e.target;
    if (t && (t === box || (t.closest && t.closest('#' + FAB_ID)) || (box.contains && box.contains(t)))) return;
    closeInput();
  }

  function openInput() {
    if (!box || !fab) return;
    const p = { left: parseFloat(fab.style.left) || 0, top: parseFloat(fab.style.top) || 0 };
    box.style.display = 'block';
    box.style.left = Math.min(Math.max(4, p.left - 150), Math.max(4, window.innerWidth - 296)) + 'px';
    box.style.top = Math.max(4, p.top - 104) + 'px';
    if (input) { input.value = ''; try { input.focus(); } catch (e) { } }
    updateHint();
  }

  function closeInput() { if (box) box.style.display = 'none'; }

  function updateHint() {
    if (!hint) return;
    const v = input ? input.value.trim() : '';
    if (!v) { hint.textContent = '空 = 当前房：' + (destroyTipRawName(currentDeps()) || '(取不到)'); return; }
    const name = resolveRoomName(v, currentDeps());
    hint.textContent = name ? ('将弹：' + name) : ('没这个房间：' + v);
  }

  function submitInput() {
    const v = input ? input.value : '';
    const r = popTip(v);
    if (r.ok) log('弹提示（输入）', JSON.stringify(r.raw) + ' → 提示音=' + r.sound);
    else showToast('失败：' + r.err, '#d98a86');
    closeInput();
    return r;
  }

  function destroy() {
    try { if (fab && fab.parentNode) fab.parentNode.removeChild(fab); } catch (e) { }
    try { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch (e) { }
    try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (e) { }
    try { document.removeEventListener('pointerdown', onDocDown, true); } catch (e) { }
    fab = null; toast = null; box = null; input = null; hint = null; drag = null;
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
    popTip: popTip,                     // 弹指定房：房号 / 房名都行，空 = 当前房
    openInput: openInput,               // 打开输入框（等同右键/长按悬浮球）
    setSound: setSound,                 // setSound(false) 关掉提示音
    soundOn: soundOn,
    _diag: {
      destroyTipRawName: destroyTipRawName,
      destroyTipText: destroyTipText,
      clampPos: clampPos,
      looksLikeRid: looksLikeRid,
      resolveRoomName: resolveRoomName,
      escapeHtml: escapeHtml,
      NOTICE_TAG: NOTICE_TAG,
      soundOnPref: soundOnPref,
      currentRoomName: function () { return destroyTipRawName(currentDeps()); },
      currentDeps: currentDeps,
      ding: ding,
    },
  };
})();
