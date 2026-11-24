# 3DR Media Design · Magpie 插件

[English](README.md)

让您的 Agent 能生成图片和视频，并擅长建筑效果图、室内设计和户型图创作。您可以交给它一张客厅照片，试试不同的装修风格，也可以把建筑草图渲染成效果图，再把选定的画面做成设计短片。连接后，Agent 就能在 Magpie 中找到您授权的工具。

## 安装与连接

在运行 Magpie 的电脑上准备好 Node.js 22 或更高版本、npm 和 Git，然后在终端依次运行以下命令。登录会打开 3D Room Design 官网，您可以选择允许使用的工具和积分策略。如果这台电脑上同一份 CLI 配置已经完成授权，可跳过登录。

```sh
npm install --global git+https://github.com/3droomdesign/3droomdesign-mcp.git
3dr login
magpie plugin add github:3droomdesign/magpie-plugin-3dr
magpie tools
```

打开 Magpie 的「设置 → 插件」，查看已安装的插件和工具名。将「Plugin tools」显示的 MCP 地址复制到 Agent 的 Streamable HTTP MCP 配置。默认本机地址是 `http://127.0.0.1:3425/mcp/magpie/tools`。如果 Agent 缓存了工具列表，请重新连接。

可以先对 Agent 说：

> 找到 3DR 的室内改造预设。帮我给一张日光下的阅读室效果图报价，只告诉我最多需要多少积分。

报价免费。确定生成后，Agent 在提交时传入唯一的 `request_id`，并保存返回的 `run_id`。遇到需要确认的任务，打开返回的网站链接授权即可。用 `get_run` 查询进度，用 `get_result` 查看产物。网络中断后，使用原参数和同一个 `request_id` 重试。要把原图或视频保存到磁盘，在已授权的电脑上运行 `3dr download <asset_ref> <目标路径>`。

## 切换账号和排查连接

* **只看到连接状态工具。** 调用 `connection_status` 查看原因。在终端运行 `3dr tools`，确认所用站点和配置可以列出工具。登录、变更权限或恢复网络后，在 Magpie 中关闭再开启此插件，然后刷新 Agent 的工具列表。
* **切换账号或环境。** 默认连接正式站。用 `3dr login --profile=design` 授权另一份配置，然后执行 `magpie plugin options magpie-plugin-3dr '{"profile":"design"}'`。连接其他站点时，给登录命令和 Magpie 进程设置相同的 `THREEDR_SITE_ORIGIN`，或在插件选项的 `siteOrigin` 中填写登录时使用的站点地址。修改选项时请在同一个 JSON 对象中保留需要的字段。
* **桌面应用找不到 3dr。** 在能运行 3dr 的终端执行 `3dr config`，将输出中的 `command` 绝对路径填入插件选项 `nodePath`，将 `args` 第一项的绝对路径填入 `cliPath`，同时保留使用中的账号及站点选项。在 Windows 上，这两个路径分别指向 Node 可执行文件和 3dr 的 JavaScript 入口。
* **更新版本。** 使用 `3dr update` 更新 CLI，在 Magpie 的插件管理中更新已安装插件。

## 权限与积分

插件复用本机 3dr 的凭证存储。您可以在官网的「账户 → MCP 连接」调整额度或撤销授权。多人使用同一个 Magpie 网关时，获准调用这些工具的人会共用这里配置的 3dr 授权。个人使用时可保持仅本机访问，共享时请限制接入人员。插件自身没有埋点。

[3dr CLI](https://github.com/3droomdesign/3droomdesign-mcp) · [Magpie 插件指南](https://usemagpie.ai/docs/plugins) · [许可](LICENSE)
