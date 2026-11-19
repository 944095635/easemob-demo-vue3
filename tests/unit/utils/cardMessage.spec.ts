import { describe, expect, it } from 'vitest'

import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import {
  CARD_EVENT,
  USER_CARD_EVENT,
  getCardView,
  isCardMessage,
} from '@/utils/cardMessage'

function cardMsg(params: Record<string, string> = {}, event: string = CARD_EVENT): UiMessage {
  return { type: MESSAGE_TYPE.CUSTOM, body: { event, params } } as unknown as UiMessage
}

describe('isCardMessage', () => {
  it('card 与 userCard 都识别为名片', () => {
    expect(isCardMessage(cardMsg({}, CARD_EVENT))).toBe(true)
    expect(isCardMessage(cardMsg({}, USER_CARD_EVENT))).toBe(true)
  })

  it('其它 event 或非 custom 类型不是名片', () => {
    expect(isCardMessage(cardMsg({}, 'emoji'))).toBe(false)
    expect(isCardMessage({ type: MESSAGE_TYPE.TEXT } as unknown as UiMessage)).toBe(false)
  })
})

describe('getCardView', () => {
  it('解析 uid/name/avatar，并生成 tielian- 前缀的 chatUserId', () => {
    expect(
      getCardView(cardMsg({ uid: '3000008', name: '张三', avatar: 'https://cdn/a.png' })),
    ).toEqual({
      userId: 3000008,
      chatUserId: 'tielian-3000008',
      name: '张三',
      avatar: 'https://cdn/a.png',
      expired: false,
    })
  })

  it('对齐 Dart int.tryParse：非纯整数 uid 解析为 0，视为过期', () => {
    for (const uid of ['abc', '', '3.5', ' 12 3 ', undefined]) {
      const params: Record<string, string> = { name: 'X' }
      if (uid !== undefined) params.uid = uid
      const view = getCardView(cardMsg(params))
      expect(view.userId).toBe(0)
      expect(view.chatUserId).toBe('')
      expect(view.expired).toBe(true)
    }
  })

  it('uid=0 或负数视为过期', () => {
    expect(getCardView(cardMsg({ uid: '0' })).expired).toBe(true)
    expect(getCardView(cardMsg({ uid: '-1' })).expired).toBe(true)
  })

  it('name / avatar 缺失时为空串，不抛错', () => {
    expect(getCardView(cardMsg({ uid: '1' }))).toEqual({
      userId: 1,
      chatUserId: 'tielian-1',
      name: '',
      avatar: '',
      expired: false,
    })
  })

  it('params 缺失时不抛错', () => {
    expect(getCardView({ type: MESSAGE_TYPE.CUSTOM, body: { event: CARD_EVENT } } as unknown as UiMessage)).toEqual({
      userId: 0,
      chatUserId: '',
      name: '',
      avatar: '',
      expired: true,
    })
  })

  it('非字符串 name / avatar 降级为空串', () => {
    expect(
      getCardView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: CARD_EVENT, params: { uid: '2', name: 123, avatar: null } },
      } as unknown as UiMessage),
    ).toMatchObject({ name: '', avatar: '' })
  })
})
