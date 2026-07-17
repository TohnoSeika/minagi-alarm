# Minagi Alarm — 打包脚本
# 桃华帮 Minagi 写的，以后打包就运行这个就好啦 ✨
#
# 用法：
#   .\scripts\build-installer.ps1          # 普通打包
#   .\scripts\build-installer.ps1 -Debug    # Debug 打包（不优化，快一些）
#
# 输出：
#   dist\Minagi Alarm_<version>_x64-setup.exe

param(
    [switch]$Debug = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

Write-Host "🌸 Minagi Alarm 打包开始——桃华来帮 Minagi 做安装包哦～" -ForegroundColor Magenta
Write-Host ""

# 1. 读取版本号
$Version = (Get-Content -Raw "src-tauri\tauri.conf.json" | ConvertFrom-Json).version
Write-Host "📦 版本号: $Version" -ForegroundColor Cyan

# 2. 清理旧的构建文件
Write-Host "🧹 清理旧的构建文件..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist\*" -ErrorAction SilentlyContinue
}

# 3. 构建安装包
$BuildMode = if ($Debug) { "" } else { "" }
Write-Host "🔨 正在构建安装包（这需要几分钟哦）..." -ForegroundColor Yellow
Write-Host ""

try {
    npm run tauri:build 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "❌ 构建失败: $_" -ForegroundColor Red
    exit 1
}

# 4. 复制安装包到 dist 目录
$InstallerName = "Minagi Alarm_${Version}_x64-setup.exe"
$InstallerSource = "src-tauri\target\release\bundle\nsis\$InstallerName"

if (Test-Path $InstallerSource) {
    if (-not (Test-Path "dist")) {
        New-Item -ItemType Directory -Path "dist" | Out-Null
    }
    Copy-Item $InstallerSource "dist\$InstallerName" -Force
    Write-Host ""
    Write-Host "✅ 安装包已复制到: dist\$InstallerName" -ForegroundColor Green
} else {
    Write-Host "⚠️  没找到安装包，检查一下路径哦: $InstallerSource" -ForegroundColor Red
    exit 1
}

# 5. 完成
$FileSize = [math]::Round((Get-Item "dist\$InstallerName").Length / 1MB, 1)
Write-Host ""
Write-Host "🎀 打包完成！" -ForegroundColor Magenta
Write-Host "   文件: dist\$InstallerName" -ForegroundColor White
Write-Host "   大小: ${FileSize}MB" -ForegroundColor White
Write-Host ""
Write-Host "💝 这是桃华帮 Minagi 做的哦～" -ForegroundColor Magenta
