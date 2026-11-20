import { describe, expect, it } from 'vitest'
import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import {
  NOTICE_EVENT,
  getSystemNoticeView,
  isSystemNoticeMessage,
} from '@/utils/systemNoticeMessage'

function noticeMsg(params: Record<string, string> = {}): UiMessage {
  return {
    type: MESSAGE_TYPE.CUSTOM,
    body: { event: NOTICE_EVENT, params },
  } as unknown as UiMessage
}

describe('isSystemNoticeMessage', () => {
  it('notice 识别为系统通知', () => {
    expect(isSystemNoticeMessage(noticeMsg())).toBe(true)
  })

  it('其它 event 或非 custom 类型不是系统通知', () => {
    expect(
      isSystemNoticeMessage({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: 'card' },
      } as unknown as UiMessage),
    ).toBe(false)
    expect(isSystemNoticeMessage({ type: MESSAGE_TYPE.TEXT } as unknown as UiMessage)).toBe(false)
  })
})

describe('getSystemNoticeView', () => {
  it('取 params.text 作为正文', () => {
    expect(getSystemNoticeView(noticeMsg({ text: '你已加入群聊' })).text).toBe('你已加入群聊')
  })

  it('operator / members 中的用户渲染为可点击片段，数字 uid 转 tielian- chatId', () => {
    const view = getSystemNoticeView(
      noticeMsg({
        text: '懂得都懂 将 旧信封 移出了群聊',
        operator: JSON.stringify({ user_id: 300009, nickname: '懂得都懂' }),
        members: JSON.stringify([{ user_id: 140045, nickname: '旧信封' }]),
      }),
    )

    expect(view.segments).toEqual([
      { text: '懂得都懂', chatUserId: 'tielian-300009' },
      { text: ' 将 ' },
      { text: '旧信封', chatUserId: 'tielian-140045' },
      { text: ' 移出了群聊' },
    ])
  })

  it('昵称长度不同时最长优先匹配，避免短名覆盖长名', () => {
    const view = getSystemNoticeView(
      noticeMsg({
        text: '张三丰 and 张三',
        members: JSON.stringify([
          { user_id: 1, nickname: '张三' },
          { user_id: 2, nickname: '张三丰' },
        ]),
      }),
    )
    expect(view.segments).toEqual([
      { text: '张三丰', chatUserId: 'tielian-2' },
      { text: ' and ' },
      { text: '张三', chatUserId: 'tielian-1' },
    ])
  })

  it('JSON 解析失败或缺失字段时安全降级为纯文本', () => {
    const view = getSystemNoticeView(
      noticeMsg({
        text: '用户 加入了群聊',
        operator: 'not-json',
        members: JSON.stringify([{ user_id: 'abc', nickname: '用户' }]),
      }),
    )
    expect(view.segments).toEqual([{ text: '用户 加入了群聊' }])
  })

  it('params 缺失时正文为空', () => {
    expect(getSystemNoticeView({ type: MESSAGE_TYPE.CUSTOM } as unknown as UiMessage)).toEqual({
      text: '',
      segments: [{ text: '' }],
    })
  })
})
