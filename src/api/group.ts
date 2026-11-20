/**
 * 自有服务端群资料接口（迁移自 Flutter GroupApi.getGroupInfo）。
 *
 * - GET /api/group/{easemobGroupId}
 * - 请求头：X-Sign / X-Timestamp / Authorization / platform / version（见 requestSign.ts）
 * - 群公告在 data.notice，本身是 JSON 字符串，形如：
 *   [{"type":"title","content":"..."},{"type":"text","content":"..."},{"type":"image","imagePath":"..."}]
 * - 聊天页横幅对齐 Flutter ChatNotice：只展示 title（无 title 时回退 content）。
 */

import { http } from '@/api/request'
import { createRequestSignHeaders } from '@/utils/requestSign'

/** 生产 baseURL 是域名（需带 /api）；dev baseURL 是 /api（代理保留前缀，不再重复拼） */
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

export interface GroupDetail {
  id?: number | string
  name?: string
  avatar?: string
  easemob_group_id?: string
  /** 群公告，JSON 字符串 */
  notice?: string | null
  member_count?: number
  max_member?: number
  /** 是否隐藏群成员（对齐 Flutter GroupInfo.hideMemberList / json["hide_member_list"]） */
  hide_member_list?: boolean
  owner_id?: string
  my_role?: string | number
  my_nickname?: string
  my_remark?: string
  [key: string]: unknown
}

/** notice JSON 数组的单项 */
export interface GroupNoticeItem {
  type?: string
  content?: string
  imagePath?: string
  [key: string]: unknown
}

export interface ParsedGroupNotice {
  title: string
  content: string
  image: string
}

/** 解析群公告 JSON 字符串；非 JSON 时按纯文本公告处理 */
export function parseGroupNotice(raw?: string | null): ParsedGroupNotice {
  const result: ParsedGroupNotice = { title: '', content: '', image: '' }
  if (!raw) return result

  try {
    const items = JSON.parse(raw) as unknown
    if (!Array.isArray(items)) {
      result.title = raw
      return result
    }
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const entry = item as GroupNoticeItem
      if (entry.type === 'title') result.title = entry.content || ''
      else if (entry.type === 'text') result.content = entry.content || ''
      else if (entry.type === 'image') result.image = entry.imagePath || ''
    }
  } catch {
    // 后端偶发直接下发纯文本公告，按纯文本展示
    result.title = raw
  }
  return result
}

/** 聊天页公告横幅展示文案：与 Flutter 一致取 title，缺省回退正文 */
export function getGroupAnnouncementText(detail?: GroupDetail | null): string {
  const notice = parseGroupNotice(detail?.notice)
  return notice.title || notice.content || ''
}

async function fetchGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const path = `${BASE_HAS_API_PREFIX ? '' : '/api'}/group/${encodeURIComponent(groupId)}`
  try {
    return await http.get<GroupDetail>(path, { headers: createRequestSignHeaders() })
  } catch (error) {
    console.warn('[group] fetch group detail failed:', groupId, error)
    return null
  }
}

/** 群资料内存缓存：同一群在 App 生命周期内只请求一次（对齐 Flutter GroupService.groups） */
const detailCache = new Map<string, GroupDetail>()
const pendingRequests = new Map<string, Promise<GroupDetail | null>>()

/** 读取已缓存的群公告文案；未缓存时返回 undefined */
export function getCachedGroupAnnouncementText(groupId: string): string | undefined {
  const detail = detailCache.get(groupId)
  return detail ? getGroupAnnouncementText(detail) : undefined
}

export function loadGroupDetail(groupId: string): Promise<GroupDetail | null> {
  if (!groupId) return Promise.resolve(null)
  const cached = detailCache.get(groupId)
  if (cached) return Promise.resolve(cached)

  const pending = pendingRequests.get(groupId)
  if (pending) return pending

  const task = fetchGroupDetail(groupId)
    .then((detail) => {
      if (detail) detailCache.set(groupId, detail)
      return detail
    })
    .finally(() => {
      pendingRequests.delete(groupId)
    })
  pendingRequests.set(groupId, task)
  return task
}
