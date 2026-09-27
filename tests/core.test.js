// 单测：把插件源码 // #region CORE 段抽出来，在 Node vm 里跑真实源码（不复制实现）。
// 用法：node tests/core.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'iirose-roomdestroy.js');
const EXPORTS = ['DESTROY_TIP_TEXT', 'NOTICE_TAG', 'escapeHtml', 'destroyTipRawName', 'destroyTipText',
  'clampPos', 'FAB_SIZE', 'looksLikeRid', 'resolveRoomName', 'soundOnPref', 'BOX_ID'];

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
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra === undefined ? '' : '   [' + extra + ']')); }
}

const L = loadCore();
const tpl = (i, x) => (i === 29 ? '<b>' + x + '</b>' : '?');

console.log('\n[1] 文本：与站点那一行逐字一致 + 固定角标');
ok('站内原句就是 "*   已被销毁"', L.DESTROY_TIP_TEXT === '*   已被销毁', JSON.stringify(L.DESTROY_TIP_TEXT));
ok('带模板时 == 站点那一行的结果 + 角标',
  L.destroyTipText('社区_空间站', tpl) === '<b>社区_空间站</b>   已被销毁' + L.NOTICE_TAG, L.destroyTipText('社区_空间站', tpl));
ok('模板只按 29 号调用', (function () { let seen = null; L.destroyTipText('x', (i) => { seen = i; return ''; }); return seen === 29; })());
ok('模板不可用（未装/被改）退化成「房名」',
  L.destroyTipText('住宅_浅醉') === '「住宅_浅醉」   已被销毁' + L.NOTICE_TAG, L.destroyTipText('住宅_浅醉'));
ok('模板抛错不炸（调用方 try 之外还有兜底）', typeof L.destroyTipText('x', () => { throw new Error('boom'); }) === 'string');
ok('空房名也给出可读文本', L.destroyTipText('') === '「」   已被销毁' + L.NOTICE_TAG, L.destroyTipText(''));

console.log('\n[1b] 固定角标：写死的常量、永远在末尾');
ok('角标是写死的常量', typeof L.NOTICE_TAG === 'string' && L.NOTICE_TAG.length > 0 && L.NOTICE_TAG.indexOf('非官方通知') >= 0,
  JSON.stringify(L.NOTICE_TAG));
ok('每条文本都以角标结尾', /非官方通知\]$/.test(L.destroyTipText('社区_空间站', tpl)));
ok('角标排在"已被销毁"之后（模板改不掉它的位置）', (function () {
  const t = L.destroyTipText('社区_空间站', tpl);
  return t.indexOf('已被销毁') < t.indexOf('非官方通知');
})());
ok('模板抛错时角标照样在', /非官方通知\]$/.test(L.destroyTipText('x', () => { throw new Error('x'); })));

console.log('\n[1c] HTML 转义：房名只当纯文本');
ok('真房名逐字不变', L.destroyTipText('社区_空间站', tpl).indexOf('社区_空间站') >= 0);
ok('尖括号被转义（进不了标签）',
  L.destroyTipText('<img src=x onerror=alert(1)>', tpl).indexOf('<img') < 0,
  L.destroyTipText('<img src=x onerror=alert(1)>', tpl));
ok('转义后可读（变成实体）',
  L.destroyTipText('<b>x</b>', tpl).indexOf('&lt;b&gt;x&lt;/b&gt;') >= 0,
  L.destroyTipText('<b>x</b>', tpl));
ok('五种字符全覆盖', L.escapeHtml('<>&"\'') === '&lt;&gt;&amp;&quot;&#39;', L.escapeHtml('<>&"\''));
ok('不二次转义（& 只变一次）', L.escapeHtml('&lt;') === '&amp;lt;', L.escapeHtml('&lt;'));
ok('null / undefined / 数字不炸', L.escapeHtml(null) === '' && L.escapeHtml(undefined) === '' && L.escapeHtml(7) === '7');

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

console.log('\n[4] 输入解析：房号 / 房名 → 站内完整房名（一律查表，查不到拒绝）');
const TBL = { R1: '社区_空间站', R2: '住宅_浅醉', R3: '旅馆_老地方', R4: '没有下划线的名字' };
ok('认出 13 位十六进制房号', L.looksLikeRid('5b7ab839ace43') === true);
ok('大写也认', L.looksLikeRid('5B7AB839ACE43') === true);
ok('两边有空格也认', L.looksLikeRid('  5b7ab839ace43 ') === true);
ok('长度不对不算房号', L.looksLikeRid('5b7ab839ace4') === false && L.looksLikeRid('5b7ab839ace433') === false);
ok('名字不算房号', L.looksLikeRid('浅醉') === false && L.looksLikeRid('') === false);
ok('房号 → 查表补上类型前缀',
  L.resolveRoomName('5b7ab839ace43', { roomNames: { '5b7ab839ace43': '住宅_Ruby家' } }) === '住宅_Ruby家');
ok('房号查不到 → 拒绝（不再原样放行）', L.resolveRoomName('5b7ab839ace43', { roomNames: {} }) === '');
ok('没给房间表 → 拒绝', L.resolveRoomName('5b7ab839ace43') === '');
ok('带前缀的房名，表里有就认', L.resolveRoomName('住宅_浅醉', { roomNames: TBL }) === '住宅_浅醉');
ok('带前缀但表里没有 → 拒绝', L.resolveRoomName('住宅_不存在', { roomNames: TBL }) === '');
ok('裸房名 → 按后半段匹配补前缀', L.resolveRoomName('浅醉', { roomNames: TBL }) === '住宅_浅醉');
ok('裸房名匹配不看大小写', L.resolveRoomName('SPACE', { roomNames: { X: '社区_Space' } }) === '社区_Space');
ok('表里带下划线但名字对得上也补', L.resolveRoomName('空间站', { roomNames: { R1: '社区_空间站', R2: '住宅_浅醉' } }) === '社区_空间站');
ok('表里不带下划线的条目按全名认', L.resolveRoomName('没有下划线的名字', { roomNames: TBL }) === '没有下划线的名字');
ok('匹配不到 → 拒绝', L.resolveRoomName('不存在', { roomNames: TBL }) === '');
ok('空输入 → 空串（调用方当"当前房"处理）', L.resolveRoomName('   ', { roomNames: TBL }) === '');
ok('多余空格会被去掉', L.resolveRoomName('  浅醉  ', { roomNames: TBL }) === '住宅_浅醉');

console.log('\n[4b] 拒绝任意文本（本次改造的根因）');
ok('假通知文案被拒', L.resolveRoomName('您已被封禁', { roomNames: TBL }) === '');
ok('带倒计时/备注的假通知被拒',
  L.resolveRoomName('您已被封禁\n解封倒计时：8848 天\n备注：x', { roomNames: TBL }) === '');
ok('HTML 注入串被拒', L.resolveRoomName('<img src=x onerror=alert(1)>', { roomNames: TBL }) === '');
ok('真房名后面挂料 → 拒（表里没有这个全名）',
  L.resolveRoomName('住宅_浅醉\n[假的]', { roomNames: TBL }) === '');
ok('房号后面挂料 → 拒', L.resolveRoomName('5b7ab839ace43 您已被封禁', { roomNames: TBL }) === '');
ok('名字带下划线但表里不存在 → 拒', L.resolveRoomName('社区_冒牌货', { roomNames: TBL }) === '');
ok('真房名没被误伤', L.resolveRoomName('浅醉', { roomNames: TBL }) === '住宅_浅醉'
  && L.resolveRoomName('社区_空间站', { roomNames: TBL }) === '社区_空间站'
  && L.resolveRoomName('旅馆_老地方', { roomNames: TBL }) === '旅馆_老地方');

console.log('\n[5] 提示音偏好');
ok('默认开', L.soundOnPref(null) === true && L.soundOnPref('') === true && L.soundOnPref('1') === true);
ok('存 "0" 就是关', L.soundOnPref('0') === false);
ok('怪值当开', L.soundOnPref('yes') === true);
ok('输入框有 id（自测/排障要用）', L.BOX_ID === 'iirose-roomdestroy-box', L.BOX_ID);

console.log('\nSUMMARY ' + pass + '/' + (pass + fail) + (fail ? '（有失败）' : ' 全过'));
process.exit(fail ? 1 : 0);
