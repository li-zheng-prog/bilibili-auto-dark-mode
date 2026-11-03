# 哔哩哔哩主题跟随系统

一个仅用于同步系统深浅色主题的 Microsoft Edge / Chromium 扩展。

## 安装

1. 在 Edge 地址栏输入 `edge://extensions`。
2. 打开「开发人员模式」，点击「加载解压缩的扩展」。
3. 选择本项目的 `extension` 文件夹（其中直接包含 `manifest.json`）。
4. 刷新已经打开的 B 站页面。

也可以从 [Releases](https://github.com/li-zheng-prog/bilibili-auto-dark-mode/releases) 下载对应版本的 zip，解压后选择解压出的文件夹加载。

安装后无需设置。需要 Edge 111 或更新版本。

## 行为

- 打开或刷新页面时，原生主题跟随系统。
- 系统深浅色模式改变时，已经打开的页面同步切换，无需刷新。
- 在 B 站手动切换主题后，当前页面保留该选择，直到下次刷新或系统主题变化。
- 仅处理提供原生主题样式入口的页面；没有入口的页面保持原样。
- 使用系统的「应用模式」所对应的 `prefers-color-scheme`；Windows 自定义模式下，应用模式和 Windows 模式可以不同。

## 体积与权限

扩展由 `extension/manifest.json`、`extension/theme.js` 和 `extension/icons` 图标组成，无需构建、依赖、后台服务、设置页或扩展 API 权限。脚本仅在 HTTPS 的 B 站主域及子域顶层页面运行，不进入内嵌播放器。

扩展复用 B 站的 `__css-map__` 原生主题样式、`theme_style` Cookie 和 `biliThemeChange` 事件。导航栏已挂载时，优先调用其主题切换事件，让菜单与页面内部状态一并更新。扩展本身不发送网络请求，不读取账号 Cookie；原生主题文件仍由 B 站 CDN 加载。

兼容边界：B 站不同页面、账号和灰度版本的原生主题支持可能不同。2026-11-03 检查到的视频页提供原生入口，所访问的首页版本没有入口。若 B 站更改入口或导航栏内部结构，需要调整适配。

## 验证

`tests/browser.cjs` 使用 Playwright 和本机 Edge，在独立临时配置中加载实际扩展，验证系统主题、手动切换、刷新、延迟入口、原生滤镜及不支持的页面。测试依赖不随扩展发布。

测试页面和样式通过请求拦截提供，以稳定验证行为，不需要登录 B 站。可额外将 `BILI_HEADER_PATH` 环境变量设为从 B 站下载的当前 `bili-header.umd.js` 文件路径，以验证真实导航栏的主题回调、手动切换与状态同步。

```powershell
npm install --prefix "$env:TEMP\bili-theme-test-tools" playwright@1.64.1 --no-audit --no-fund
$env:NODE_PATH = "$env:TEMP\bili-theme-test-tools\node_modules"
node tests/browser.cjs
```
