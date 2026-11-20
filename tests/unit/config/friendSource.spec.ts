import { describe, expect, it } from 'vitest'

import { FRIEND_SOURCE_VALUES, resolveFriendSource } from '@/config/friendSource'

describe('friend source', () => {
  it('按 Flutter UserSourceType.value 查找，source 与展示文案 key 对齐', () => {
    expect(resolveFriendSource('search_chat_id')).toEqual({
      value: 'search_chat_id',
      labelKey: 'contacts.source.searchChatId',
      source: 'search_chat_id',
    })
    expect(resolveFriendSource('qrcode').source).toBe('qrcode')
    expect(resolveFriendSource('group').source).toBe('group')
  })

  it('contact/chat/card/circle 等来源提交 card（对齐 Flutter）', () => {
    for (const value of ['contact', 'chat', 'card', 'circle', 'friend_request', 'group_request']) {
      expect(resolveFriendSource(value).source).toBe('card')
    }
  })

  it('未知或空值回退 unknown，且包含全部 Flutter 枚举值', () => {
    expect(resolveFriendSource().source).toBe('')
    expect(resolveFriendSource('not-exist').value).toBe('unknown')
    expect(FRIEND_SOURCE_VALUES).toContain('search_mobile')
    expect(FRIEND_SOURCE_VALUES).toHaveLength(11)
  })
})
