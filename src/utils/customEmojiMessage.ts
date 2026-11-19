/**
 * 自定义表情消息（emoji）解析工具。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：
 *     CUSTOM 消息按 event === 'emoji' 识别；createEmojiMsg 发送时 params 只有 id + url。
 * - lib/model/message.dart EmojiMsg.format()：
 *     id = int.tryParse(params["id"] ?? "") ?? 0
 *     url = params["url"]?.toString() ?? ''
 * - lib/page/chat/message/message_item.dart：
 *     裸图渲染（无气泡背景/内边距），maxWidth 120，圆角 8，fitWidth。
 *
 * 本模块只做纯解析，不做 URL 改写：图片 <img src> 由全局 avatarSrcRewrite 统一
 * 走 /oss-cdn 代理（含点击后的全屏预览），与 bidirectionalMessage.ts 保持同样职责边界。
 */
import type { UiMessage } from '@easemob-community/uikit-im'

import { getCustomEvent } from './customMessage'

/** 自定义表情的 event 标识（对齐 Flutter case "emoji" / MsgType.emoji.name） */
export const EMOJI_EVENT = 'emoji'

/** 是否为自定义表情消息：custom 类型且 event === 'emoji' */
export function isEmojiMessage(message: UiMessage): boolean {
  return getCustomEvent(message) === EMOJI_EVENT
}

export interface EmojiView {
  /** 表情 ID（对齐 Dart int.tryParse，解析失败为 0） */
  id: number
  /** 表情图片地址，缺失时为空串 */
  url: string
}

/** 对齐 Dart int.tryParse：仅纯整数字符串可解析，否则 0 */
function tryParseInt(value: string | undefined): number {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return 0
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? 0 : n
}

/**
 * 解析自定义表情内容。
 * UIKit 的 CustomMessageBody.params 为 Record<string, string>，与 Flutter 的
 * Map<String, dynamic> 按字符串读取一致（Flutter 端对 id 做 toString）。
 */
export function getEmojiView(message: UiMessage): EmojiView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
  return {
    id: tryParseInt(params.id),
    url: typeof params.url === 'string' ? params.url : '',
  }
}
