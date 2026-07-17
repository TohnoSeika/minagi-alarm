// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Minagi Alarm — Tauri 后端
// 桃华帮 Minagi 做的桌面闹钟应用 — Tauri 迁移版 ✨
// 「Minagi 的专属闹钟——桃华制作」
// 从 Electron 迁移到 Tauri，保留了所有原有的优雅和功能

use base64::Engine;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent, MouseButton};

// 全局托盘图标 + 桌面模式状态——在 setup 时存入，菜单点击时同步处理
static TRAY_ICON: OnceLock<TrayIcon<tauri::Wry>> = OnceLock::new();
static WALLPAPER_MODE: AtomicBool = AtomicBool::new(false);

// ─── Store ──────────────────────────────────────────────────────────

fn get_store_path(app: &tauri::AppHandle) -> PathBuf {
    let path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.join("minagi-alarm-store.json")
}

#[tauri::command]
fn get_store(app: tauri::AppHandle, key: String) -> Result<Option<Value>, String> {
    let store_path = get_store_path(&app);
    if !store_path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&store_path).map_err(|e| e.to_string())?;
    let store: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(store.get(&key).cloned())
}

#[tauri::command]
fn set_store(app: tauri::AppHandle, key: String, value: Value) -> Result<(), String> {
    let store_path = get_store_path(&app);
    if let Some(parent) = store_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut store: Value = if store_path.exists() {
        let content = fs::read_to_string(&store_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };

    if let Value::Object(ref mut map) = store {
        map.insert(key, value);
    }

    // 原子写入——先写 .tmp 再 rename，避免崩溃时数据损坏
    let tmp_path = store_path.with_extension("json.tmp");
    fs::write(&tmp_path, serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &store_path).map_err(|e| e.to_string())?;

    Ok(())
}

// ─── 文件读取 ───────────────────────────────────────────────────────

#[tauri::command]
fn read_file_as_data_url(path: String) -> Result<Option<String>, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "png" => "image/png",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}

// ─── 应用图标 ──────────────────────────────────────────────────────

#[tauri::command]
fn get_app_icon(app: tauri::AppHandle) -> Result<Option<String>, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let png_path = resource_dir.join("icons/icon.png");
        if png_path.exists() {
            return read_file_as_data_url(png_path.to_string_lossy().to_string());
        }
    }
    // 从项目目录查找
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let local_png = manifest_dir.join("icons/icon.png");
    if local_png.exists() {
        return read_file_as_data_url(local_png.to_string_lossy().to_string());
    }
    Ok(None)
}

// ─── 写入文本文件（便利贴导出） ──────────────────────────────────

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Win32 底层操作（告别 PowerShell，直接调用 Win32 API） ──────
// 桃华把之前慢吞吞的 PowerShell 脚本全部换掉了！
// 现在窗口透明度、桌面模式都是毫秒级响应 ✨

#[cfg(target_os = "windows")]
fn get_hwnd(handle: &impl raw_window_handle::HasWindowHandle) -> Result<windows_sys::Win32::Foundation::HWND, String> {
    use raw_window_handle::RawWindowHandle;

    let w_handle = handle.window_handle().map_err(|e| e.to_string())?;
    match w_handle.as_raw() {
        RawWindowHandle::Win32(win32) => Ok(win32.hwnd.get() as _),
        _ => Err("Not a Windows platform".to_string()),
    }
}

/// 直接调用 Win32 SetWindowLong / SetLayeredWindowAttributes 设置透明度
#[cfg(target_os = "windows")]
fn set_window_alpha(handle: &impl raw_window_handle::HasWindowHandle, opacity: f64) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let hwnd = get_hwnd(handle)?;
    let alpha = (opacity * 255.0) as u8;

    unsafe {
        // 设置 WS_EX_LAYERED 扩展样式
        SetWindowLongW(hwnd, GWL_EXSTYLE, WS_EX_LAYERED as i32);
        // 设置透明度
        SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_window_alpha(_handle: &impl raw_window_handle::HasWindowHandle, _opacity: f64) -> Result<(), String> {
    Ok(())
}

// ─── 窗口透明度 ──────────────────────────────────────────────────

#[tauri::command]
fn set_window_opacity(window: tauri::Window, opacity: f64) -> Result<(), String> {
    let clamped = opacity.clamp(0.2, 1.0);
    set_window_alpha(&window, clamped)
}

/// 重建托盘菜单（桌面模式切换时更新文字）
fn rebuild_tray_menu(app: &tauri::AppHandle, wallpaper_enabled: bool) {
    let wallpaper_text = if wallpaper_enabled { "退出桌面模式" } else { "进入桌面模式" };
    let show_item = match MenuItemBuilder::with_id("show", "打开 Minagi Alarm").build(app) {
        Ok(item) => item,
        Err(e) => { eprintln!("[桃华] show_item build error: {:?}", e); return; }
    };
    let wallpaper_item = match MenuItemBuilder::with_id("wallpaper", wallpaper_text).build(app) {
        Ok(item) => item,
        Err(e) => { eprintln!("[桃华] wallpaper_item build error: {:?}", e); return; }
    };
    let quit_item = match MenuItemBuilder::with_id("quit", "退出软件").build(app) {
        Ok(item) => item,
        Err(e) => { eprintln!("[桃华] quit_item build error: {:?}", e); return; }
    };

    let menu = match MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&wallpaper_item)
        .separator()
        .item(&quit_item)
        .build()
    {
        Ok(m) => m,
        Err(e) => { eprintln!("[桃华] menu build error: {:?}", e); return; }
    };

    if let Some(tray) = TRAY_ICON.get() {
        match tray.set_menu(Some(menu)) {
            Ok(()) => {},
            Err(e) => eprintln!("[桃华] set_menu ERROR: {:?}", e),
        }
    }
}


// ─── 桌面模式 ─────────────────────────────────────────────────────

/// 直接调用 Win32 SetWindowPos 把窗口推到 z-order 最底端
#[cfg(target_os = "windows")]
fn push_window_to_bottom(handle: &impl raw_window_handle::HasWindowHandle) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let hwnd = get_hwnd(handle)?;

    unsafe {
        SetWindowPos(
            hwnd,
            HWND_BOTTOM,
            0, 0, 0, 0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        );
    }

    Ok(())
}

/// 直接调用 Win32 SetWindowLong 设置/取消鼠标穿透
#[cfg(target_os = "windows")]
fn set_window_transparent(handle: &impl raw_window_handle::HasWindowHandle, transparent: bool) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let hwnd = get_hwnd(handle)?;

    unsafe {
        if transparent {
            // WS_EX_TRANSPARENT | WS_EX_LAYERED（WINDOW_LONG_PTR 是 isize）
            SetWindowLongW(hwnd, GWL_EXSTYLE, (WS_EX_TRANSPARENT | WS_EX_LAYERED) as i32);
        } else {
            // 恢复：仅保留 WS_EX_LAYERED（不清除透明层样式！）
            SetWindowLongW(hwnd, GWL_EXSTYLE, WS_EX_LAYERED as i32);
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn push_window_to_bottom(_handle: &impl raw_window_handle::HasWindowHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_window_transparent(_handle: &impl raw_window_handle::HasWindowHandle, _transparent: bool) -> Result<(), String> {
    Ok(())
}

/// 桌面模式切换（统一入口——IPC 命令和托盘菜单都调用它）
fn set_wallpaper_mode_impl(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        return Err("Window not found".to_string());
    };

    if enabled {
        win.set_skip_taskbar(true).map_err(|e| e.to_string())?;
        set_window_transparent(&win, true)?;
        #[cfg(target_os = "windows")]
        push_window_to_bottom(&win)?;
    } else {
        win.set_skip_taskbar(false).map_err(|e| e.to_string())?;
        set_window_transparent(&win, false)?;
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }

    // 更新状态 + 通知前端（托盘菜单由前端管理，不在这里重建）
    WALLPAPER_MODE.store(enabled, Ordering::SeqCst);
    let _ = app.emit("wallpaper-mode-changed", enabled);

    Ok(())
}

/// 桌面模式 IPC 命令——从前端 invoke 调用
#[tauri::command]
fn set_wallpaper_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    set_wallpaper_mode_impl(&app, enabled)
}

/// 更新托盘菜单文字（多语言切换时由前端调用）
#[tauri::command]
fn set_tray_menu_texts(
    app: tauri::AppHandle,
    show: String,
    wallpaper_off: String,
    wallpaper_on: String,
    quit: String,
) -> Result<(), String> {
    let show_item = MenuItemBuilder::with_id("show", &show).build(&app)
        .map_err(|e| e.to_string())?;
    let wallpaper_text = if WALLPAPER_MODE.load(Ordering::SeqCst) { &wallpaper_on } else { &wallpaper_off };
    let wallpaper_item = MenuItemBuilder::with_id("wallpaper", wallpaper_text).build(&app)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItemBuilder::with_id("quit", &quit).build(&app)
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(&app)
        .item(&show_item)
        .separator()
        .item(&wallpaper_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(tray) = TRAY_ICON.get() {
        let _ = tray.set_menu(Some(menu));
    }

    Ok(())
}

// ─── 系统托盘 ──────────────────────────────────────────────────────

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItemBuilder::with_id("show", "打开 Minagi Alarm").build(app)?;
    let wallpaper_item = MenuItemBuilder::with_id("wallpaper", "桌面模式 ON/OFF").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "退出软件").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&wallpaper_item)
        .separator()
        .item(&quit_item)
        .build()?;

    // 使用默认窗口图标作为托盘图标
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| tauri::image::Image::new(&[255u8; 32 * 32 * 4], 32, 32));

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Minagi Alarm")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("show-from-tray", ());
                    }
                }
                "wallpaper" => {
                    // 同步处理——像 Electron 版一样直接切换，不走前端 IPC
                    let next = !WALLPAPER_MODE.load(Ordering::SeqCst);
                    let _ = set_wallpaper_mode_impl(app, next);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = app.emit("show-from-tray", ());
                }
            }
        })
        .build(app)?;

    // 存储托盘图标到全局静态，供桌面模式切换时重建菜单
    let _ = TRAY_ICON.set(tray);

    Ok(())
}

// ─── 日志 ────────────────────────────────────────────────────────

/// 从 WebView 接收错误日志，输出到终端
#[tauri::command]
fn log_error(message: String) -> Result<(), String> {
    eprintln!("[WebView Error] {}", message);
    Ok(())
}

// ─── 应用入口 ──────────────────────────────────────────────────────

fn main() {
    let builder = tauri::Builder::default()
        // 插件
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // 应用初始化
        .setup(|app| {
            // 开机自启静默启动：如果带有 --hidden 参数，窗口保持隐藏
            let is_auto_launched = std::env::args().any(|a| a == "--hidden");
            if is_auto_launched {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // 创建系统托盘
            setup_tray(app)?;

            // 直接销毁系统菜单，彻底禁止右键弹出 Restore/Move/Size/Close
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                use raw_window_handle::HasWindowHandle;
                use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMenu, DestroyMenu};
                if let Ok(w_handle) = window.window_handle() {
                    if let raw_window_handle::RawWindowHandle::Win32(win32) = w_handle.as_raw() {
                        unsafe {
                            let hmenu = GetSystemMenu(win32.hwnd.get(), 0);
                            if hmenu != 0 {
                                DestroyMenu(hmenu);
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        // 注册命令
        .invoke_handler(tauri::generate_handler![
            get_store,
            set_store,
            read_file_as_data_url,
            get_app_icon,
            write_text_file,
            set_wallpaper_mode,
            set_tray_menu_texts,
            set_window_opacity,
            log_error,
        ]);

    builder.run(tauri::generate_context!()).expect("error while running Minagi Alarm");
}
