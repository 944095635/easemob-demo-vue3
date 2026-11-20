/**
 * 自有服务端个人资料接口（迁移自 Flutter UserApi.getProfile / UserService.getUserInfo）。
 *
 * - GET /api/user/profile
 * - 请求头：X-Sign / X-Timestamp / Authorization / platform / version（见 requestSign.ts，
 *   Authorization 由 request.ts 拦截器统一注入）
 * - 返回 data 对齐 Flutter UserInfo：id / chat_id / nickname / avatar / signature / gender / ...
 * - 拉取结果缓存到 localStorage（按 userId 隔离），供下次启动首屏立即展示，失败时用缓存兜底。
 */

import { http } from '@/api/request'
import { createRequestSignHeaders } from '@/utils/requestSign'

/** 生产 baseURL 是域名（需带 /api）；dev baseURL 是 /api（代理保留前缀，不再重复拼） */
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

const PROFILE_CACHE_KEY_PREFIX = 'webImUserProfile:'

/** 个人资料（字段对齐 Flutter lib/model/user_info.dart UserInfo.fromJson） */
export interface UserProfile {
  id?: number | string
  chat_id?: string
  nickname?: string
  avatar?: string
  signature?: string
  gender?: number
  profile_cover?: string
  dynamic_cover?: string
  is_vip?: boolean
  vip_expires_time?: number
  grade_id?: number
  is_self?: boolean
  mobile?: string
  [key: string]: unknown
}

interface CachedProfile {
  profile: UserProfile
  cachedAt: number
}

function cacheKey(userId: string): string {
  return `${PROFILE_CACHE_KEY_PREFIX}${userId}`
}

/** 读取本地缓存的个人资料（不做时效校验，仅用于首屏兜底） */
export function getCachedProfile(userId: string): UserProfile | null {
  if (!userId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProfile
    return parsed?.profile ?? null
  } catch {
    return null
  }
}

/** 将个人资料写入本地缓存（按 userId 隔离，避免切换账号串号） */
export function cacheProfile(userId: string, profile: UserProfile): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    const payload: CachedProfile = { profile, cachedAt: Date.now() }
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload))
  } catch {
    // 隐私模式 / 配额满时静默降级，不影响主流程
  }
}

/** 清除本地缓存的个人资料；不传 userId 时清空全部 */
export function clearCachedProfile(userId?: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (userId) {
      localStorage.removeItem(cacheKey(userId))
      return
    }
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(PROFILE_CACHE_KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

/** 从服务端拉取当前登录用户个人资料；失败返回 null（由调用方用缓存兜底） */
export async function fetchUserProfile(): Promise<UserProfile | null> {
  const path = `${BASE_HAS_API_PREFIX ? '' : '/api'}/user/profile`
  try {
    return await http.get<UserProfile>(path, { headers: createRequestSignHeaders() })
  } catch (error) {
    console.warn('[profile] fetch user profile failed:', error)
    return null
  }
}
