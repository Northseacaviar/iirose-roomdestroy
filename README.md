# 房间销毁器

点右下角 💥，页面弹一张「<房间名>   已被销毁」的提示（房间名带站点给的类型前缀，例如 `住宅_Ruby家`）。

**纯本地的玩笑**：只调用页面已有的提示接口，不发送任何请求；只画在你自己屏幕上，
不影响别人的房间、别人的页面。它不是"真的销毁房间"——房间销毁是服务器侧的操作，客户端脚本做不到。

## 安装（JS 注入）

把 loader 填进站点的 **Custom JS 链接** 框（每次进站自动加载）：

    https://cdn.jsdelivr.net/gh/Northseacaviar/iirose-roomdestroy/loader.js

或直接注入主脚本：

    https://cdn.jsdelivr.net/gh/Northseacaviar/iirose-roomdestroy/src/iirose-roomdestroy.js

## 用法

- **点 💥**：弹当前房间的提示
- **右键 / 长按 💥**：打开输入框，**填房号或房名**都行
  - 房号（`5b7ab839ace99`）→ 自动查站内房间表，补上类型前缀
  - 裸房名（`浅醉`）→ 自动匹配成 `住宅_浅醉`；写全名 `住宅_浅醉` 就原样用
  - 留空 = 当前房；输入框里那行小字会先告诉你要弹什么
- **拖动 💥**：换位置（记在本机）
- **提示音**：弹的时候用站点自己的系统提示音（取不到时合成一声"叮"），`__IIROSE_ROOMDESTROY__.setSound(false)` 可关掉
- **控制台**：`__IIROSE_ROOMDESTROY__.popTip('住宅_某家')`、`__IIROSE_ROOMDESTROY__.openInput()`、`__IIROSE_ROOMDESTROY__._diag.currentRoomName()`
- **卸载**：`__IIROSE_ROOMDESTROY__.unmount()`

## 自测

    node tests/core.test.js          # 核心函数单测
    # 交互自测：浏览器打开 tests/harness.html

## 署名

- 人类作者：Northseacaviar（[@Northseacaviar](https://github.com/Northseacaviar)）

