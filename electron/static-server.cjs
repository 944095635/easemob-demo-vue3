/**
 * 内嵌静态 HTTP 服务：用 Node 原生 http 模块 serve Vite 构建产物（dist/）。
 *
 * 为什么用本地 HTTP 服务而不是 file://：
 * - 项目用 createWebHistory 路由 + 绝对资源路径（/assets/...），file:// 下会 404 且刷新白屏
 * - 本地服务天然支持 SPA fallback（未知路径回退 index.html）、localStorage/IndexedDB、CSP 'self'
 * - 端口绑定 127.0.0.1 + 随机端口，避免冲突、不对外暴露
 *
 * CommonJS（.cjs）：与项目 ESM 配置隔离，Electron 主进程直接 require。
 */

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

/** MIME 类型映射（覆盖本项目 dist 实际会产出的扩展名） */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/**
 * 解析请求路径到本地文件：
 * - 目录 → index.html
 * - 不存在且带非 html 扩展名 → null（让调用方 404，不回退 SPA）
 * - 其它不存在路径 → index.html（SPA fallback，支持 history 路由深链/刷新）
 */
function resolveFile(root, pathname) {
  let filePath = path.resolve(path.join(root, path.normalize(pathname)))

  // 目录穿越防护：解析后必须仍在 root 内
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null

  let isDirectory = false
  try {
    const stat = fs.statSync(filePath)
    isDirectory = stat.isDirectory()
  } catch {
    const ext = path.extname(filePath).toLowerCase()
    if (ext && ext !== '.html') return null
    return path.join(root, 'index.html')
  }

  if (isDirectory) {
    const indexFile = path.join(filePath, 'index.html')
    return fs.existsSync(indexFile) ? indexFile : null
  }
  return filePath
}

/**
 * 创建静态服务。
 *
 * @param {string} rootDir 静态根目录（dist/ 的绝对路径）
 * @returns {Promise<{ server: import('node:http').Server, port: number, origin: string }>}
 */
function createStaticServer(rootDir) {
  const root = path.resolve(rootDir)

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end()
      return
    }

    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      res.writeHead(400)
      res.end('Bad Request')
      return
    }

    const filePath = resolveFile(root, pathname)
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }

    let size = 0
    try {
      size = fs.statSync(filePath).size
    } catch {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-cache',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(filePath).pipe(res)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    // port=0 让系统分配空闲端口；仅监听 127.0.0.1，不对外暴露
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, port, origin: `http://127.0.0.1:${port}` })
    })
  })
}

module.exports = { createStaticServer, resolveFile, MIME_TYPES }
