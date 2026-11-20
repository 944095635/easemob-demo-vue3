import { beforeEach, describe, expect, it } from 'vitest'
import { MESSAGE_STATUS, MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'
import { extractSnippetText } from '@easemob-community/uikit-sdk-websdk5'

import {
  resolveCustomMessagePreview,
  resolveDemoLastMessageText,
} from '@/config/messagePreview'
import i18n from '@/locales'

function makeCustomMessage(
  event: string,
  params: Record<string, string> = {},
  overrides: Partial<UiMessage> = {},
): UiMessage {
  return {
    msgServerId: 'srv-1',
    msgLocalId: 'local-1',
    from: 'alice',
    to: 'me',
    sender: { userId: 'alice', nickname: 'Alice' },
    conversationId: 'alice',
    conversationType: 'singleChat',
    type: MESSAGE_TYPE.CUSTOM,
    sendStatus: MESSAGE_STATUS.SENT,
    status: MESSAGE_STATUS.SENT,
    isSelf: false,
    ext: {},
    timestamp: 1700000000000,
    body: { event, params },
    ...overrides,
  } as UiMessage
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
})

describe('自定义消息摘要按 event 映射', () => {
  it.each([
    ['card', '[名片]', '[Business Card]'],
    ['userCard', '[名片]', '[Business Card]'],
    ['emoji', '[表情]', '[Sticker]'],
    ['note', '[笔记]', '[Note]'],
    ['groupInviteV1', '[群邀请]', '[Group Invitation]'],
  ])('%s 按当前语言返回对应描述', (event, zhText, enText) => {
    const message = makeCustomMessage(event)

    expect(resolveCustomMessagePreview(message)).toBe(zhText)
    i18n.global.locale.value = 'en-US'
    expect(resolveCustomMessagePreview(message)).toBe(enText)
  })

  it('notice 优先显示 params.text 真实文本', () => {
    const message = makeCustomMessage('notice', { text: '管理员开启了群禁言' })

    expect(resolveCustomMessagePreview(message)).toBe('管理员开启了群禁言')
  })

  it('notice 无 text 时回落到 [通知]', () => {
    const message = makeCustomMessage('notice')

    expect(resolveCustomMessagePreview(message)).toBe('[通知]')
    i18n.global.locale.value = 'en-US'
    expect(resolveCustomMessagePreview(makeCustomMessage('notice'))).toBe('[Notice]')
  })

  it('bidirectional 自己发的返回 self', () => {
    const message = makeCustomMessage(
      'bidirectional',
      { self: '你同意了好友申请', other: '对方同意了好友申请', showPrefix: 'true' },
      { isSelf: true },
    )

    expect(resolveCustomMessagePreview(message)).toBe('你同意了好友申请')
  })

  it('bidirectional 别人发的按 showPrefix 拼接发送者', () => {
    const withPrefix = makeCustomMessage('bidirectional', {
      self: '你同意了好友申请',
      other: '同意了你的好友申请',
      showPrefix: 'true',
    })
    const withoutPrefix = makeCustomMessage('bidirectional', {
      other: '同意了你的好友申请',
      showPrefix: 'false',
    })

    expect(resolveCustomMessagePreview(withPrefix)).toBe('Alice 同意了你的好友申请')
    expect(resolveCustomMessagePreview(withoutPrefix)).toBe('同意了你的好友申请')
  })

  it('bidirectional 描述为空时交回默认摘要', () => {
    expect(resolveCustomMessagePreview(makeCustomMessage('bidirectional'))).toBeUndefined()
  })

  it('未知 event 交回默认摘要（显示 [自定义]）', () => {
    expect(resolveCustomMessagePreview(makeCustomMessage('someNewEvent'))).toBeUndefined()
  })

  it('非 custom 消息交回默认摘要', () => {
    const message = { ...makeCustomMessage('emoji'), type: MESSAGE_TYPE.TEXT } as UiMessage

    expect(resolveCustomMessagePreview(message)).toBeUndefined()
  })
})

describe('统一摘要解析器组合逻辑', () => {
  it('图片消息仍走 sticker/图片摘要', () => {
    const image = {
      ...makeCustomMessage('emoji'),
      type: MESSAGE_TYPE.IMAGE,
      ext: {},
      body: { localUrl: '' },
    } as UiMessage

    expect(resolveDemoLastMessageText(image)).toBe('[图片]')
  })

  it('自定义消息走 custom 摘要', () => {
    expect(resolveDemoLastMessageText(makeCustomMessage('card'))).toBe('[名片]')
  })

  it('文本消息交回默认摘要', () => {
    const text = {
      ...makeCustomMessage('emoji'),
      type: MESSAGE_TYPE.TEXT,
      body: { content: 'hello' },
    } as UiMessage

    expect(resolveDemoLastMessageText(text)).toBeUndefined()
  })
})

type ConversationSnippet = NonNullable<Parameters<typeof extractSnippetText>[0]>

function makeCustomSnippet(event: string, params: Record<string, string> = {}): ConversationSnippet {
  return {
    msgServerId: 'srv-1',
    msgLocalId: 'local-1',
    from: 'alice',
    to: 'group-1',
    sender: { userId: 'alice', nickname: 'Alice' },
    conversationId: 'group-1',
    conversationType: 'groupChat',
    type: MESSAGE_TYPE.CUSTOM,
    sendStatus: MESSAGE_STATUS.SENT,
    ext: {},
    timestamp: 1700000000000,
    body: { event, params },
  }
}

describe('实际 WebSDK5 会话快照集成', () => {
  it.each([
    ['card', '[名片]'],
    ['emoji', '[表情]'],
    ['note', '[笔记]'],
  ])('%s 快照恢复后不再显示 [自定义]，而是 %s', (event, expected) => {
    expect(extractSnippetText(makeCustomSnippet(event), undefined, resolveDemoLastMessageText)).toBe(
      expected,
    )
  })
})
