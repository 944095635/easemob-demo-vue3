/**
 * 自定义消息「是否支持在 Web 端渲染」的判定。
 *
 * 背景：UIKit 对 custom 类型只有内置 EmCustomMessage 一种渲染，直接把
 * `body.event + JSON.stringify(body.params)` 原文显示在气泡里，对终端用户没有意义。
 * 本项目 Web 端尚未为任何自定义 event 提供专用渲染组件，因此默认所有 custom 消息
 * 都提示「请使用手机 App 查看」，外观与系统消息（notice）一致。
 *
 * 后续若某个 event 在 Web 端有了专用气泡，把 event 名加入 SUPPORTED_CUSTOM_EVENTS
 * 即可让它回落到 UIKit 内置渲染（见 src/views/chat/index.vue 的 #message-custom 插槽）。
 */
import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

/**
 * 已在 Web 端支持渲染的自定义消息 event 白名单。
 * - bidirectional：双向消息，由独立的 BidirectionalMessage 组件渲染（见 chat/index.vue
 *   #message-custom 插槽）。内容走 self/other 逻辑，不能显示 event/params 原文。
 * - emoji：自定义表情消息，由 EmojiMessage 组件渲染（见 chat/index.vue #message-custom
 *   插槽）。params 里的 url 以裸图展示，不能显示 event/params 原文。
 * 其余 custom 消息走「请用手机 App 查看」提示。
 */
const SUPPORTED_CUSTOM_EVENTS = new Set<string>(['bidirectional', 'emoji'])

/** 取自定义消息的 event 标识；非 custom 或无 event 时返回空串 */
export function getCustomEvent(message: UiMessage): string {
  if (message.type !== MESSAGE_TYPE.CUSTOM) return ''
  const event = (message.body as { event?: unknown } | undefined)?.event
  return typeof event === 'string' ? event : ''
}

/**
 * 是否为「不支持的自定义消息」：类型为 custom 且 event 不在白名单内。
 * 这类消息不展示原始内容，改为系统消息样式的提示。
 */
export function isUnsupportedCustomMessage(message: UiMessage): boolean {
  if (message.type !== MESSAGE_TYPE.CUSTOM) return false
  return !SUPPORTED_CUSTOM_EVENTS.has(getCustomEvent(message))
}
