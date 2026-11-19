import { describe, expect, it } from 'vitest'

import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import {
  BIDIRECTIONAL_EVENT,
  getBidirectionalView,
  isBidirectionalMessage,
} from '@/utils/bidirectionalMessage'

/** 构造一条 custom 双向消息；isSelf/sender/params 可覆盖 */
function bidirMsg(
  params: Record<string, string> = {},
  overrides: Partial<{ isSelf: boolean; sender: { nickname?: string } }> = {},
): UiMessage {
  return {
    type: MESSAGE_TYPE.CUSTOM,
    body: { event: BIDIRECTIONAL_EVENT, params },
    isSelf: false,
    sender: { nickname: '' },
    ...overrides,
  } as unknown as UiMessage
}

function customMsg(event: string): UiMessage {
  return { type: MESSAGE_TYPE.CUSTOM, body: { event } } as unknown as UiMessage
}

describe('isBidirectionalMessage', () => {
  it('custom 且 event 为 bidirectional 时命中', () => {
    expect(isBidirectionalMessage(customMsg(BIDIRECTIONAL_EVENT))).toBe(true)
  })

  it('其它 event 或非 custom 类型不命中', () => {
    expect(isBidirectionalMessage(customMsg('gift'))).toBe(false)
    expect(isBidirectionalMessage(customMsg(''))).toBe(false)
    expect(
      isBidirectionalMessage({
        type: MESSAGE_TYPE.TEXT,
        body: { event: BIDIRECTIONAL_EVENT },
      } as unknown as UiMessage),
    ).toBe(false)
  })
})

describe('getBidirectionalView', () => {
  it('我发的显示 self（对齐 Flutter sendByMe → self）', () => {
    expect(
      getBidirectionalView(
        bidirMsg({ self: '我这边看到的', other: '对方看到的' }, { isSelf: true }),
      ).description,
    ).toBe('我这边看到的')
  })

  it('别人发的显示 other', () => {
    expect(
      getBidirectionalView(
        bidirMsg({ self: '我这边看到的', other: '对方看到的' }, { isSelf: false }),
      ).description,
    ).toBe('对方看到的')
  })

  it('别人发的且 showPrefix 为 "true" 时加昵称前缀', () => {
    expect(
      getBidirectionalView(
        bidirMsg(
          { other: '发来的内容', showPrefix: 'true' },
          { isSelf: false, sender: { nickname: '张三' } },
        ),
      ).description,
    ).toBe('张三 发来的内容')
  })

  it('showPrefix 非 "true" 或昵称缺失时不加多余内容', () => {
    expect(
      getBidirectionalView(
        bidirMsg(
          { other: '内容', showPrefix: 'false' },
          { isSelf: false, sender: { nickname: '张三' } },
        ),
      ).description,
    ).toBe('内容')
    expect(
      getBidirectionalView(
        bidirMsg({ other: '内容', showPrefix: 'true' }, { isSelf: false, sender: {} }),
      ).description,
    ).toBe(' 内容')
  })

  it('缺字段时返回空串而不是抛错', () => {
    expect(getBidirectionalView(bidirMsg()).description).toBe('')
    expect(
      getBidirectionalView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: BIDIRECTIONAL_EVENT },
      } as unknown as UiMessage).description,
    ).toBe('')
  })
})
