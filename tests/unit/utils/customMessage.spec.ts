import { describe, expect, it } from 'vitest'

import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getCustomEvent, isUnsupportedCustomMessage } from '@/utils/customMessage'
import { BIDIRECTIONAL_EVENT } from '@/utils/bidirectionalMessage'

function msg(type: string, body: Record<string, unknown> = {}): UiMessage {
  return { type, body } as unknown as UiMessage
}

describe('getCustomEvent', () => {
  it('取 custom 消息的 event 字符串', () => {
    expect(getCustomEvent(msg(MESSAGE_TYPE.CUSTOM, { event: 'gift', params: { id: 1 } }))).toBe('gift')
  })

  it('非 custom 类型或无 event / event 非字符串时返回空串', () => {
    expect(getCustomEvent(msg(MESSAGE_TYPE.TEXT, { event: 'gift' }))).toBe('')
    expect(getCustomEvent(msg(MESSAGE_TYPE.CUSTOM, { params: {} }))).toBe('')
    expect(getCustomEvent(msg(MESSAGE_TYPE.CUSTOM, { event: 123 }))).toBe('')
    expect(getCustomEvent(msg(MESSAGE_TYPE.CUSTOM))).toBe('')
  })
})

describe('isUnsupportedCustomMessage', () => {
  it('默认 custom 消息视为不支持', () => {
    expect(isUnsupportedCustomMessage(msg(MESSAGE_TYPE.CUSTOM, { event: 'any_event' }))).toBe(true)
    expect(isUnsupportedCustomMessage(msg(MESSAGE_TYPE.CUSTOM, { event: '' }))).toBe(true)
    expect(isUnsupportedCustomMessage(msg(MESSAGE_TYPE.CUSTOM))).toBe(true)
  })

  it('bidirectional 已支持专用渲染，不算不支持', () => {
    expect(
      isUnsupportedCustomMessage(msg(MESSAGE_TYPE.CUSTOM, { event: BIDIRECTIONAL_EVENT })),
    ).toBe(false)
  })

  it('非 custom 类型一律不是「不支持的自定义消息」', () => {
    for (const type of [MESSAGE_TYPE.TEXT, MESSAGE_TYPE.IMAGE, MESSAGE_TYPE.CMD, MESSAGE_TYPE.NOTICE]) {
      expect(isUnsupportedCustomMessage(msg(type, { event: 'gift' }))).toBe(false)
    }
  })
})
