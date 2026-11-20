/**
 * 个人资料加载与回填。
 *
 * 需求：每次打开 web 程序就获取一次个人资料，并缓存到本地。
 * - 启动时（AppInitializer 自动登录成功）：先用 localStorage 缓存回填首屏，再拉取最新资料
 * - 手动登录成功（LoginForm）：立即拉取一次
 * - 拉取失败时用本地缓存兜底，保证头像/昵称不因接口抖动而丢失
 *
 * 回填走 UIKit 的 userInfo store（与设置页头像上传一致的范式），
 * 侧边栏头像、昵称、聊天页等所有依赖 useOwnUserInfo / useUserInfo 的位置都会同步刷新。
 */

import { shallowRef } from 'vue'
import { useUserInfoStore } from '@easemob-community/uikit-im'

import {
  cacheProfile,
  fetchUserProfile,
  getCachedProfile,
  type UserProfile,
} from '@/api/profile'
import { useUserStore } from '@/store/modules/user'

/**
 * 当前登录用户的完整资料（服务端字段，UIKit UserInfo store 不含 chat_id / 封面 / VIP 等）。
 * 由 loadUserProfile / restoreCachedUserProfile 写入，账户信息页等直接读取展示。
 */
const currentProfile = shallowRef<UserProfile | null>(null)

/** 读取当前用户完整资料（响应式，供展示组件订阅） */
export function useCurrentProfile() {
  return currentProfile
}

/** 解析要加载的用户 ID：显式传入优先，否则取当前登录用户 */
function resolveUserId(explicit?: string): string {
  return explicit || useUserStore().userId || ''
}

/**
 * 把个人资料回填到 UIKit 用户资料 store 与 user store。
 * - 只覆盖服务端有值的字段，其它字段（ext / birth / mail 等）沿用 store 已有值，
 *   避免把 SDK 侧已拉取的资料清掉。
 */
export function applyUserProfile(profile: UserProfile, userId?: string): void {
  const uid = resolveUserId(userId)
  if (!uid || !profile) return

  // 保存完整资料供页面读取（含 UIKit store 不含的 chat_id / 封面 / VIP 字段）
  currentProfile.value = profile

  const userInfoStore = useUserInfoStore()
  const userStore = useUserStore()
  const existing = userInfoStore.getUserInfo(uid)

  userInfoStore.setUserInfo({
    userId: uid,
    nickname: profile.nickname || existing?.nickname,
    avatarUrl: profile.avatar || existing?.avatarUrl,
    sign: profile.signature ?? existing?.sign,
    gender: profile.gender ?? existing?.gender,
    mail: existing?.mail,
    phone: existing?.phone,
    birth: existing?.birth,
    ext: existing?.ext,
  })

  if (profile.nickname) {
    userStore.setNickname(profile.nickname)
    userStore.persistToStorage()
  }
}

/** 用本地缓存回填首屏；返回是否命中缓存 */
export function restoreCachedUserProfile(userId?: string): boolean {
  const uid = resolveUserId(userId)
  if (!uid) return false
  const cached = getCachedProfile(uid)
  if (!cached) return false
  applyUserProfile(cached, uid)
  return true
}

/** 拉取最新个人资料 → 写本地缓存 → 回填 store；失败时用缓存兜底 */
export async function loadUserProfile(userId?: string): Promise<UserProfile | null> {
  const uid = resolveUserId(userId)
  if (!uid) return null

  const profile = await fetchUserProfile()
  if (profile) {
    cacheProfile(uid, profile)
    applyUserProfile(profile, uid)
    return profile
  }

  const cached = getCachedProfile(uid)
  if (cached) applyUserProfile(cached, uid)
  return cached
}

/**
 * 确保当前用户资料已就绪（页面兜底用）。
 * 启动/登录流程已拉取过时不重复请求；否则先读缓存回填，仍无则请求网络。
 */
export async function ensureUserProfile(userId?: string): Promise<UserProfile | null> {
  const uid = resolveUserId(userId)
  if (!uid) return null
  if (currentProfile.value) return currentProfile.value
  if (restoreCachedUserProfile(uid)) return currentProfile.value
  return loadUserProfile(uid)
}
