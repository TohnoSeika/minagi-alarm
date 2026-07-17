# Minagi Alarm ✦

> [简体中文](README.zh.md) · [日本語](README.ja.md)

A refined, elegant desktop alarm clock—**Alarms, Timer, Clock Mode, Desktop Mode**—all in one.

Built with **Tauri v2** (React + Rust), lightweight, beautiful, and ready to use.

---

## ✨ Features

- 🕐 **Alarms** — Supports multiple alarms with custom ringtones, custom notes, and different repeat schedules
- ⏳ **Timer** — Preset and custom countdown durations, with custom ringtone and custom reminder text
- 🎵 **Custom Ringtones** — Import `mp3 / wav / ogg / flac / m4a / aac`, plus built-in refined chimes
- 🖼️ **Clock Mode** — Compact and elegant clock display, draggable & resizable. Supports multiple sticky notes with custom content. Built-in music player with imported music support and shuffle mode
- 🪟 **Desktop Mode** — Embeds the window into the desktop with mouse-through support. Right-click the tray icon to exit Desktop Mode
- 🌐 **Multilingual** — Supports 简体中文 · 繁體中文 · English · 日本語 interface languages
- 🎨 **Theme Colors** — Custom accent color with sakura blossom mouse-trail particle effects
- 🖼️ **Custom Backgrounds** — Custom background images with mouse parallax tracking
- 🪟 **Window Opacity** — Independent transparency control for the software UI and Desktop Mode
- 🖱️ **System Tray** — Tray resident support with right-click context menu shortcuts
- 🚀 **Performance** — ~6 MB installer, built on Tauri v2 + Rust, instant startup

---

## 📖 Usage

| Action | Description |
|:---|:---|
| 🕐 **Add Alarm** | Go to the Alarm tab, click "Add", set the time, ringtone, and repeat rules |
| ⏳ **Timer** | Switch to the Timer tab, select a preset or custom duration |
| 🎨 **Change Theme** | In Settings, click the theme color swatch to pick your color |
| 🖼️ **Background Image** | In Settings, pick a background image, adjust opacity, scale & offset |
| 🌸 **Sakura Effect** | In Settings, enable the sakura effect, adjust count, color & opacity |
| 🖥️ **Clock Mode** | Double-click the time display, or set the startup page to Clock Mode |
| 📝 **Sticky Notes** | Right-click empty space in Clock Mode to add a note; drag to reposition / double-click to edit / right-click the pin to delete or export as Markdown |
| 🎵 **Background Music** | Double-click the clock in Clock Mode to open the music player; supports shuffle mode |
| 🪟 **Desktop Mode** | Click the button on the title bar or use the tray menu to enter Desktop Mode; right-click the tray icon to exit |
| 🗣️ **Switch Language** | Select your language in Settings — supports 简体中文 · 繁體中文 · English · 日本語, applies immediately |

---

## 🖼 Screenshots

> Screenshots are coming soon… stay tuned ✨

<!-- Touka will put the screenshots here once they're ready ♪ -->

---

## 📦 Download

Download the latest installer from the [Releases](https://github.com/TohnoSeika/minagi-alarm/releases) page.

> 💡 Current version **v1.4.0**, ~6 MB installer. Windows build is an NSIS setup program.

---

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full details.

### v1.4.0
1. Migrated from Electron to Tauri architecture.
2. Wallpaper Mode renamed to Desktop Mode.
3. Multilingual interface support: 简体中文 · 繁體中文 · English · 日本語.
4. Resolved numerous UI and functionality issues caused by the architecture migration.
5. Extensive UI and functionality optimizations and bug fixes.

### v1.3.0
1. Added Wallpaper Mode (now Desktop Mode).
2. Added auto-start on boot.
3. Extensive UI and functionality optimizations and bug fixes.

### v1.2.0
1. Added option to start the app in Clock Mode.
2. Added seconds display toggle.
3. Renamed "Background Opacity" to "Background Image Opacity", "Interface Opacity" to "Window Opacity".
4. Show "Mouse Effect Opacity" text when hovering over the opacity slider.
5. Removed "(without exiting)" from the close-to-tray description.
6. Sakura mouse effect now defaults to off.
7. Timer ring re-centers when no reminder text is set.
8. Added sticky notes in Clock Mode with full functionality.
9. Added music player in Clock Mode with full functionality.
10. Added startup page selection.
11. Added player volume control.
12. Fixed numerous bugs and improved many features.
13. Extensive UI and functionality optimizations and bug fixes.

### v1.1.0
1. Added Clock Mode — displays only the time and background image.
2. Extensive UI and functionality optimizations and bug fixes.

### v1.0.0
Completed basic functionality.

---

## 🤖 AI Assistance

Parts of this project's code and UI design were created with AI assistance.

---

## 📜 License

This project is **free software**, all rights reserved.
See [LICENSE](./LICENSE) · [LICENSE.zh](./LICENSE.zh) · [LICENSE.ja](./LICENSE.ja) for details.

---

> This software is free of charge and will never ask for payment.
> Developed by Tohno Seika
