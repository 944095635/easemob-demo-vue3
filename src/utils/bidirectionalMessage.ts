/**
 * 双向消息（bidirectional）解析工具。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：CUSTOM 消息按 event==='bidirectional' 识别；
 * - lib/model/message.dart BidirectionalMsg：
 *     self / other / showPrefix 三个 params 字段，description 规则：
 *       我发的 → self
 *       别人发的且 showPrefix → "${sender} ${other}"
 *       别人发的且 !showPrefix → other
 */
import type { UiMessage } from '@easemob-community/uikit-im'

import { getCustomEvent } from './customMessage'

/** 双向消息的 event 标识（对齐 Flutter MessageHelper 的 case "bidirectional"） */
export const BIDIRECTIONAL_EVENT = 'bidirectional'

/** 是否为双向消息：custom 类型且 event === 'bidirectional' */
export function isBidirectionalMessage(message: UiMessage): boolean {
  return getCustomEvent(message) === BIDIRECTIONAL_EVENT
}

export interface BidirectionalView {
  /** 展示文案（对齐 Flutter BidirectionalMsg.description） */
  description: string
}

/**
 * 解析双向消息内容。
 * 字段局限：UIKit 的 CustomMessageBody.params 为 Record<string, string>，
 * 与 Flutter 的 Map<String, dynamic> 对齐；showPrefix 为字符串 "true" 时开启。
 */
export function getBidirectionalView(message: UiMessage): BidirectionalView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}

  const self = params.self ?? ''
  const other = params.other ?? ''
  const showPrefix = params.showPrefix === 'true'

  // 我发的显示自己看到的文案
  if (message.isSelf) return { description: self }

  // 别人发的：按需在前面加发送人昵称
  if (showPrefix) {
    const nickname = message.sender?.nickname ?? ''
    return { description: `${nickname} ${other}` }
  }
  return { description: other }
}
