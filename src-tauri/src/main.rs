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
/// 这次是开机自启（--hidden）——窗口再怎么样都不该自己露脸
static STARTED_HIDDEN: AtomicBool = AtomicBool::new(false);

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

/// 把文件读成 data URL——音频、图片都用它
/// 整份文件读完再 base64 会占不少内存，所以交给 async 命令去做，别堵 UI 线程
fn file_as_data_url(path: &str) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
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
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
async fn read_file_as_data_url(path: String) -> Result<Option<String>, String> {
    file_as_data_url(&path).map(Some)
}

// ─── 背景图落盘 ─────────────────────────────────────────────────────
// 以前背景图是 base64 塞进设置 JSON 的，动一下滑块就要重写好几 MB。
// 现在只在设置里留一个 "file:路径"，图片本体放 app data 目录 ✨

/// 删掉 app data 里所有旧格式的背景图
fn remove_background_files(dir: &std::path::Path) {
    for ext in ["png", "gif", "webp", "bmp", "jpg"] {
        let path = dir.join(format!("background.{}", ext));
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
}

#[tauri::command]
async fn save_background_image(app: tauri::AppHandle, data_url: String) -> Result<String, String> {
    let (header, b64) = data_url.split_once(',').ok_or("无效的图片数据")?;
    let ext = if header.contains("image/png") {
        "png"
    } else if header.contains("image/gif") {
        "gif"
    } else if header.contains("image/webp") {
        "webp"
    } else if header.contains("image/bmp") {
        "bmp"
    } else {
        "jpg"
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())?;

    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // 换图时把旧格式的也清掉，免得磁盘上堆一串没用的大图
    remove_background_files(&dir);

    let path = dir.join(format!("background.{}", ext));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 清空背景图——把落盘的图片一起删掉，别留个用不上的文件
#[tauri::command]
async fn clear_background_image(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    remove_background_files(&dir);
    Ok(())
}

// ─── 应用图标 ──────────────────────────────────────────────────────

#[tauri::command]
async fn get_app_icon(app: tauri::AppHandle) -> Result<Option<String>, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let png_path = resource_dir.join("icons/icon.png");
        if png_path.exists() {
            return file_as_data_url(&png_path.to_string_lossy()).map(Some);
        }
    }
    // 从项目目录查找
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let local_png = manifest_dir.join("icons/icon.png");
    if local_png.exists() {
        return file_as_data_url(&local_png.to_string_lossy()).map(Some);
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
        // 先读出来再按位或——直接覆盖会把窗口原有的扩展样式全抹掉
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as i32);
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
        // 同样先读再改——只动自己要动的那几位，别把别的样式顺手清掉
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let next = if transparent {
            style | WS_EX_TRANSPARENT as i32 | WS_EX_LAYERED as i32
        } else {
            // 恢复：只摘掉鼠标穿透，WS_EX_LAYERED 留着（透明度还要用）
            style & !(WS_EX_TRANSPARENT as i32)
        };
        SetWindowLongW(hwnd, GWL_EXSTYLE, next);
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

/// 系统界面的语言——托盘刚建好、前端还没来得及刷新时，先按它挑一份文字
#[cfg(target_os = "windows")]
fn system_language() -> &'static str {
    use windows_sys::Win32::Globalization::GetUserDefaultUILanguage;

    let lang_id = unsafe { GetUserDefaultUILanguage() };
    match lang_id {
        // 繁体：台湾 / 香港 / 澳门
        0x0404 | 0x0c04 | 0x1404 => "zh-TW",
        _ if lang_id & 0x3ff == 0x04 => "zh-CN",
        _ if lang_id & 0x3ff == 0x11 => "ja",
        _ => "en",
    }
}

#[cfg(not(target_os = "windows"))]
fn system_language() -> &'static str {
    "en"
}

/// 托盘菜单的初始文字——和前端 tray.* 用同一套说法，前端启动后再刷新一次
fn initial_tray_texts() -> (&'static str, &'static str, &'static str) {
    match system_language() {
        "zh-CN" => ("打开 Minagi Alarm", "桌面模式 ON/OFF", "退出软件"),
        "zh-TW" => ("開啟 Minagi Alarm", "桌面模式 ON/OFF", "退出軟體"),
        "ja" => ("Minagi Alarm を開く", "デスクトップモード ON/OFF", "終了"),
        _ => ("Open Minagi Alarm", "Desktop Mode ON/OFF", "Quit"),
    }
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let (show_text, wallpaper_text, quit_text) = initial_tray_texts();
    let show_item = MenuItemBuilder::with_id("show", show_text).build(app)?;
    let wallpaper_item = MenuItemBuilder::with_id("wallpaper", wallpaper_text).build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", quit_text).build(app)?;

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
                    reveal_main_window(app);
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
                reveal_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    // 存到全局静态——切换语言时 set_tray_menu_texts 要从这里拿到它
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

// ─── 退出 ──────────────────────────────────────────────────────────

/// 真正退出应用——「关闭时隐藏到托盘」关闭时，点 X 直接结束进程
/// 只有 exit 能结束托盘常驻的进程，hide/minimize 都只是藏起来
#[tauri::command]
fn exit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

// ─── 打开外部链接 ──────────────────────────────────────────────────

/// 用系统默认浏览器打开外部链接——B 站、GitHub 等
/// `<a target="_blank">` 在 Tauri 里点不开，必须走这里（和 VTF_Baker 一个写法）
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("打开链接失败: {}", e))
}

// ─── 系统通知 ──────────────────────────────────────────────────────

/// 把主窗口叫回来——托盘、通知点击、二次启动都走这一条
/// 桌面模式里的窗口垫在桌面最底层、还点不到，先退出来再露脸
fn reveal_main_window(app: &tauri::AppHandle) {
    if WALLPAPER_MODE.load(Ordering::SeqCst) {
        let _ = set_wallpaper_mode_impl(app, false);
    }

    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    let _ = app.emit("show-from-tray", ());
}

/// 发一条系统通知——点了通知就回到软件界面
/// 插件（tauri-plugin-notification）发的 toast 拿不到点击回调，
/// 所以这里绕开它直接用 WinRT 的 Toast，牺牲一句权限检查换来「点一下就能回去」
///
/// 通知挂在应用自己的 AppUserModelID 下面——安装包的开始菜单快捷方式里登记过它。
/// 挂到 PowerShell 名下的话 Windows 认不出是谁发的，通知会被直接吞掉（桃华踩过一次）
#[tauri::command]
fn show_alert_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let toast = tauri_winrt_notification::Toast::new(&app.config().identifier)
            .title(&title)
            .text1(&body)
            .on_activated(move |_| {
                reveal_main_window(&app);
                Ok(())
            });

        toast.show().map_err(|e| {
            eprintln!("[通知] {}", e);
            e.to_string()
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &title, &body);
        Ok(())
    }
}

// ─── 启动 ────────────────────────────────────────────────────────

/// 前端画好了——现在可以把窗口露出来了
/// 窗口在配置里是 visible: false，等这一声再 show，冷启动就不会先闪一下白底
/// 开机自启（--hidden）时就算前端说了也不算，继续藏着
#[tauri::command]
fn show_window_when_ready(app: tauri::AppHandle) {
    if STARTED_HIDDEN.load(Ordering::SeqCst) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(debug_assertions)]
        eprintln!("[启动] 前端就绪，窗口显示");
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 兜底：前端要是没走到「画好了」（加载失败之类），过一会儿自己露面
/// 不能让窗口永远藏着——那看起来就跟没启动一样
fn spawn_show_fallback(app: tauri::AppHandle) {
    // 等的时间给得宽一点——正常启动根本走不到这里，真走到了说明前端出了事
    let delay = if cfg!(debug_assertions) { 8 } else { 15 };
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(delay));
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if !window.is_visible().unwrap_or(false) {
            #[cfg(debug_assertions)]
            eprintln!("[启动] 兜底显示（前端没来打招呼）");
            let _ = window.show();
        }
    });
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
            reveal_main_window(app);
        }))
        // 应用初始化
        .setup(|app| {
            // 开机自启静默启动：如果带有 --hidden 参数，窗口保持隐藏
            let is_auto_launched = std::env::args().any(|a| a == "--hidden");
            STARTED_HIDDEN.store(is_auto_launched, Ordering::SeqCst);
            if !is_auto_launched {
                spawn_show_fallback(app.handle().clone());
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
            save_background_image,
            clear_background_image,
            get_app_icon,
            write_text_file,
            set_wallpaper_mode,
            set_tray_menu_texts,
            set_window_opacity,
            log_error,
            exit_app,
            open_external,
            show_alert_notification,
            show_window_when_ready,
        ]);

    builder.run(tauri::generate_context!()).expect("error while running Minagi Alarm");
}
