/**
 * Electron 主进程入口。
 *
 * 职责：
 * 1. 启动内嵌静态服务 serve dist/（随机端口，仅 127.0.0.1）
 * 2. 创建 BrowserWindow 加载本地服务
 * 3. 外部链接（环信官网、协议页等 http(s)）交给系统默认浏览器，不在应用内开新窗口
 * 4. 单实例锁、窗口生命周期、macOS quit 行为
 */

const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const { existsSync } = require('node:fs')
const { createStaticServer } = require('./static-server.cjs')

// 容器 / CI / 企业安全软件等受限环境下，Chromium 的 utility(GPU/network) 进程沙箱
// 会因 "Operation not permitted" 初始化失败并反复崩溃（表现为白屏 / ERR_FAILED）。
// 关闭进程级沙箱开关以兼容这类环境；本 App 仅加载本地可信内容，配合下方的
// contextIsolation + nodeIntegration:false，安全基线仍然完整。
if (process.env.ELECTRON_DISABLE_SANDBOX === '1' || !app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
}

let mainWindow = null
let httpServer = null
let appOrigin = ''

/** 构建产物的绝对路径：开发时是项目 dist/，打包后是 asar 内的 dist/ */
function getDistPath() {
  // app.getAppPath() 在开发时返回项目根，打包后返回 app.asar 所在应用目录
  return path.join(app.getAppPath(), 'dist')
}

/** 外部链接统一交给系统浏览器；本地资源（127.0.0.1）在应用内打开 */
function setupExternalLinks(webContents) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appOrigin)) {
      return { action: 'allow' }
    }
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

async function createWindow() {
  const distPath = getDistPath()
  if (!existsSync(path.join(distPath, 'index.html'))) {
    throw new Error(
      `[electron] 找不到构建产物：${path.join(distPath, 'index.html')}\n` +
        '请先执行 pnpm build（或 pnpm build:electron）生成 dist/ 后再启动。',
    )
  }

  // 启动本地静态服务（随机端口）
  const { server, origin } = await createStaticServer(distPath)
  httpServer = server
  appOrigin = origin

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '铁恋 IM',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // 安全基线：隔离上下文、禁用 Node 集成。
      // sandbox 关闭：本 App 只加载本地可信内容（127.0.0.1 静态服务），
      // 关闭 Chromium 沙箱可兼容企业安全软件 / 受限容器环境（这些环境下 sandbox 会
      // 因 "Operation not permitted" 导致 network/GPU 子进程反复崩溃、白屏）。
      // contextIsolation 保持开启，渲染进程无 Node 权限，安全性依然有保障。
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  setupExternalLinks(mainWindow.webContents)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(origin)
}

// 单实例锁：避免多开占用
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow().catch((err) => {
      console.error('[electron] 启动失败：', err)
      app.quit()
    })
  })

  app.on('activate', () => {
    // macOS：点击 dock 图标且无窗口时重建
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((err) => console.error('[electron] 重建窗口失败：', err))
    }
  })

  app.on('before-quit', () => {
    if (httpServer) {
      httpServer.close()
      httpServer = null
    }
  })

  // Windows/Linux：关闭所有窗口即退出；macOS 保持应用驻留
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
