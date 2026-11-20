/**
 * 自有服务端好友接口（迁移自 Flutter FriendApi）。
 *
 * - POST /api/user/search  { keyword }                       搜索用户（铁恋号 / 手机号）
 * - GET  /api/user/{id}?easemob_group_id=...                 获取用户资料
 * - POST /api/friend/apply { to_user_id, message, remark, source }  发送好友申请
 * - DELETE /api/friend/{userId}                                   删除好友（对齐 Flutter FriendApi.deleteFriend）
 * - GET  /api/friend/requests?page&page_size                      好友申请列表（对齐 Flutter FriendApi.requests）
 * - POST /api/friend/request/handle { request_id, action, remark? } 同意/忽略好友申请
 * - DELETE /api/friend/request/{id} / DELETE /api/friend/requests/clear 删除单条 / 一键清空
 *
 * 请求头：X-Sign / X-Timestamp / Authorization / platform / version（见 requestSign.ts）。
 * GET/DELETE 参数（query 或 path 拼串）与 POST body 都参与签名（与 Flutter NetClient 一致）。
 * Web 使用登录页输入的 webApiToken 作为 Authorization（request.ts 拦截器统一注入）。
 * 成功判断由 request.ts 统一处理（code !== 0 抛错）；本模块只负责发请求与字段解析。
 */
import { http } from '@/api/request'
import { createRequestSignHeaders } from '@/utils/requestSign'

/** 生产 baseURL 带 /api 前缀时不再重复拼；dev baseURL 为 /api（代理保留前缀） */
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

function apiPath(path: string): string {
  return `${BASE_HAS_API_PREFIX ? '' : '/api'}${path}`
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return 0
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return value === 'true' || value === 1
}

/** 搜索结果项（对齐 Flutter UserSearchInfo.fromJson） */
export interface UserSearchInfo {
  userId: number
  tlId: string
  nickname: string
  avatar: string
  gender: number
  signature: string
  isFriend: boolean
  canAdd: boolean
  /** 服务端返回的来源值（search_chat_id / search_mobile 等），发起申请时原样透传 */
  source: string
}

/** 用户资料（对齐 Flutter UserInfo.fromJson，只取资料页/申请页需要的字段） */
export interface UserDetail {
  userId: number
  tlId: string
  nickname: string
  avatar: string
  gender: number
  signature: string
  profileCover: string
  isSelf: boolean
  isFriend: boolean | null
  isBlocked: boolean | null
  friendRemark: string
  friendAddedAt: number
  vip: boolean
  commonFriendCount: number
  commonGroupCount: number
  groupJoin: {
    joinedAt: number
    source: string
    inviterId: number
    inviterNickname: string
  } | null
}

type RawRecord = Record<string, unknown>

function parseSearchItem(raw: RawRecord): UserSearchInfo {
  return {
    userId: toNumber(raw.id ?? raw.user_id),
    tlId: toStr(raw.chat_id ?? raw.tlId),
    nickname: toStr(raw.nickname),
    avatar: toStr(raw.avatar),
    gender: toNumber(raw.gender),
    signature: toStr(raw.signature),
    isFriend: toBool(raw.is_friend),
    canAdd: toBool(raw.can_add),
    source: toStr(raw.source),
  }
}

function parseUserDetail(raw: RawRecord): UserDetail {
  const groupJoin = raw.group_join
  return {
    userId: toNumber(raw.id ?? raw.user_id),
    tlId: toStr(raw.chat_id ?? raw.tlId),
    nickname: toStr(raw.nickname),
    avatar: toStr(raw.avatar),
    gender: toNumber(raw.gender),
    signature: toStr(raw.signature),
    profileCover: toStr(raw.profile_cover),
    isSelf: toBool(raw.is_self),
    isFriend: raw.is_friend === undefined || raw.is_friend === null ? null : toBool(raw.is_friend),
    isBlocked: raw.is_blocked === undefined || raw.is_blocked === null ? null : toBool(raw.is_blocked),
    friendRemark: toStr(raw.friend_remark),
    friendAddedAt: toNumber(raw.friend_added_at),
    vip: toBool(raw.is_vip ?? raw.vip),
    commonFriendCount: toNumber(raw.common_friend_count),
    commonGroupCount: toNumber(raw.common_group_count),
    groupJoin:
      groupJoin && typeof groupJoin === 'object'
        ? {
            joinedAt: toNumber((groupJoin as RawRecord).joined_at),
            source: toStr((groupJoin as RawRecord).source),
            inviterId: toNumber((groupJoin as RawRecord).inviter_id),
            inviterNickname: toStr((groupJoin as RawRecord).inviter_nickname),
          }
        : null,
  }
}

/** 搜索用户：服务端返回 { list: [...] }（ApiPageResponse），兼容直接数组 */
export async function searchUsers(keyword: string): Promise<UserSearchInfo[]> {
  const target = keyword.trim()
  if (!target) return []
  const body = { keyword: target }
  const data = await http.post<unknown>(apiPath('/user/search'), body, {
    headers: createRequestSignHeaders(body),
  })

  const list = Array.isArray(data)
    ? data
    : ((data as RawRecord | null)?.list ?? (data as RawRecord | null)?.data ?? [])
  if (!Array.isArray(list)) return []
  return list
    .filter((item): item is RawRecord => !!item && typeof item === 'object')
    .map(parseSearchItem)
}

/** 获取用户资料；groupId 来自群成员入口，用于返回进群信息 */
export async function getUserDetail(userId: number, groupId?: string): Promise<UserDetail | null> {
  if (!userId) return null
  const signParams: Record<string, string> = {}
  if (groupId) signParams.easemob_group_id = groupId
  const data = await http.get<unknown>(apiPath(`/user/${userId}`), {
    params: signParams,
    headers: createRequestSignHeaders(signParams),
  })
  if (!data || typeof data !== 'object') return null
  // 兼容少数接口把实体再包一层 data 的情况
  const raw = ((data as RawRecord).user ?? (data as RawRecord).data ?? data) as RawRecord
  return parseUserDetail(raw)
}

/** 好友申请来源（与 Flutter UserSourceType.source 完全一致） */
export type FriendApplySource =
  | ''
  | 'unknown'
  | 'card'
  | 'qrcode'
  | 'search_chat_id'
  | 'search_mobile'
  | 'chat'
  | 'group'
  | 'circle'
  | 'friend_request'
  | 'group_request'

export interface SendFriendApplyParams {
  toUserId: number
  /** 申请理由（≤50 字），空时按 App 默认文案发送 */
  message?: string
  /** 给对方设置的初始备注（≤30 字，页面限制 20） */
  remark?: string
  source: FriendApplySource
}

/** 发送好友申请：POST /api/friend/apply，body 参数参与签名 */
export async function sendFriendApply({
  toUserId,
  message,
  remark,
  source,
}: SendFriendApplyParams): Promise<void> {
  const body: Record<string, string | number> = {
    to_user_id: toUserId,
    message: message || '我想添加你为好友',
    source,
  }
  if (remark?.trim()) body.remark = remark.trim()
  await http.post<void>(apiPath('/friend/apply'), body, {
    headers: createRequestSignHeaders(body),
  })
}

/**
 * 删除好友：DELETE /api/friend/{userId}
 * 对齐 Flutter FriendApi.deleteFriend：无 body / query，userId 走 path，
 * 错误码 130007 表示非好友关系（提示文案由 request.ts 统一抛出）。
 */
export async function deleteFriend(userId: number): Promise<void> {
  if (!userId || !Number.isFinite(userId)) throw new Error('用户 ID 无效')
  await http.delete<void>(apiPath(`/friend/${userId}`), {
    headers: createRequestSignHeaders(),
  })
}

/* ===== 好友申请列表（对齐 Flutter FriendApi.requests / handle / delete / clear） ===== */

/** 好友申请处理状态（对齐 Flutter HandleStatus.value） */
export type FriendRequestStatus = 'unknown' | 'pending' | 'accepted' | 'rejected' | 'restricted'

/** 好友申请记录（对齐 Flutter UserRequestsModel.fromJson） */
export interface FriendRequest {
  /** 申请记录 ID（handle/delete 用） */
  id: number
  /** 申请人数字 userId */
  userId: number
  nickname: string
  avatar: string
  /** 验证消息（申请理由） */
  message: string
  /** 备注（非空时昵称后显示「(备注:xxx)」） */
  remark: string
  status: FriendRequestStatus
  /** 秒级时间戳 */
  createdAt: number
  /** 来源原始值（search_chat_id / qrcode / group ...），用 resolveFriendSource 映射展示 */
  source: string
}

/** 好友申请分页结果（对齐 Flutter ApiPageResponse） */
export interface FriendRequestPage {
  list: FriendRequest[]
  total: number
  page: number
  pageSize: number
}

function parseFriendRequest(raw: RawRecord): FriendRequest {
  return {
    id: toNumber(raw.id),
    userId: toNumber(raw.user_id),
    nickname: toStr(raw.nickname),
    avatar: toStr(raw.avatar),
    message: toStr(raw.message),
    remark: toStr(raw.remark),
    status: (toStr(raw.status) || 'unknown') as FriendRequestStatus,
    createdAt: toNumber(raw.created_at),
    source: toStr(raw.source),
  }
}

/** 好友申请列表：GET /api/friend/requests?page&page_size，query 参数参与签名 */
export async function getFriendRequests(page: number, pageSize = 20): Promise<FriendRequestPage> {
  const params = { page, page_size: pageSize }
  const data = await http.get<unknown>(apiPath('/friend/requests'), {
    params,
    headers: createRequestSignHeaders(params),
  })
  const raw = ((data as RawRecord | null) ?? {}) as RawRecord
  // 兼容 { list: [...] } 与直接数组两种返回
  const list = Array.isArray(raw.list)
    ? raw.list
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  return {
    list: list
      .filter((item): item is RawRecord => !!item && typeof item === 'object')
      .map(parseFriendRequest),
    total: toNumber(raw.total),
    page: toNumber(raw.page) || page,
    pageSize: toNumber(raw.page_size) || pageSize,
  }
}

/** 处理好友申请：POST /api/friend/request/handle { request_id, action, remark? } */
export async function handleFriendRequest(
  requestId: number,
  action: 'accept' | 'reject',
  remark?: string,
): Promise<void> {
  if (!requestId || !Number.isFinite(requestId)) throw new Error('申请 ID 无效')
  const body: Record<string, string | number> = { request_id: requestId, action }
  if (remark?.trim()) body.remark = remark.trim()
  await http.post<void>(apiPath('/friend/request/handle'), body, {
    headers: createRequestSignHeaders(body),
  })
}

/** 删除单条好友申请：DELETE /api/friend/request/{id}（无 body，仅时间戳+key 签名） */
export async function deleteFriendRequest(requestId: number): Promise<void> {
  if (!requestId || !Number.isFinite(requestId)) throw new Error('申请 ID 无效')
  await http.delete<void>(apiPath(`/friend/request/${requestId}`), {
    headers: createRequestSignHeaders(),
  })
}

/** 一键清空好友申请：DELETE /api/friend/requests/clear */
export async function clearFriendRequests(): Promise<void> {
  await http.delete<void>(apiPath('/friend/requests/clear'), {
    headers: createRequestSignHeaders(),
  })
}
