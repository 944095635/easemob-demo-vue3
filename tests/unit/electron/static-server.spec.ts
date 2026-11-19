/// <reference types="node" />

import { createRequire } from 'node:module'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// electron/static-server.cjs 是 CommonJS，用 createRequire 加载（与 Electron 主进程一致）。
// 以项目根 package.json 为锚点，避免依赖 vitest 转换后不稳定的 import.meta.url。
const require = createRequire(path.join(process.cwd(), 'package.json'))
const { resolveOssUpstream } = require(path.join(process.cwd(), 'electron/static-server.cjs')) as {
  resolveOssUpstream: (requestUrl: string) => { url: string; referer: string } | null
}

const CDN = 'https://cdnv2.cntlyun.com'
const REFERER = 'https://cdnv2.cntlyun.com/'

describe('electron/static-server resolveOssUpstream', () => {
  it('把 /oss-cdn 路径转成 CDN URL 并附带防盗链 Referer', () => {
    expect(resolveOssUpstream('/oss-cdn/public/avatar/3000009.jpg?t=1778319844')).toEqual({
      url: `${CDN}/public/avatar/3000009.jpg?t=1778319844`,
      referer: REFERER,
    })
  })

  it('保留 query，且默认头像也走代理', () => {
    expect(resolveOssUpstream('/oss-cdn/static/default_avatar.jpg')).toEqual({
      url: `${CDN}/static/default_avatar.jpg`,
      referer: REFERER,
    })
  })

  it('折叠重复前导斜杠，避免拼成协议相对 URL', () => {
    expect(resolveOssUpstream('/oss-cdn//public/a.png')?.url).toBe(`${CDN}/public/a.png`)
  })

  it('非 /oss-cdn 路径返回 null（继续走静态文件）', () => {
    expect(resolveOssUpstream('/assets/index.js')).toBeNull()
    expect(resolveOssUpstream('/oss-cdnX/a.png')).toBeNull()
    expect(resolveOssUpstream('/')).toBeNull()
  })

  it('URL 规范化后不再以 /oss-cdn 开头的路径穿越被拒绝', () => {
    expect(resolveOssUpstream('/oss-cdn/../secret')).toBeNull()
  })
})
