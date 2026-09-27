/*! 房间销毁器 loader */
(function () {
  'use strict';

  if (window.__IIROSE_ROOMDESTROY__ || window.__IIROSE_ROOMDESTROY_LOADER__) {
    try { console.log('[房间销毁器/loader] 已在运行，跳过'); } catch (e) { }
    return;
  }

  var MAIN = 'src/iirose-roomdestroy.js';
  var REPO = 'Northseacaviar/iirose-roomdestroy';
  var HOSTS = ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net'];
  var TIMEOUT = 6000;
  var STATE = { self: '', candidates: [], probes: [], chosen: '', error: '' };
  try { window.__IIROSE_ROOMDESTROY_LOADER__ = STATE; } catch (e) { }

  function selfUrl() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/loader\.js(\?|$)/.test(all[i].src || '')) { s = all[i]; break; }
      }
    }
    return (s && s.src) || '';
  }

  STATE.self = selfUrl();
  var base = STATE.self ? STATE.self.replace(/[^/]*$/, '') : 'https://cdn.jsdelivr.net/gh/' + REPO + '/';
  var dir = base.replace(/\/$/, '');
  var pinned = /@[^\/]+\/?$/.test(dir);            // 自己就被钉在某个版本上时，同目录取，不猜版本

  function candidates() {
    if (pinned) return [base + MAIN];
    var list = [dir + '/' + MAIN, dir + '@main/' + MAIN];
    var host = (base.match(/^https?:\/\/([^/]+)\//) || [])[1];
    HOSTS.forEach(function (h) {
      if (h === host) return;
      list.push('https://' + h + '/gh/' + REPO + '/' + MAIN);
      list.push('https://' + h + '/gh/' + REPO + '@main/' + MAIN);
    });
    var seen = {}, out = [];
    list.forEach(function (u) { if (!seen[u]) { seen[u] = 1; out.push(u); } });
    return out;
  }

  function getText(url, cb) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(null); } }, TIMEOUT);
    function finish(t) { if (done) return; done = true; clearTimeout(timer); cb(t); }
    try {
      fetch(url, { cache: 'no-store', credentials: 'omit' })
        .then(function (r) { return r.text(); }).then(finish).catch(function () { finish(null); });
    } catch (e) { finish(null); }
  }

  function ver(txt) { return ((txt || '').match(/const VERSION = '([^']+)'/) || [])[1] || null; }
  function cmp(a, b) {
    var x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; }
    return 0;
  }

  function inject(url, next, onOk) {
    var s = document.createElement('script');
    s.async = true;
    s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    s.onload = function () { if (onOk) onOk(s.src); };
    s.onerror = function () { if (next) next(); };
    (document.head || document.documentElement).appendChild(s);
  }

  function runSequential(list, i) {
    if (i >= list.length) {
      STATE.error = '所有地址都加载失败（网络被拦或 CDN 不可达）';
      try { console.warn('[房间销毁器/loader] ' + STATE.error); } catch (e) { }
      return;
    }
    inject(list[i], function () { runSequential(list, i + 1); }, function (src) {
      STATE.chosen = src;
      try { console.log('[房间销毁器/loader] 就绪：v' + ((window.__IIROSE_ROOMDESTROY__ && window.__IIROSE_ROOMDESTROY__.version) || '?') + ' ← ' + src); } catch (e) { }
    });
  }

  var list = candidates();
  STATE.candidates = list;
  if (list.length === 1) return runSequential(list, 0);

  var left = list.length, ok = [];
  list.forEach(function (url) {
    getText(url, function (txt) {
      var v = ver(txt);
      STATE.probes.push({ url: url, ver: v, ok: !!txt });
      if (txt) ok.push({ url: url, ver: v });
      if (--left === 0) {
        var best = null;
        ok.forEach(function (c) { if (!best || cmp(c.ver, best.ver) > 0) best = c; });
        if (best && best.ver) inject(best.url, function () { runSequential(list, 0); }, function (src) { STATE.chosen = src; });
        else runSequential(list, 0);
      }
    });
  });
})();
