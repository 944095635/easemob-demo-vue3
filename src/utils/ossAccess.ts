/**
 * OSS / CDN 读链路约定（移植自 iron_chat 的 lib/helper/oss_access.dart）。
 *
 * 背景：头像等图片托管在阿里云 OSS / CDN，桶开启了 Referer 防盗链白名单，
 * 只有携带 `Referer: https://cdnv2.cntlyun.com/` 的请求才返回 200，
 * 其它来源（含浏览器直接访问、localhost）一律 403 denied by Referer ACL。
 *
 * 浏览器无法用 JS 给 <img> 设置自定义 Referer（Referer 是 forbidden header，
 * referrerPolicy 也只能从当前页面派生），因此本模块把「注入 Referer」这件事
 * 交给同源代理（见 vite.config.ts 的 /oss-cdn 代理），这里只负责三部分纯逻辑：
 *   1. 识别 OSS/CDN 分发域名（isOssDistributionHost）
 *   2. GET/HEAD 把 OSS 源站域名改写到 CDN、并把分发域名强制升级 HTTPS（rewriteUrl）
 *   3. 把绝对 OSS/CDN URL 转成走同源代理的路径（toProxyUrl）
 * 步骤 2、3 对应 Flutter OssHttpOverrides 的 _open；步骤 1 的 header 注入由代理完成。
 */

/** 默认 CDN 域名（与 Flutter OssAccess.defaultCdnHost 一致） */
export const DEFAULT_CDN_HOST = 'cdnv2.cntlyun.com'
/** OSS 源站桶域名（与 Flutter OssAccess.bucketHost 一致） */
export const BUCKET_HOST = 'tie-lian-v2.oss-cn-chengdu.aliyuncs.com'
/** 同源代理路径前缀（vite.config.ts 中 /oss-cdn 代理对应） */
export const PROXY_PREFIX = '/oss-cdn'

let publicBase = `https://${DEFAULT_CDN_HOST}`
let referer = `https://${DEFAULT_CDN_HOST}/`

function ensureHttps(url: string): string {
  if (url.startsWith('http://')) return `https://${url.slice(7)}`
  if (url.startsWith('https://')) return url
  return `https://${url}`
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/** 配置读链路的 publicBase / referer，行为对齐 Dart OssAccess.apply */
export function applyOssAccess(options: { publicBase?: string; referer?: string } = {}): void {
  const base = options.publicBase?.trim() ?? ''
  if (base) publicBase = ensureHttps(stripTrailingSlash(base))

  let ref = options.referer?.trim() ?? ''
  if (ref) {
    if (!ref.startsWith('http://') && !ref.startsWith('https://')) ref = `https://${ref}`
    referer = ref.endsWith('/') ? ref : `${ref}/`
  }
}

/** 仅供测试隔离：恢复模块内默认配置 */
export function resetOssAccess(): void {
  publicBase = `https://${DEFAULT_CDN_HOST}`
  referer = `https://${DEFAULT_CDN_HOST}/`
}

export function getPublicBase(): string {
  return publicBase
}

export function getReferer(): string {
  return referer
}

/** 从 publicBase 解析出 CDN host，解析失败回退默认域名 */
export function getCdnHost(): string {
  try {
    return new URL(publicBase).hostname || DEFAULT_CDN_HOST
  } catch {
    return DEFAULT_CDN_HOST
  }
}

/**
 * 是否 OSS / CDN 分发域名：配置的 CDN host、源站桶、默认 CDN host，
 * 或任意 `*.oss-*.aliyuncs.com`。行为对齐 Dart OssAccess.isOssDistributionHost。
 */
export function isOssDistributionHost(host: string): boolean {
  const h = host.toLowerCase()
  if (!h) return false
  const cdn = getCdnHost().toLowerCase()
  if (h === cdn || h === BUCKET_HOST || h === DEFAULT_CDN_HOST) return true
  return h.includes('.oss-') && h.endsWith('.aliyuncs.com')
}

/** 解析绝对 URL；相对 / 非法 URL 返回 null */
function parseUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

/**
 * GET/HEAD 请求把 OSS 源站桶域名改写到 CDN（避免用 OSS 默认域名分发），
 * 并对分发域名强制 HTTPS。行为对齐 Dart OssAccess.rewriteRequest。
 * 非 OSS / 非 GET/HEAD 场景原样返回。
 */
export function rewriteUrl(input: string, method = 'GET'): string {
  const url = parseUrl(input)
  if (!url) return input

  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD') {
    const host = url.hostname.toLowerCase()
    const cdn = getCdnHost()
    if (host === BUCKET_HOST && cdn && host !== cdn.toLowerCase()) {
      url.protocol = 'https:'
      url.host = cdn
    }
  }
  if (url.protocol === 'http:' && isOssDistributionHost(url.hostname)) {
    url.protocol = 'https:'
  }
  return url.toString()
}

/** 对齐 Dart OssAccess.headersFor：分发域名返回需注入的 Referer 头 */
export function headersFor(input: string): Record<string, string> {
  const host = parseUrl(input)?.hostname ?? ''
  return isOssDistributionHost(host) ? { Referer: referer } : {}
}

/**
 * 把 OSS / CDN 绝对 URL 转成同源代理路径，保留 path / query / hash，
 * 让代理注入 Referer（浏览器自身做不到）。非 OSS URL、data/blob/相对 URL 原样返回。
 * 幂等：已是代理路径时不再改写。
 */
export function toProxyUrl(input: string, prefix: string = PROXY_PREFIX): string {
  if (!input || input.startsWith(`${prefix}/`) || input === prefix) return input

  const rewritten = rewriteUrl(input, 'GET')
  const url = parseUrl(rewritten)
  if (!url || !isOssDistributionHost(url.hostname)) return input
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return input

  return `${prefix}${url.pathname}${url.search}${url.hash}`
}
