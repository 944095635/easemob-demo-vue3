import { describe, expect, it } from 'vitest'

import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import {
  EMOJI_EVENT,
  getEmojiView,
  isEmojiMessage,
} from '@/utils/customEmojiMessage'

/** 构造一条 custom 表情消息；params / event 可覆盖 */
function emojiMsg(
  params: Record<string, string> = {},
  event: string = EMOJI_EVENT,
): UiMessage {
  return {
    type: MESSAGE_TYPE.CUSTOM,
    body: { event, params },
  } as unknown as UiMessage
}

describe('isEmojiMessage', () => {
  it('custom 且 event 为 emoji 时命中', () => {
    expect(isEmojiMessage(emojiMsg({ id: '1', url: 'https://x/a.gif' }))).toBe(true)
  })

  it('其它 event 或非 custom 类型不命中', () => {
    expect(isEmojiMessage(emojiMsg({}, 'gift'))).toBe(false)
    expect(isEmojiMessage(emojiMsg({}, 'bidirectional'))).toBe(false)
    expect(
      isEmojiMessage({
        type: MESSAGE_TYPE.TEXT,
        body: { event: EMOJI_EVENT },
      } as unknown as UiMessage),
    ).toBe(false)
  })
})

describe('getEmojiView', () => {
  it('解析 id 与 url（对齐 Flutter EmojiMsg.format）', () => {
    expect(getEmojiView(emojiMsg({ id: '42', url: 'https://cdn/a.gif' }))).toEqual({
      id: 42,
      url: 'https://cdn/a.gif',
    })
  })

  it('id 非纯整数时降级为 0（对齐 Dart int.tryParse）', () => {
    expect(getEmojiView(emojiMsg({ id: 'abc', url: 'u' })).id).toBe(0)
    expect(getEmojiView(emojiMsg({ id: '12x', url: 'u' })).id).toBe(0)
    expect(getEmojiView(emojiMsg({ id: '-3', url: 'u' })).id).toBe(-3)
    expect(getEmojiView(emojiMsg({ id: ' 7 ', url: 'u' })).id).toBe(7)
  })

  it('url 缺失或非字符串时返回空串', () => {
    expect(getEmojiView(emojiMsg({ id: '1' })).url).toBe('')
    expect(
      getEmojiView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: EMOJI_EVENT, params: { url: 123 } },
      } as unknown as UiMessage).url,
    ).toBe('')
  })

  it('params 缺失时不抛错', () => {
    expect(
      getEmojiView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: EMOJI_EVENT },
      } as unknown as UiMessage),
    ).toEqual({ id: 0, url: '' })
  })
})
