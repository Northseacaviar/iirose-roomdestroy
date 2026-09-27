# 房间销毁器

点右下角 💥，页面弹一张「<房间名>   已被销毁」的提示（房间名带站点给的类型前缀，例如 `住宅_Ruby家`）。

**纯本地的玩笑**：只调用页面已有的提示接口，不发送任何请求；只画在你自己屏幕上，
不影响别人的房间、别人的页面。它不是"真的销毁房间"——房间销毁是服务器侧的操作，客户端脚本做不到。

插件只会弹站内房间表里确实存在的房号 / 房名，表里查不到就不弹，不接受任意文本。

站内弹窗本身不带来源认证 —— 任何本地脚本都能画出同样外观的提示，请不要把这类弹窗当成封禁、
处罚之类的官方凭证。

## 安装（JS 注入）

把 loader 填进站点的 **Custom JS 链接** 框（每次进站自动加载）：

    https://cdn.jsdelivr.net/gh/Northseacaviar/iirose-roomdestroy/loader.js

或直接注入主脚本：

    https://cdn.jsdelivr.net/gh/Northseacaviar/iirose-roomdestroy/src/iirose-roomdestroy.js

## 用法

**电脑（鼠标）**

- **左键** 💥：弹当前房间的提示
- **右键** 💥：打开输入框，**填房号或房名**都行（右键不会弹销毁）
- **拖动** 💥：换位置（记在本机）

**手机（触屏）**

- **点** 💥：打开输入框，填房号或房名
- **长按 2 秒** 💥：弹当前房间的提示
- **拖动** 💥：换位置（记在本机）

**输入框里填什么**

- 房号（`5b7ab839ace99`）→ 查站内房间表，用表里记的 `类型_房名`
- 房名（`浅醉` / `空间站_客房`）→ 按站内记录凑出全名，多段房名也认，大小写不敏感
- 留空 = 当前房；下面那行小字会先告诉你要弹什么
- **站内房间表里查不到的，一律不弹**（小字会写"站内房间表里没查到"）

**其它**

- 提示音：弹的时候响站点自己的**信箱消息提示音**（取不到时合成一声"叮"兜底），`__IIROSE_ROOMDESTROY__.setSound(false)` 可关掉
- 控制台：`__IIROSE_ROOMDESTROY__.popTip('住宅_某家')`、`__IIROSE_ROOMDESTROY__.openInput()`
- 卸载：`__IIROSE_ROOMDESTROY__.unmount()`

## 自测

    node tests/core.test.js          # 核心函数单测
    # 交互自测：浏览器打开 tests/harness.html

## 署名

- 人类作者：Northseacaviar（[@Northseacaviar](https://github.com/Northseacaviar)）

