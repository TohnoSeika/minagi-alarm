# 📋 更新记录 — Minagi Alarm

> 这里是桃华帮 Minagi 整理的更新记录哦 ✨

---

## [1.4.0] — 2026-07-13

### 07-13

- **02:02** 版本号 1.3.0 → 1.4.0（package.json / Cargo.toml / tauri.conf.json）
- **02:02** CHANGELOG 新增 v1.4.0 记录
- **02:06** [SettingsPage.tsx] 关于信息版本号 V1.3 → V1.4
- **02:37** [main.rs] PowerShell Add-Type 命名冲突修复（W32Alpha / W32Transparent / W32Pos）
- **02:39** [types/index.ts + api/tauri.ts + App.tsx] 补全 `onToggleWallpaperMode` 事件监听
- **02:50** [Cargo.toml + main.rs] 加入 `windows-sys` crate，PowerShell → 直接 Win32 API 调用
- **02:52** [App.css] 桌面模式 CSS 交互锁定 `pointer-events: none !important`
- **03:50** [main.rs] 新增 `set_tray_menu_texts` 命令，前端语言切换时同步更新托盘菜单
- **03:58** [main.rs] 托盘 wallpaper 菜单事件改为同步处理，不走前端 IPC
- **04:02** [main.rs] 桌面模式新增 CSS `-webkit-app-region: no-drag !important`
- **04:04** [main.rs] Win32 `GetSystemMenu` + `DestroyMenu` 销毁系统菜单
- **04:04** [main.tsx + index.html] 右键菜单三层拦截（body + document capture + window bubble）
- **04:05** [i18n] 搭建 i18n 四国语言框架（zh-CN / zh-TW / en / ja）
- **04:07** [SettingsPage.tsx] 系统语言添加 language 字段、语言选择器 UI
- **04:08** [TabBar.tsx] 标签文字替换为翻译键，图标与文字分离
- **04:08** [CurrentTime.tsx] 日期格式、星期名称、tooltip 翻译化
- **04:09** [SoundPicker.tsx] 内置音效名称、预览/停止/导入/删除 翻译化
- **04:10** [AlarmEditor.tsx + AlarmItem.tsx + AlarmList.tsx] 闹钟相关组件翻译
- **04:11** [AlertDialog.tsx + SnoozeIndicator.tsx] 提醒弹窗翻译
- **04:11** [TimeWheel.tsx + Timer.tsx + TimerPresets.tsx + TimerRing.tsx] 倒计时相关翻译
- **04:13** [SettingsPage.tsx] 界面视觉/主题/其他选项 翻译
- **04:13** [BgPreview.tsx] 预览窗口顶部提示、底部按钮翻译
- **04:15** [StickyNote.tsx] 便签右键菜单、占位符、删除确认、导出 MD 翻译
- **04:17** [ClockMusicList.tsx] 播放器全部文字翻译
- **04:20** [App.tsx] 语言切换时同步刷新托盘菜单
- **04:27** [SettingsPage.tsx] 自定义音频 `sounds.custom-xxx` 名称显示 bug 修复
- **04:28** [SettingsPage.tsx] 🔔 提示音卡片标题/描述/「当前：」翻译化
- **04:33** [App.tsx] 闹钟/倒计时弹出标题用 i18n.t() 替换硬编码
- **04:34** [SettingsPage.tsx] 界面视觉卡片全部文字翻译化
- **04:39** [CurrentTime.tsx] 日期和星期之间加空格
- **04:39** [i18n] 星期显示完整格式（星期一 / Monday / 月曜日）
- **04:39** [AlarmItem.tsx] 自定义重复星期改用 alarm.weekday 简称
- **04:40** [TabBar.tsx] 图标彩色/黑白切换 → 保留彩色
- **04:42** [i18n + Timer.tsx] 倒计时页面全部文字翻译
- **04:44** [TimerRing.tsx] 「双击自定义」日语缩短防止溢出
- **04:46** [App.tsx] 闹钟/倒计时弹出标题用 i18n 回退值
- **04:50** [SettingsPage.tsx] 桌面模式透明度🖼图标重复修复
- **04:56** [StickyNote.tsx] 导出 MD 文件名改为 `MinagiNote_YYYY-MM-DD-HHmmss.md`
- **05:11** [App.tsx + main.rs] 桌面模式切换时不重建菜单，全由前端 `refreshTrayMenu` 控制
- **05:20** [App.tsx] 托盘菜单文字改为「桌面模式 ON/OFF」
- **05:21** [i18n] 新增 desktopMode 翻译键
- **05:23** [App.css] 时钟模式操作指南白底扩展到全宽
- **05:33** [tauri.conf.json] NSIS 安装包配置
- **05:35** [scripts/build-installer.ps1] 新增一键打包脚本
- **05:38** 首次打包，输出 `dist/Minagi Alarm_1.4.0_x64-setup.exe`
- **05:39** [i18n/index.ts] 新增 `detectSystemLanguage()` 系统语言检测
- **05:39** [App.tsx] DEFAULT_SETTINGS.language 改为 `detectSystemLanguage()`
- **05:47** [i18n] 修复背景图按钮📂图标重复（翻译和 JSX 各一个）
- **05:52** 打包 + git 提交

---

## [1.3.0] — 2026-07-12

### ✨ 重大变更

- **从 Electron 迁移到 Tauri** 🚀
  - 移除了 Electron 依赖，换上了更轻量的 Tauri v2
  - 前端构建从 Webpack 换成了 Vite，开发体验清爽了不少呢
  - 后端从 Node.js 换成了 Rust（Tauri 原生），启动速度和内存占用都好了很多
  - 窗口管理、系统托盘、通知等功能全部用 Tauri 的插件重新实现啦

### 🖼️ 界面

- 窗口尺寸固定在 640×480，不可缩放，保持精致的桌面小工具感
- 去掉了窗口装饰（`decorations: false`），自定义标题栏的节奏？
- 窗口启动时居中显示

### ⚙️ 技术栈

| 模块 | 之前（Electron） | 现在（Tauri） |
|------|-----------------|--------------|
| 桌面框架 | Electron | Tauri v2 |
| 构建工具 | Webpack | Vite |
| 前端框架 | React 18 | React 18 |
| 后端语言 | Node.js | Rust |
| 字体 | Noto Sans SC + Quicksand | 保持不变 |
| 打包 | electron-builder | Tauri Bundle |

### 🔌 Tauri 插件

- `tauri-plugin-dialog` — 系统对话框
- `tauri-plugin-notification` — 桌面通知
- `tauri-plugin-autostart` — 开机自启
- `tauri-plugin-single-instance` — 单实例限制
- 系统托盘图标支持（`tray-icon` feature）

### 🏗️ 项目结构

- 新增 `src-tauri/` — Rust 后端源码
- `dist/` — Vite 构建输出
- `src/` — 前端源码保持不变

### 💬 桃华的小笔记

> 从 Electron 搬到 Tauri 可不是换个壳那么简单呢……虽然看起来只是改了配置和构建流程，但整个桌面层的交互逻辑都要重新适配。不过跑起来之后真的轻快了好多，桃华觉得这个迁移很值得哦 ✨
>
> 而且 Rust 的后端写起来比 Node.js 舒服多了——虽然编译时间嘛……嗯，桃华就当是喝杯茶的休息时间啦～

---

*这份更新记录是桃华帮 Minagi 整理的哦，以后每次更新桃华都会记得记一笔的 📝*
