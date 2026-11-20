import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import request from '@/api/request'
import { deleteFriend, getUserDetail, searchUsers, sendFriendApply } from '@/api/friend'

const base = import.meta.env.VITE_API_BASE_URL || ''
const prefix = /(?:^|\/)api\/?$/.test(base) ? '' : '/api'

describe('friend api', () => {
  let mock: MockAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    mock = new MockAdapter(request)
  })

  afterEach(() => {
    mock.restore()
  })

  it('searchUsers 调 POST /user/search 并把分页 list 映射为搜索结果', async () => {
    let body: Record<string, unknown> | undefined
    mock.onPost(`${prefix}/user/search`).reply((config) => {
      body = JSON.parse(config.data as string) as Record<string, unknown>
      expect(config.headers?.['X-Sign']).toBeTruthy()
      return [
        200,
        {
          code: 0,
          msg: 'ok',
          data: {
            list: [
              {
                id: 300009,
                chat_id: 'tielian-300009',
                nickname: '懂得都懂',
                avatar: 'https://cdn.example.com/a.png',
                gender: 1,
                signature: 'hi',
                is_friend: 0,
                can_add: 1,
                source: 'search_chat_id',
              },
            ],
          },
        },
      ]
    })

    const users = await searchUsers('  tielian-300009  ')
    expect(body).toEqual({ keyword: 'tielian-300009' })
    expect(users).toEqual([
      {
        userId: 300009,
        tlId: 'tielian-300009',
        nickname: '懂得都懂',
        avatar: 'https://cdn.example.com/a.png',
        gender: 1,
        signature: 'hi',
        isFriend: false,
        canAdd: true,
        source: 'search_chat_id',
      },
    ])
  })

  it('getUserDetail 透传 groupId 并映射资料字段', async () => {
    mock.onGet(`${prefix}/user/300009`).reply((config) => {
      expect(config.params).toEqual({ easemob_group_id: '12345' })
      expect(config.headers?.['X-Sign']).toBeTruthy()
      return [
        200,
        {
          code: 0,
          message: 'ok',
          data: {
            id: 300009,
            chat_id: 'tielian-300009',
            nickname: '懂得都懂',
            avatar: 'https://cdn.example.com/a.png',
            gender: 1,
            signature: 'hi',
            profile_cover: 'https://cdn.example.com/cover.png',
            is_friend: false,
            is_blocked: false,
            is_vip: true,
            common_friend_count: 2,
            common_group_count: '1',
            group_join: {
              joined_at: 1784035945,
              source: 'qrcode',
              inviter_id: 300008,
              inviter_nickname: '管理员',
            },
          },
        },
      ]
    })

    const detail = await getUserDetail(300009, '12345')
    expect(detail).toMatchObject({
      userId: 300009,
      tlId: 'tielian-300009',
      vip: true,
      isFriend: false,
      isBlocked: false,
      commonFriendCount: 2,
      commonGroupCount: 1,
      groupJoin: { source: 'qrcode', inviterId: 300008 },
    })
  })

  it('sendFriendApply 用默认申请理由并透传 source，空 remark 不发送', async () => {
    let body: Record<string, unknown> | undefined
    mock.onPost(`${prefix}/friend/apply`).reply((config) => {
      body = JSON.parse(config.data as string) as Record<string, unknown>
      expect(config.headers?.['X-Sign']).toBeTruthy()
      return [200, { code: 0, message: 'ok', data: null }]
    })

    await sendFriendApply({ toUserId: 300009, source: 'search_chat_id' })
    expect(body).toEqual({
      to_user_id: 300009,
      message: '我想添加你为好友',
      source: 'search_chat_id',
    })
  })

  it('sendFriendApply 使用自定义理由和备注', async () => {
    let body: Record<string, unknown> | undefined
    mock.onPost(`${prefix}/friend/apply`).reply((config) => {
      body = JSON.parse(config.data as string) as Record<string, unknown>
      return [200, { code: 0, message: 'ok', data: null }]
    })

    await sendFriendApply({
      toUserId: 300009,
      message: '您好，想加您好友',
      remark: '老王',
      source: 'search_mobile',
    })
    expect(body).toEqual({
      to_user_id: 300009,
      message: '您好，想加您好友',
      remark: '老王',
      source: 'search_mobile',
    })
  })

  it('deleteFriend 调 DELETE /friend/{userId} 并携带签名', async () => {
    mock.onDelete(`${prefix}/friend/300009`).reply((config) => {
      expect(config.headers?.['X-Sign']).toBeTruthy()
      expect(config.data).toBeUndefined()
      return [200, { code: 0, message: 'ok', data: null }]
    })

    await expect(deleteFriend(300009)).resolves.toBeUndefined()
  })

  it('deleteFriend 对非好友错误码抛出服务端 msg', async () => {
    mock.onDelete(`${prefix}/friend/300009`).reply(200, {
      code: 130007,
      msg: '非好友关系',
      data: null,
    })
    await expect(deleteFriend(300009)).rejects.toThrow('非好友关系')
  })

  it('业务错误用 msg 字段时也能正确 reject（对齐 Flutter ApiResponse）', async () => {
    mock.onGet(`${prefix}/error-msg`).reply(200, { code: 130002, msg: '已是好友', data: null })
    await expect(request.get(`${prefix}/error-msg`)).rejects.toThrow('已是好友')
  })
})
