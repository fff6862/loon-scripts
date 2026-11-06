# 百度网盘签到 Loon 插件

## 文件说明

- `main.lpx`：Loon 插件入口，包含 Cookie 捕获、每天 08:15 定时任务和手动执行入口。
- `capture.js`：自动读取已登录请求中的 Cookie，并保存到 Loon 本地存储。
- `checkin.js`：执行会员成长签到、每日答题和会员成长值查询。

## 安装

1. 将整个文件夹传到 iPhone，保持三个文件位于同一目录。
2. 在 Loon 中导入 `main.lpx`。
3. 在 Loon 的 MitM 设置中生成并安装 CA 证书，然后在 iOS 的“关于本机 → 证书信任设置”中完全信任该证书。
4. 确认 Loon 的 MitM、脚本和复写功能已经开启。

## 自动获取 Cookie

1. 使用 Safari 登录 `https://pan.baidu.com`。
2. 打开 `https://pan.baidu.com/wap/svip/growth/task`。
3. 收到“百度网盘｜自动获取成功｜Cookie 已更新”通知即表示获取成功。
4. 回到 Loon，在插件的通用脚本入口中手动运行一次“百度网盘手动签到”进行验证。

如果未触发通知，请彻底关闭 Safari 后重新打开任务页，并确认 Loon 已接管当前网络、MitM 证书已完全信任。

捕获规则只匹配会员成长任务页和 APP 签到接口；相同账号凭据不会重复保存或通知，并设有 5 分钟通知冷却，避免网页并发请求造成通知轰炸。

## APP 新版签到请求采集

捕获脚本同时检测路径中包含 `/coins/taskcenter/signin` 的请求。如果该请求经过 `pan.baidu.com`，手动在百度网盘 APP 完成一次福利签到后，Loon 会把请求 URL、必要请求头、请求体以及 `cuid`、`devuid`、`idfv` 保存到本地键 `baidupan_app_sign_request`，并提示“APP 签到请求模板已保存”。

第一版不会自动重放该请求，避免在未确认领奖风控参数前重复提交。完成一次真实采集后，可再根据实际请求继续开发 APP 签到与领奖流程。

## 安全说明

- Cookie 含有账号登录权限，只保存在 Loon 的 `$persistentStore` 中；不要把运行日志、抓包记录或 Cookie 发给他人。
- 插件不会上传 Cookie，也没有第三方服务器依赖。
- 移除插件前，如需彻底清理凭据，可在 Loon 中清除脚本持久化数据。
- 百度接口可能调整；出现登录失效或接口错误时，重新访问任务页获取 Cookie。

