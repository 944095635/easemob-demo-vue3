import { afterEach, describe, expect, it } from 'vitest'

import {
  BUCKET_HOST,
  DEFAULT_CDN_HOST,
  PROXY_PREFIX,
  applyOssAccess,
  getCdnHost,
  getPublicBase,
  getReferer,
  headersFor,
  isOssDistributionHost,
  resetOssAccess,
  rewriteUrl,
  toProxyUrl,
} from '@/utils/ossAccess'

const AVATAR = 'https://tie-lian-v2.oss-cn-chengdu.aliyuncs.com/public/avatar/3000009.jpg?t=1778319844'
const AVATAR_CDN = 'https://cdnv2.cntlyun.com/public/avatar/3000009.jpg?t=1778319844'

afterEach(() => resetOssAccess())

describe('ossAccess 基础配置（对齐 Dart OssAccess）', () => {
  it('默认 publicBase / referer / cdnHost', () => {
    expect(getPublicBase()).toBe(`https://${DEFAULT_CDN_HOST}`)
    expect(getReferer()).toBe(`https://${DEFAULT_CDN_HOST}/`)
    expect(getCdnHost()).toBe(DEFAULT_CDN_HOST)
  })

  it('apply 覆盖配置：https 补齐、去尾斜杠、referer 补 scheme 与尾斜杠', () => {
    applyOssAccess({ publicBase: 'http://cdn.example.com/', referer: 'cdn.example.com' })
    expect(getPublicBase()).toBe('https://cdn.example.com')
    expect(getReferer()).toBe('https://cdn.example.com/')
    expect(getCdnHost()).toBe('cdn.example.com')
  })

  it('apply 空串不覆盖默认值', () => {
    applyOssAccess({ publicBase: '   ', referer: '' })
    expect(getPublicBase()).toBe(`https://${DEFAULT_CDN_HOST}`)
    expect(getReferer()).toBe(`https://${DEFAULT_CDN_HOST}/`)
  })
})

describe('isOssDistributionHost', () => {
  it('识别 CDN host、源站桶、默认 CDN 与任意 oss aliyuncs 域名', () => {
    expect(isOssDistributionHost(DEFAULT_CDN_HOST)).toBe(true)
    expect(isOssDistributionHost(BUCKET_HOST)).toBe(true)
    expect(isOssDistributionHost('some-other.oss-cn-beijing.aliyuncs.com')).toBe(true)
    expect(isOssDistributionHost('CDNV2.CNTLYUN.COM')).toBe(true)
  })

  it('非 OSS 域名与空串返回 false', () => {
    expect(isOssDistributionHost('appserver.easesdk.com')).toBe(false)
    expect(isOssDistributionHost('example.com')).toBe(false)
    expect(isOssDistributionHost('')).toBe(false)
  })

  it('使用 apply 后的自定义 CDN host', () => {
    applyOssAccess({ publicBase: 'https://my-cdn.example.com' })
    expect(isOssDistributionHost('my-cdn.example.com')).toBe(true)
  })
})

describe('rewriteUrl（对齐 Dart rewriteRequest）', () => {
  it('GET 把 OSS 源站桶改写为 CDN，保留 path 与 query', () => {
    expect(rewriteUrl(AVATAR, 'GET')).toBe(AVATAR_CDN)
  })

  it('HEAD 同样改写，POST 不改写 host', () => {
    expect(rewriteUrl(AVATAR, 'HEAD')).toBe(AVATAR_CDN)
    expect(rewriteUrl(AVATAR, 'POST')).toBe(AVATAR)
  })

  it('http 的分发域名强制升级 https', () => {
    expect(rewriteUrl('http://cdnv2.cntlyun.com/static/default_avatar.jpg')).toBe(
      'https://cdnv2.cntlyun.com/static/default_avatar.jpg',
    )
  })

  it('非 OSS URL 原样返回', () => {
    const url = 'https://appserver.easesdk.com/a.png'
    expect(rewriteUrl(url)).toBe(url)
  })

  it('相对 / 非法 URL 原样返回', () => {
    expect(rewriteUrl('/static/logo.png')).toBe('/static/logo.png')
  })
})

describe('headersFor', () => {
  it('OSS/CDN 域名返回需注入的 Referer', () => {
    expect(headersFor(AVATAR)).toEqual({ Referer: `https://${DEFAULT_CDN_HOST}/` })
  })

  it('非 OSS 域名返回空对象', () => {
    expect(headersFor('https://example.com/a.png')).toEqual({})
    expect(headersFor('/static/logo.png')).toEqual({})
  })
})

describe('toProxyUrl', () => {
  it('把 OSS 桶 URL 改写为同源代理路径，保留 query', () => {
    expect(toProxyUrl(AVATAR)).toBe(`${PROXY_PREFIX}/public/avatar/3000009.jpg?t=1778319844`)
  })

  it('CDN URL 同样改写', () => {
    expect(toProxyUrl(AVATAR_CDN)).toBe(`${PROXY_PREFIX}/public/avatar/3000009.jpg?t=1778319844`)
  })

  it('http 分发域名先升级 https 再改写', () => {
    expect(toProxyUrl('http://cdnv2.cntlyun.com/static/default_avatar.jpg')).toBe(
      `${PROXY_PREFIX}/static/default_avatar.jpg`,
    )
  })

  it('已是代理路径时幂等', () => {
    const proxied = `${PROXY_PREFIX}/public/avatar/3000009.jpg?t=1778319844`
    expect(toProxyUrl(proxied)).toBe(proxied)
  })

  it('非 OSS / data / blob / 相对 URL 原样返回', () => {
    expect(toProxyUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(toProxyUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx')
    expect(toProxyUrl('blob:https://example.com/uuid')).toBe('blob:https://example.com/uuid')
    expect(toProxyUrl('/static/logo.png')).toBe('/static/logo.png')
    expect(toProxyUrl('')).toBe('')
  })
})
