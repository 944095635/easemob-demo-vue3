/**
 * 名片消息（card / userCard）解析工具。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：CUSTOM 消息按 event === 'card'（环信名片）或
 *   'userCard'（铁恋名片）识别，两者都映射为 CardMsg；发送端 createCardMsg 只发 'card'。
 *   params = { uid: 数字字符串, name: 昵称/原名, avatar: 头像 URL }。
 * - lib/model/message.dart CardMsg.format()：
 *     userId = int.tryParse(params["uid"]) ?? 0
 *     name = params["name"]
 *     userAvatar = params["avatar"]
 *     userChatId = UserIdUtils.getChatIdByUserId(userId)  // 数字 uid → "tielian-xxx"
 * - lib/page/chat/chat_page.dart：点击时 userId > 0 跳 UserInfoPage，否则 toast「名片已过期」。
 *
 * 本模块只做纯解析，不做 URL 改写：头像 <img src> 由全局 avatarSrcRewrite 统一走
 * /oss-cdn 代理，与其它自定义消息解析工具职责一致。
 */
import { getCustomEvent } from './customMessage'
import type { UiMessage } from '@easemob-community/uikit-im'

/** 环信标准名片 event（对齐 Flutter case "card" / MsgType.card.name） */
export const CARD_EVENT = 'card'
/** 铁恋自定义名片 event（对齐 Flutter case "userCard"，历史消息兼容） */
export const USER_CARD_EVENT = 'userCard'

const CARD_EVENTS = new Set<string>([CARD_EVENT, USER_CARD_EVENT])

/** 是否为名片消息：custom 类型且 event 为 card 或 userCard */
export function isCardMessage(message: UiMessage): boolean {
  return CARD_EVENTS.has(getCustomEvent(message))
}

/** IM chatId 前缀，对齐 Flutter Configs.prefixId（UserIdUtils.getChatIdByUserId） */
const CHAT_ID_PREFIX = 'tielian-'

/**
 * 对齐 Dart int.tryParse：仅纯整数字符串可解析，否则 0。
 * Flutter 发送端 uid 为纯数字字符串；若收到带前缀的值（历史数据）则按 Dart 语义解析为 0。
 */
function tryParseInt(value: string | undefined): number {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return 0
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? 0 : n
}

/** 数字 uid → IM chatId，幂等（已带前缀不重复添加）；uid<=0 返回空串 */
function toChatUserId(userId: number): string {
  if (userId <= 0) return ''
  const raw = String(userId)
  return raw.startsWith(CHAT_ID_PREFIX) ? raw : `${CHAT_ID_PREFIX}${raw}`
}

export interface CardView {
  /** 被推荐用户数字 ID（对齐 Dart int.tryParse，解析失败为 0） */
  userId: number
  /** IM chatId（tielian-xxx），用于 UIKit 用户资料弹窗 */
  chatUserId: string
  /** 昵称/原名（发送端强制用 originalName，禁止备注名） */
  name: string
  /** 头像 URL，缺失时为空串 */
  avatar: string
  /** 名片是否已过期（userId <= 0），点击时提示「名片已过期」 */
  expired: boolean
}

/**
 * 解析名片消息内容。
 * UIKit 的 CustomMessageBody.params 为 Record<string, string>，
 * 与 Flutter 按字符串读取 params 一致。
 */
export function getCardView(message: UiMessage): CardView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
  const userId = tryParseInt(params.uid)
  return {
    userId,
    chatUserId: toChatUserId(userId),
    name: typeof params.name === 'string' ? params.name : '',
    avatar: typeof params.avatar === 'string' ? params.avatar : '',
    expired: userId <= 0,
  }
}
