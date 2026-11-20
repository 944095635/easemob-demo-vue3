import { describe, expect, it } from 'vitest'
import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import {
  GROUP_INVITE_EVENT,
  getGroupInviteView,
  isGroupInviteMessage,
} from '@/utils/groupInviteMessage'

function inviteMsg(
  params: Record<string, string> = {},
  event: string = GROUP_INVITE_EVENT,
): UiMessage {
  return { type: MESSAGE_TYPE.CUSTOM, body: { event, params } } as unknown as UiMessage
}

describe('isGroupInviteMessage', () => {
  it('groupInviteV1 识别为群邀请', () => {
    expect(isGroupInviteMessage(inviteMsg())).toBe(true)
  })

  it('其它 event 或非 custom 类型不是群邀请', () => {
    expect(isGroupInviteMessage(inviteMsg({}, 'emoji'))).toBe(false)
    expect(isGroupInviteMessage({ type: MESSAGE_TYPE.TEXT } as unknown as UiMessage)).toBe(false)
  })
})

describe('getGroupInviteView', () => {
  it('解析群名/头像/人数/邀请业务ID/邀请人，inviteId 有效不过期', () => {
    expect(
      getGroupInviteView(
        inviteMsg({
          groupName: 'AX3000的群聊',
          groupAvatar: 'https://cdn.example.com/group.png',
          memberCount: '9',
          inviteId: '16',
          inviterNickname: '懂得都懂',
        }),
      ),
    ).toEqual({
      groupName: 'AX3000的群聊',
      groupAvatar: 'https://cdn.example.com/group.png',
      memberCount: '9',
      inviteId: 16,
      inviterNickname: '懂得都懂',
      expired: false,
    })
  })

  it('对齐 Dart int.tryParse：非纯整数 inviteId 解析为 0，视为过期', () => {
    const view = getGroupInviteView(inviteMsg({ inviteId: 'abc' }))
    expect(view.inviteId).toBe(0)
    expect(view.expired).toBe(true)
  })

  it('params 缺失或非字符串字段时安全降级不抛错', () => {
    const view = getGroupInviteView({ type: MESSAGE_TYPE.CUSTOM } as unknown as UiMessage)
    expect(view).toEqual({
      groupName: '',
      groupAvatar: '',
      memberCount: '',
      inviteId: 0,
      inviterNickname: '',
      expired: true,
    })
  })
})
