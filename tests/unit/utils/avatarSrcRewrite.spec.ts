import { afterEach, describe, expect, it } from 'vitest'

import { installAvatarSrcRewrite } from '@/utils/avatarSrcRewrite'
import { resetOssAccess } from '@/utils/ossAccess'

afterEach(() => {
  // 卸载可能由某个用例安装的全局改写，避免污染其它测试文件
  const uninstall = installAvatarSrcRewrite()
  uninstall()
  resetOssAccess()
})

const OSS_AVATAR = 'https://tie-lian-v2.oss-cn-chengdu.aliyuncs.com/public/avatar/1.jpg?t=1'
const PROXIED = '/oss-cdn/public/avatar/1.jpg?t=1'

describe('installAvatarSrcRewrite', () => {
  it('重复安装返回同一个 uninstall（幂等）', () => {
    const first = installAvatarSrcRewrite()
    const second = installAvatarSrcRewrite()
    expect(second).toBe(first)
  })

  it('通过 el.src 赋值时把 OSS 头像改写为代理路径', () => {
    const uninstall = installAvatarSrcRewrite()
    const img = document.createElement('img')
    img.src = OSS_AVATAR
    expect(img.getAttribute('src')).toBe(PROXIED)
    uninstall()
  })

  it('通过 setAttribute 时同样改写', () => {
    const uninstall = installAvatarSrcRewrite()
    const img = document.createElement('img')
    img.setAttribute('src', OSS_AVATAR)
    expect(img.getAttribute('src')).toBe(PROXIED)
    uninstall()
  })

  it('非 OSS URL 不受影响', () => {
    const uninstall = installAvatarSrcRewrite()
    const img = document.createElement('img')
    img.src = 'https://example.com/a.png'
    expect(img.getAttribute('src')).toBe('https://example.com/a.png')
    uninstall()
  })

  it('uninstall 后恢复原生行为', () => {
    const uninstall = installAvatarSrcRewrite()
    uninstall()
    const img = document.createElement('img')
    img.src = OSS_AVATAR
    expect(img.getAttribute('src')).toBe(OSS_AVATAR)
  })
})
