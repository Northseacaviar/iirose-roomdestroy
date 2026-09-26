// 单测：把插件源码 // #region CORE 段抽出来，在 Node vm 里跑真实源码（不复制实现）。
// 用法：node tests/core.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'iirose-roomdestroy.js');
const EXPORTS = ['DESTROY_TIP_TEXT', 'destroyTipRawName', 'destroyTipText', 'clampPos', 'FAB_SIZE'];

function loadCore() {
  const src = fs.readFileSync(SRC, 'utf8');
  const m = src.match(/\/\/ #region CORE([\s\S]*?)\/\/ #endregion/);
  if (!m) { console.error('未找到 // #region CORE 段'); process.exit(1); }
  const sandbox = { console, Date, JSON, Object, Array, String, Number, RegExp, Math };
  vm.createContext(sandbox);
  vm.runInContext(m[1] + '\n__exp = {' + EXPORTS.join(',') + '};', sandbox);
  const L = sandbox.__exp;
  const missing = EXPORTS.filter((n) => !(n in L));
  if (missing.length) { console.error('CORE 导出缺失:', missing.join(', ')); process.exit(1); }
  return L;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra === undefined ? '' : '   [' + extra + ']')); }
}

const L = loadCore();
const tpl = (i, x) => (i === 29 ? '<b>' + x + '</b>' : '?');

console.log('\n[1] 文本：与站点那一行逐字一致');
ok('站内原句就是 "*   已被销毁"', L.DESTROY_TIP_TEXT === '*   已被销毁', JSON.stringify(L.DESTROY_TIP_TEXT));
ok('带模板时 == 站点那一行的结果',
  L.destroyTipText('社区_空间站', tpl) === '<b>社区_空间站</b>   已被销毁', L.destroyTipText('社区_空间站', tpl));
ok('模板只按 29 号调用', (function () { let seen = null; L.destroyTipText('x', (i) => { seen = i; return ''; }); return seen === 29; })());
ok('模板不可用（未装/被改）退化成「房名」',
  L.destroyTipText('住宅_浅醉') === '「住宅_浅醉」   已被销毁', L.destroyTipText('住宅_浅醉'));
ok('模板抛错不炸（调用方 try 之外还有兜底）', typeof L.destroyTipText('x', () => { throw new Error('boom'); }) === 'string');
ok('空房名也给出可读文本', L.destroyTipText('') === '「」   已被销毁', L.destroyTipText(''));

console.log('\n[2] 房名：类型_房名 的取值优先级');
ok('cookie("roomname") 优先',
  L.destroyTipRawName({ cookieFn: (k) => (k === 'roomname' ? '社区_空间站' : ''), roomNames: { R: '住宅_别的' }, roomn: 'R' }) === '社区_空间站');
ok('cookie 空 → 用 roomNameJson[当前房]',
  L.destroyTipRawName({ cookieFn: () => '', roomNames: { R: '住宅_别的' }, roomn: 'R' }) === '住宅_别的');
ok('两者都没有 → 退房号',
  L.destroyTipRawName({ cookieFn: () => '', roomNames: {}, roomn: 'R' }) === 'R');
ok('当前房也不知道 → 空字符串（不抛）',
  L.destroyTipRawName({ cookieFn: () => '', roomNames: {}, roomn: '' }) === '');
ok('cookie 抛错不会炸',
  L.destroyTipRawName({ cookieFn: () => { throw new Error('x'); }, roomNames: { R: '住宅_R' }, roomn: 'R' }) === '住宅_R');
ok('cookie 返回 null 走下一档',
  L.destroyTipRawName({ cookieFn: () => null, roomNames: { R: '住宅_R' }, roomn: 'R' }) === '住宅_R');
ok('无参调用不炸', L.destroyTipRawName() === '');

console.log('\n[3] 悬浮球摆位夹取');
ok('常规坐标不动', JSON.stringify(L.clampPos(100, 200, 46, 1200, 800)) === JSON.stringify({ left: 100, top: 200 }));
ok('右侧越界夹回', L.clampPos(9999, 10, 46, 1200, 800).left === 1154, L.clampPos(9999, 10, 46, 1200, 800).left);
ok('下侧越界夹回', L.clampPos(10, 9999, 46, 1200, 800).top === 754, L.clampPos(10, 9999, 46, 1200, 800).top);
ok('负坐标夹到 0', JSON.stringify(L.clampPos(-30, -30, 46, 1200, 800)) === JSON.stringify({ left: 0, top: 0 }));
ok('视口比球还小也不出负数', JSON.stringify(L.clampPos(10, 10, 46, 20, 20)) === JSON.stringify({ left: 0, top: 0 }));
ok('尺寸是 46', L.FAB_SIZE === 46, L.FAB_SIZE);

console.log('\nSUMMARY ' + pass + '/' + (pass + fail) + (fail ? '（有失败）' : ' 全过'));
process.exit(fail ? 1 : 0);
