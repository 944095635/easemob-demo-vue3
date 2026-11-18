import { CONVERSATION_TYPE } from '@easemob-community/uikit-im'
import type { ConversationTypeValue } from '@easemob-community/uikit-im'

/**
 * 环信离线推送模板扩展字段。
 *
 * 对齐社区 Flutter Demo（iron_chat）的 MessageHelper.fixPushName：
 * 发送消息时把推送模板写进消息扩展字段（ext / attributes），
 * 由服务端读取该字段渲染 APNs / 厂商离线推送文案。
 *
 * 字段协议：
 * - `name`：群聊 `groupmsg` / 单聊 `privatemsg`；文本消息追加 `_text` 后缀
 * - `title_args`：推送标题参数，第一个为发送者昵称
 * - `content_args`：推送内容参数，仅非文本消息携带（如 `[图片]`）
 */

/** 推送模板在消息 ext 中的字段名（协议固定，勿改） */
export const PUSH_TEMPLATE_KEY = 'em_push_template' as const

/** 推送模板 name 前缀（协议固定） */
export const PUSH_NAME_PREFIX = {
  group: 'groupmsg',
  single: 'privatemsg',
} as const

/**
 * 各类消息的推送内容摘要（协议占位符，与 Flutter Demo 一致）。
 * `text` 为 null：文本消息不带 content_args，由 name 的 `_text` 后缀区分。
 */
export const PUSH_CONTENT_SUMMARY = {
  text: null,
  image: '[图片]',
  file: '[文件]',
  voice: '[语音]',
  video: '[视频]',
  location: '[位置]',
  custom: '[消息]',
  cmd: '[消息]',
  combine: '[聊天记录]',
  multiBody: '[消息]',
} as const

export type PushContentSummary = (typeof PUSH_CONTENT_SUMMARY)[keyof typeof PUSH_CONTENT_SUMMARY]

/** 消息扩展字段（透传，可含 UIKit 自有字段） */
export type MessageExt = Record<string, unknown>

/** 推送模板结构 */
export interface PushTemplate {
  name: string
  title_args: string[]
  content_args?: string[]
}

/**
 * 构造推送模板对象（对齐 Dart fixPushName 内部逻辑）。
 *
 * @param chatType 会话类型（`groupChat` 为群聊，其余按单聊处理）
 * @param pushName 推送标题里的发送者昵称
 * @param content  非文本消息的内容摘要；传 null 表示文本消息（name 追加 `_text`）
 */
export function buildPushTemplate(
  chatType: ConversationTypeValue,
  pushName: string,
  content: PushContentSummary = null,
): PushTemplate {
  const prefix = chatType === CONVERSATION_TYPE.GROUPCHAT ? PUSH_NAME_PREFIX.group : PUSH_NAME_PREFIX.single
  return {
    name: content === null ? `${prefix}_text` : prefix,
    title_args: [pushName],
    ...(content !== null ? { content_args: [content] } : {}),
  }
}

/**
 * 把推送模板封装进消息扩展字段（对齐 Dart fixPushName 的调用效果）。
 *
 * 采用「合并」而非「覆盖」：保留 UIKit 已写入的 isSticker / stickerCode /
 * em_at_list / msgQuote 等业务字段；同名 em_push_template 以本次生成为准。
 *
 * @param ext      原消息扩展字段，可为空
 * @param chatType 会话类型
 * @param pushName 推送标题里的发送者昵称
 * @param content  非文本消息的内容摘要；null 表示文本消息
 */
export function fixPushName(
  ext: MessageExt | undefined,
  chatType: ConversationTypeValue,
  pushName: string,
  content: PushContentSummary = null,
): MessageExt {
  return {
    ...(ext ?? {}),
    [PUSH_TEMPLATE_KEY]: buildPushTemplate(chatType, pushName, content),
  }
}
