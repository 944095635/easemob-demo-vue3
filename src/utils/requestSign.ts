/**
 * 自有服务端请求签名（对齐 Flutter NetClient.createHeaders / calculateSign）。
 *
 * 规则：
 * - 参与签名的数据先按 key 排序，拼成 k1=v1&k2=v2；无参数时为空串。
 * - signSource = `${params}&timestamp=${秒级时间戳}&key=${VITE_HTTP_SIGN_KEY}`
 * - X-Sign = MD5(signSource)（32 位小写）
 *
 * 注意：Flutter 的 TimeUtils.getTimestampStr() 返回的是**秒级**时间戳，不是毫秒。
 */

import { md5 } from '@/utils/md5'

const SIGN_KEY = import.meta.env.VITE_HTTP_SIGN_KEY || ''
/** 与 Flutter 端 pubspec 版本对齐，服务端只做记录、不参与签名 */
const CLIENT_VERSION = '2.1.8'
const CLIENT_PLATFORM = 'Web'

export type SignParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SignParamValue[]
  | { [key: string]: SignParamValue }

/** 按 key 排序拼接查询串，数组 / 对象走 JSON 序列化（与 Flutter _sortAndEncodeToQueryString 一致） */
function toSortedQueryString(params?: Record<string, SignParamValue>): string {
  if (!params) return ''
  return Object.keys(params)
    .sort()
    .filter((key) => params[key] !== null && params[key] !== undefined)
    .map((key) => {
      const value = params[key] as SignParamValue
      if (Array.isArray(value) || typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`
      }
      return `${key}=${String(value)}`
    })
    .join('&')
}

/** 生成带签名与设备信息的请求头 */
export function createRequestSignHeaders(params?: Record<string, SignParamValue>): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const queryString = toSortedQueryString(params)
  const signSource = queryString
    ? `${queryString}&timestamp=${timestamp}&key=${SIGN_KEY}`
    : `timestamp=${timestamp}&key=${SIGN_KEY}`

  return {
    'X-Sign': md5(signSource),
    'X-Timestamp': timestamp,
    'Content-Type': 'application/json',
    platform: encodeURIComponent(CLIENT_PLATFORM),
    version: CLIENT_VERSION,
  }
}
