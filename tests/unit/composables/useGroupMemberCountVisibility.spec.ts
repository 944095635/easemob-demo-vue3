import { describe, expect, it } from 'vitest'

import { computeShowGroupMemberList, computeShowMemberCount } from '@/composables/useGroupMemberCountVisibility'

describe('群人数后缀可见性（对齐 App ChatAppbarWidget）', () => {
  it('未隐藏群成员时，任何身份都显示人数', () => {
    expect(computeShowMemberCount({ hide_member_list: false }, false, 'member')).toBe(true)
    expect(computeShowMemberCount({ hide_member_list: false }, false)).toBe(true)
  })

  it('隐藏群成员且普通成员非 VIP 时不显示人数', () => {
    expect(computeShowMemberCount({ hide_member_list: true, my_role: 'member' }, false)).toBe(false)
  })

  it('隐藏群成员但当前账号 VIP 时显示人数', () => {
    expect(computeShowMemberCount({ hide_member_list: true, my_role: 'member' }, true)).toBe(true)
  })

  it('隐藏群成员但群主 / 管理员时显示人数', () => {
    expect(computeShowMemberCount({ hide_member_list: true, my_role: 'owner' }, false)).toBe(true)
    expect(computeShowMemberCount({ hide_member_list: true, my_role: 'admin' }, false)).toBe(true)
  })

  it('自有接口未返回 my_role 时用 UIKit store 角色兜底', () => {
    expect(computeShowMemberCount({ hide_member_list: true }, false, 'admin')).toBe(true)
    expect(computeShowMemberCount({ hide_member_list: true }, false, 'owner')).toBe(true)
    expect(computeShowMemberCount({ hide_member_list: true }, false, 'member')).toBe(false)
  })

  it('查不到群资料时按「隐藏」处理：仅 VIP 或管理员可见', () => {
    expect(computeShowMemberCount(undefined, false, 'member')).toBe(false)
    expect(computeShowMemberCount(undefined, true, 'member')).toBe(true)
    expect(computeShowMemberCount(undefined, false, 'admin')).toBe(true)
    expect(computeShowMemberCount(undefined, false)).toBe(false)
  })

  it('my_role 为数字身份码时安全处理（不误判为管理员）', () => {
    expect(computeShowMemberCount({ hide_member_list: true, my_role: 1 }, false)).toBe(false)
  })
})

describe('群详情成员列表可见性（对齐 App chat_setup_group_page.dart，VIP 不含在内）', () => {
  it('未隐藏群成员时，任何身份都显示列表', () => {
    expect(computeShowGroupMemberList({ hide_member_list: false }, 'member')).toBe(true)
    expect(computeShowGroupMemberList({ hide_member_list: false })).toBe(true)
  })

  it('隐藏群成员时普通成员不显示列表', () => {
    expect(computeShowGroupMemberList({ hide_member_list: true, my_role: 'member' })).toBe(false)
  })

  it('隐藏群成员时 VIP 仍不显示列表（与人数不同）', () => {
    const detail = { hide_member_list: true, my_role: 'member' }
    expect(computeShowMemberCount(detail, true)).toBe(true)
    expect(computeShowGroupMemberList(detail)).toBe(false)
  })

  it('隐藏群成员时群主 / 管理员显示列表', () => {
    expect(computeShowGroupMemberList({ hide_member_list: true, my_role: 'owner' })).toBe(true)
    expect(computeShowGroupMemberList({ hide_member_list: true, my_role: 'admin' })).toBe(true)
  })

  it('自有接口未返回 my_role 时用 UIKit store 角色兜底', () => {
    expect(computeShowGroupMemberList({ hide_member_list: true }, 'admin')).toBe(true)
    expect(computeShowGroupMemberList({ hide_member_list: true }, 'owner')).toBe(true)
    expect(computeShowGroupMemberList({ hide_member_list: true }, 'member')).toBe(false)
  })

  it('查不到群资料时按「隐藏」处理：仅群主 / 管理员可见列表', () => {
    expect(computeShowGroupMemberList(undefined, 'admin')).toBe(true)
    expect(computeShowGroupMemberList(undefined, 'member')).toBe(false)
    expect(computeShowGroupMemberList(undefined)).toBe(false)
  })
})
