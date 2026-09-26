# 房间销毁器（iirose 趣味插件）

点一下右下角的 💥，站里就会弹一张原生的提示：

    ⇄ 住宅_Ruby家   已被销毁

**它是什么**：一个纯本地的玩笑。它调用的是站点自己的提示通道（`Utils.sync`，源码 `messages.js:16762` 那一行），
只有**执行它的这个客户端**会弹，**不向服务器发送任何数据**，也不会影响别人的房间、别人的客户端。

**它不是什么**：不是"真的销毁房间"。房间销毁是服务器侧、房主权限的操作，客户端插件做不到，
也不该做。这张提示只是画在你自己屏幕上。

## 房名从哪来

站内 `Cookie("roomname")` 的值本身就是「**房间类型_房名**」，例如 `社区_空间站`、`住宅_浅醉`。
插件直接读它，所以类型前缀是站点给的，不用手填。取不到时依次回退到站内房间表 `roomNameJson[当前房]`、最后回退到房号。

## 安装

单文件，无依赖，注入即用：

    // 在站点终端（js）里：
    Cache();  // 可选：跳过缓存

    fetch('插件地址').then(r => r.text()).then(t => eval(t));

或把本文件地址填进站点的 **Custom JS 链接** 框（`js` 命令）—— 每次页面加载自动运行，
换房重载后也会自己回来。

## 用法

- **点一下 💥**：弹当前房间的那张提示。
- **拖动 💥**：摆到顺手的位置，位置记在本机（`localStorage`）。
- **想指定房名**：控制台 `__IIROSE_ROOMDESTROY__.popTip('住宅_某家')`
- **看看当前取到什么房名**：`__IIROSE_ROOMDESTROY__._diag.currentRoomName()`
- **卸载**：`__IIROSE_ROOMDESTROY__.unmount()`（或删掉注入脚本后刷新）

## 自测

    node tests/core.test.js        # 核心函数单测（抽 #region CORE 段跑真实源码）
    # 交互自测：浏览器打开 tests/harness.html（独立页，用桩替代站点环境）

## 署名与分工

- 人类作者：**Northseacaviar**（[@Northseacaviar](https://github.com/Northseacaviar)）—— 需求、真机验证、拍板

