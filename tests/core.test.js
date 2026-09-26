// 单测：把插件源码 // #region CORE 段抽出来，在 Node vm 里跑真实源码（不复制实现）。
// 用法：node tests/core.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'iirose-roomdestroy.js');
const EXPORTS = ['DESTROY_TIP_TEXT', 'destroyTipRawName', 'destroyTipText', 'clampPos', 'FAB_SIZE',
  'looksLikeRid', 'resolveRoomName', 'soundOnPref', 'BOX_ID'];

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

console.log('\n[4] 输入解析：房号 / 房名 → 站内完整房名');
const TBL = { R1: '社区_空间站', R2: '住宅_浅醉', R3: '旅馆_老地方', R4: '没有下划线的名字' };
ok('认出 13 位十六进制房号', L.looksLikeRid('5b7ab839ace43') === true);
ok('大写也认', L.looksLikeRid('5B7AB839ACE43') === true);
ok('两边有空格也认', L.looksLikeRid('  5b7ab839ace43 ') === true);
ok('长度不对不算房号', L.looksLikeRid('5b7ab839ace4') === false && L.looksLikeRid('5b7ab839ace433') === false);
ok('名字不算房号', L.looksLikeRid('浅醉') === false && L.looksLikeRid('') === false);
ok('房号 → 查表补上类型前缀', L.resolveRoomName('5b7ab839ace43', { roomNames: { '5b7ab839ace43': '住宅_Ruby家' } }) === '住宅_Ruby家');
ok('房号查不到就原样用', L.resolveRoomName('5b7ab839ace43', { roomNames: {} }) === '5b7ab839ace43');
ok('没给房间表也不炸', L.resolveRoomName('5b7ab839ace43') === '5b7ab839ace43');
ok('带前缀的房名不动', L.resolveRoomName('住宅_浅醉', { roomNames: TBL }) === '住宅_浅醉');
ok('裸房名 → 按后半段匹配补前缀', L.resolveRoomName('浅醉', { roomNames: TBL }) === '住宅_浅醉');
ok('裸房名匹配不看大小写', L.resolveRoomName('SPACE', { roomNames: { X: '社区_Space' } }) === '社区_Space');
ok('表里带下划线但名字对得上也补', L.resolveRoomName('空间站', { roomNames: { R1: '社区_空间站', R2: '住宅_浅醉' } }) === '社区_空间站');
ok('表里有不带下划线的条目不会崩', L.resolveRoomName('别的', { roomNames: TBL }) === '别的');
ok('匹配不到 → 原样用', L.resolveRoomName('不存在', { roomNames: TBL }) === '不存在');
ok('空输入 → 空串（调用方当"当前房"处理）', L.resolveRoomName('   ', { roomNames: TBL }) === '');
ok('多余空格会被去掉', L.resolveRoomName('  浅醉  ', { roomNames: TBL }) === '住宅_浅醉');

console.log('\n[5] 提示音偏好');
ok('默认开', L.soundOnPref(null) === true && L.soundOnPref('') === true && L.soundOnPref('1') === true);
ok('存 "0" 就是关', L.soundOnPref('0') === false);
ok('怪值当开', L.soundOnPref('yes') === true);
ok('输入框有 id（自测/排障要用）', L.BOX_ID === 'iirose-roomdestroy-box', L.BOX_ID);

console.log('\nSUMMARY ' + pass + '/' + (pass + fail) + (fail ? '（有失败）' : ' 全过'));
process.exit(fail ? 1 : 0);
