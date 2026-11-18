import { useUIKit } from '@easemob-community/uikit-im'
import { watch } from 'vue'

import { fixPushName, PUSH_CONTENT_SUMMARY } from '@/config/push'
import type { ConversationTypeValue } from '@easemob-community/uikit-im'
import type { MessageExt, PushContentSummary } from '@/config/push'

import { useUserStore } from '@/store/modules/user'

/**
 * 发送消息时统一注入离线推送模板（em_push_template）到消息 ext。
 *
 * 背景：
 * - 项目自身没有 sendMessage，消息全部由 UIKit 的 useMessageSend 发出；
 * - UIKit 的 hooks.beforeSend 只能返回 boolean 决定是否阻断，无法改写 ext；
 * - 所有真实发送（文本 / 图片 / 文件 / 语音 / 视频 / 位置 / 自定义 / cmd /
 *   合并转发 / 复合消息，含转发与重发）最终都汇聚到
 *   `useUIKit().domains.message.sendXxx`（PC / H5 共用同一层）。
 *
 * 因此在登录后对 message domain 的 send 方法做一次幂等包装，在调用原方法前
 * 把推送模板「合并」进 ext（保留 UIKit 已写入的 isSticker / em_at_list / msgQuote）。
 */

/** 已包装过的 message domain 实例（幂等，避免重复包装 / 多组件重复安装） */
const patchedDomains = new WeakSet<object>()

interface SendRule {
  /** SdkMessageDomain 上的发送方法名 */
  method: string
  /** ext 参数在该方法签名中的位置（依据 uikit-sdk-contract domains.d.ts） */
  extIndex: number
  /** 该消息类型的推送内容摘要；null 表示文本消息 */
  content: PushContentSummary
}

/**
 * 各发送方法的 ext 参数下标与推送摘要。
 * 会话类型（conversationType）统一位于参数下标 1。
 */
const SEND_RULES: ReadonlyArray<SendRule> = [
  { method: 'sendText', extIndex: 3, content: PUSH_CONTENT_SUMMARY.text },
  { method: 'sendImage', extIndex: 3, content: PUSH_CONTENT_SUMMARY.image },
  { method: 'sendFile', extIndex: 3, content: PUSH_CONTENT_SUMMARY.file },
  { method: 'sendVoice', extIndex: 4, content: PUSH_CONTENT_SUMMARY.voice },
  { method: 'sendVideo', extIndex: 4, content: PUSH_CONTENT_SUMMARY.video },
  { method: 'sendLocation', extIndex: 5, content: PUSH_CONTENT_SUMMARY.location },
  { method: 'sendCustom', extIndex: 4, content: PUSH_CONTENT_SUMMARY.custom },
  { method: 'sendCmd', extIndex: 3, content: PUSH_CONTENT_SUMMARY.cmd },
  { method: 'sendCombine', extIndex: 6, content: PUSH_CONTENT_SUMMARY.combine },
  { method: 'sendMultiBody', extIndex: 3, content: PUSH_CONTENT_SUMMARY.multiBody },
]

type SendFn = (...args: unknown[]) => Promise<unknown>

/** 包装单个发送方法：在原方法调用前把推送模板合并进 ext */
function patchMethod(
  domain: Record<string, unknown>,
  rule: SendRule,
  resolvePushName: () => string,
): void {
  const original = domain[rule.method]
  if (typeof original !== 'function') return

  const send = original as SendFn
  domain[rule.method] = (...args: unknown[]): Promise<unknown> => {
    const nextArgs = [...args]
    const chatType = (nextArgs[1] ?? '') as ConversationTypeValue
    const rawExt = nextArgs[rule.extIndex]
    const ext = (rawExt && typeof rawExt === 'object' ? rawExt : {}) as MessageExt
    nextArgs[rule.extIndex] = fixPushName(ext, chatType, resolvePushName(), rule.content)
    return send.apply(domain, nextArgs)
  }
}

/**
 * 对 message domain 的发送方法做幂等包装（供 composable 与单测直接调用）。
 *
 * @param messageDomain   useUIKit().domains.message 实例
 * @param resolvePushName 发送时动态解析推送标题昵称（登录后才确定）
 */
export function patchMessageDomain(
  messageDomain: object,
  resolvePushName: () => string,
): void {
  if (patchedDomains.has(messageDomain)) return
  const target = messageDomain as Record<string, unknown>
  for (const rule of SEND_RULES) patchMethod(target, rule, resolvePushName)
  patchedDomains.add(messageDomain)
}

/** 在 Provider 作用域内调用：登录成功后安装发送包装（覆盖自动登录与手动登录） */
export function useMessagePushExt(): void {
  const { domains, stores } = useUIKit()
  const userStore = useUserStore()

  // 动态读取：登录时昵称可能尚未写入 userStore，发送时再取值可兜底
  const resolvePushName = (): string =>
    userStore.nickname || userStore.userId || stores.client.currentUser || ''

  function install(): void {
    let messageDomain: unknown
    try {
      // SDK 未初始化时 domains.message getter 会抛错，忽略即可，等待下次登录触发
      messageDomain = domains.message
    } catch {
      return
    }
    if (!messageDomain || typeof messageDomain !== 'object') return
    patchMessageDomain(messageDomain as object, resolvePushName)
  }

  watch(
    () => stores.client.currentUser,
    (currentUser) => {
      if (currentUser) install()
    },
    { immediate: true },
  )
}
