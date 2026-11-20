/**
 * 会话列表「最后一条消息摘要」统一解析器。
 *
 * UIKit 默认的 `lastMessageTextResolver` 对 custom 消息统一回落到 `[自定义]`，
 * 信息量为零。本项目按 iron_chat `MessageHelper.getContent` 的规则，把各自定义
 * event 映射为可读描述；图片 / 动画表情仍复用 sticker 解析器。
 *
 * 注入点：
 * - src/utils/uikit.ts → adapterConfig.lastMessageTextResolver（会话快照恢复路径）
 * - src/config/demo.ts → DEMO_CHAT_CONFIG.lastMessageTextResolver（聊天页路径）
 */
import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import i18n from '@/locales'
import { getBidirectionalView } from '@/utils/bidirectionalMessage'
import { getCustomEvent } from '@/utils/customMessage'

import { resolveStickerLastMessageText } from './sticker'

/** custom event → chat.messagePreview 下的 i18n key（对齐 Flutter MsgType → [描述]） */
const CUSTOM_EVENT_PREVIEW_KEY: Record<string, string> = {
  card: 'card',
  userCard: 'card',
  emoji: 'emoji',
  note: 'note',
  groupInviteV1: 'groupInvite',
}

/** 双向消息 event（与 bidirectionalMessage.ts 的常量保持一致，避免反向依赖 config） */
const BIDIRECTIONAL_EVENT = 'bidirectional'
/** 系统通知 event：正文走 params.text */
const NOTICE_EVENT = 'notice'

function customParams(message: UiMessage): Record<string, string> {
  return (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
}

/**
 * 自定义消息的摘要文本。
 * 返回 undefined 表示交回 UIKit 默认逻辑（未知 event 仍显示 `[自定义]`）。
 */
export function resolveCustomMessagePreview(message: UiMessage): string | undefined {
  if (message.type !== MESSAGE_TYPE.CUSTOM) return undefined

  const event = getCustomEvent(message)
  if (!event) return undefined

  // 双向消息：对齐 Flutter getContent → BidirectionalMsg.description（动态 self/other）。
  if (event === BIDIRECTIONAL_EVENT) {
    const description = getBidirectionalView(message).description.trim()
    return description || undefined
  }

  // 系统通知：对齐 Flutter SystemMsg.format → params["text"] 真实文本。
  if (event === NOTICE_EVENT) {
    const text = customParams(message).text
    if (text && text.trim()) return text
    return `[${i18n.global.t('chat.messagePreview.notice')}]`
  }

  const key = CUSTOM_EVENT_PREVIEW_KEY[event]
  if (!key) return undefined
  return `[${i18n.global.t(`chat.messagePreview.${key}`)}]`
}

/**
 * 统一消息摘要解析器。
 * 图片 / 动画表情优先走 sticker 解析器；其余交回 UIKit 默认逻辑。
 */
export function resolveDemoLastMessageText(message: UiMessage): string | undefined {
  const stickerText = resolveStickerLastMessageText(message)
  if (stickerText !== undefined) return stickerText
  return resolveCustomMessagePreview(message)
}
