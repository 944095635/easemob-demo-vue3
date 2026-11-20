/**
 * 系统通知消息（event === 'notice'）解析工具，对齐 Flutter SystemMsg。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：CUSTOM 消息 event === 'notice' → SystemMsg；
 * - lib/model/message.dart SystemMsg.format()：
 *     text = params["text"]；operator / members 为 JSON 字符串，解析出
 *     {user_id, nickname}，再由 UserIdUtils.getChatIdByUserId 转成 "tielian-xxx"；
 * - lib/page/chat/message/render/message_system_render.dart：灰色 12.5px 文案，
 *   文本中出现的昵称渲染为蓝色可点击；
 * - lib/page/chat/message/message_item.dart：系统消息无气泡/无内边距，最大宽 260，居中。
 *
 * 本模块只做纯解析；头像/链接不涉及，文本中的用户点击由组件打开 UIKit 用户名片。
 */
import { getCustomEvent } from './customMessage'
import type { UiMessage } from '@easemob-community/uikit-im'

/** 系统通知 event（对齐 Flutter case "notice" / createNoticeMsg） */
export const NOTICE_EVENT = 'notice'

/** IM chatId 前缀，对齐 Flutter Configs.prefixId */
const CHAT_ID_PREFIX = 'tielian-'

interface NoticeUser {
  nickname: string
  chatUserId: string
}

export interface SystemNoticeSegment {
  /** 展示文本 */
  text: string
  /** 有值时为可点击的用户名，对应 IM chatId */
  chatUserId?: string
}

export interface SystemNoticeView {
  /** 系统消息正文（params.text） */
  text: string
  /** 按 Flutter 规则拆分出的普通/用户名片段 */
  segments: SystemNoticeSegment[]
}

/** 是否为系统通知消息 */
export function isSystemNoticeMessage(message: UiMessage): boolean {
  return getCustomEvent(message) === NOTICE_EVENT
}

/** 对齐 Dart int.tryParse：仅纯整数字符串可解析，否则 0 */
function tryParseInt(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return 0
  const raw = String(value).trim()
  if (!/^-?\d+$/.test(raw)) return 0
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? 0 : n
}

/** 数字 uid → IM chatId，幂等；uid<=0 返回空串 */
function toChatUserId(userId: number): string {
  if (userId <= 0) return ''
  const raw = String(userId)
  return raw.startsWith(CHAT_ID_PREFIX) ? raw : `${CHAT_ID_PREFIX}${raw}`
}

/** 解析 params 中的 operator / members JSON（对齐 SystemMsg.format 的容错语义） */
function parseNoticeUsers(raw: string | undefined): NoticeUser[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const user = item as Record<string, unknown>
      const nickname = typeof user.nickname === 'string' ? user.nickname : ''
      const chatUserId = toChatUserId(tryParseInt(user.user_id))
      return nickname && chatUserId ? [{ nickname, chatUserId }] : []
    })
  } catch {
    return []
  }
}

/** Flutter MessageSystemRender._buildTextSpans：最长昵称优先，逐个匹配 */
function splitByUsers(text: string, users: NoticeUser[]): SystemNoticeSegment[] {
  if (!users.length) return [{ text }]

  const sorted = [...users].sort((a, b) => b.nickname.length - a.nickname.length)
  const segments: SystemNoticeSegment[] = []
  let remaining = text

  while (remaining) {
    let found: NoticeUser | undefined
    let foundIndex = -1
    for (const user of sorted) {
      const index = remaining.indexOf(user.nickname)
      if (index !== -1 && (foundIndex === -1 || index < foundIndex)) {
        found = user
        foundIndex = index
      }
    }

    if (!found) {
      segments.push({ text: remaining })
      break
    }
    if (foundIndex > 0) segments.push({ text: remaining.slice(0, foundIndex) })
    segments.push({ text: found.nickname, chatUserId: found.chatUserId })
    remaining = remaining.slice(foundIndex + found.nickname.length)
  }

  return segments
}

/** 解析系统通知消息内容 */
export function getSystemNoticeView(message: UiMessage): SystemNoticeView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
  const text = typeof params.text === 'string' ? params.text : ''
  const users = [
    ...parseNoticeUsers(params.operator),
    ...parseNoticeUsers(params.members),
  ]
  return { text, segments: splitByUsers(text, users) }
}
