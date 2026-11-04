# 哔哩哔哩主题跟随系统

一个仅用于同步系统深浅色主题的 Microsoft Edge / Chromium 扩展。

## 安装

1. 在 Edge 地址栏输入 `edge://extensions`。
2. 打开「开发人员模式」，点击「加载解压缩的扩展」。
3. 选择本项目的 `extension` 文件夹（其中直接包含 `manifest.json`）。
4. 刷新已经打开的 B 站页面。

也可以从 [Releases](https://github.com/li-zheng-prog/bilibili-auto-dark-mode/releases) 下载对应版本的 zip，解压后选择解压出的文件夹加载。

安装后无需设置。需要 Edge 111 或更新版本。

升级到 1.0.1：如果加载的是本项目的 `extension` 文件夹，在扩展管理页点击「重新加载」，确认版本显示为 1.0.1，然后刷新所有 B 站标签页。如果安装时使用的是解压出来的文件夹，请先将新版本压缩包解压并覆盖该文件夹，再重新加载扩展；修改本项目不会自动更新另一处安装目录。

## 行为

- 打开或刷新页面时，原生主题跟随系统。
- 系统深浅色模式改变时，已经打开的页面同步切换，无需刷新。
- 在 B 站手动切换主题后，当前页面保留该选择，直到下次刷新或系统主题变化。
- 仅处理提供原生主题样式入口的页面；没有入口的页面保持原样。
- 使用系统的「应用模式」所对应的 `prefers-color-scheme`；Windows 自定义模式下，应用模式和 Windows 模式可以不同。

## 体积与权限

扩展由 `extension/manifest.json`、`extension/theme.js` 和 `extension/icons` 图标组成，无需构建、依赖、后台服务、设置页或扩展 API 权限。脚本仅在 HTTPS 的 B 站主域及子域顶层页面运行，不进入内嵌播放器。

扩展复用 B 站的 `__css-map__` 原生主题样式、首页的 `bili_dark` 类、`theme_style` Cookie 和 `biliThemeChange` 事件。导航栏已挂载时，优先调用其主题切换事件，让菜单与页面内部状态一并更新。扩展本身不发送网络请求，不读取账号 Cookie；原生主题文件仍由 B 站 CDN 加载。

1.0.1 修复了首页使用原生 CSS 类却被跳过、异步加载的入口未被发现、页面初始化恢复旧主题及页面内跳转后入口被替换的问题。等待组件通过 DOM 变化触发并合并执行，没有定时轮询。手动操作与初始化事件分开处理，避免自动同步被旧状态覆盖。

兼容边界：B 站不同页面、账号和灰度版本的原生主题支持可能不同。2026-11-04 已核对首页的 `bili_dark` 及视频页的主题样式入口。没有原生支持的页面仍不注入自定义配色。若 B 站更改入口或导航栏内部结构，需要调整适配。

## 验证

`tests/browser.cjs` 使用 Playwright 和本机 Edge，在独立临时配置中加载实际扩展，验证系统主题、手动切换、刷新、延迟入口、原生滤镜及不支持的页面。测试依赖不随扩展发布。

测试页面和样式通过请求拦截提供，以稳定验证行为，不需要登录 B 站。可额外将 `BILI_HEADER_PATH` 环境变量设为从 B 站下载的当前 `bili-header.umd.js` 文件路径，以验证真实导航栏的主题回调、手动切换与状态同步；将 `BILI_HOME_CSS_PATH` 设为当前首页样式文件路径，可验证真实样式的背景颜色双向切换。1.0.1 已在 Edge 独立测试配置中通过包含这两个官方资源的 18 项检查；系统主题变化用浏览器媒体特性模拟，未修改用户的 Windows 主题。

```powershell
npm install --prefix "$env:TEMP\bili-theme-test-tools" playwright@1.64.1 --no-audit --no-fund
$env:NODE_PATH = "$env:TEMP\bili-theme-test-tools\node_modules"
node tests/browser.cjs
```
