import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFriendRequests: vi.fn(),
  handleFriendRequest: vi.fn(),
  deleteFriendRequest: vi.fn(),
  clearFriendRequests: vi.fn(),
  addContact: vi.fn(),
  getContact: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/friend', () => ({
  getFriendRequests: mocks.getFriendRequests,
  handleFriendRequest: mocks.handleFriendRequest,
  deleteFriendRequest: mocks.deleteFriendRequest,
  clearFriendRequests: mocks.clearFriendRequests,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@easemob-community/uikit-im', () => ({
  useUIKit: () => ({
    stores: { contact: { addContact: mocks.addContact, getContact: mocks.getContact } },
  }),
  useToast: () => ({ success: mocks.showSuccess, error: mocks.showError }),
}))

import { useFriendRequests } from '@/composables/useFriendRequests'

const sample = (id: number, status = 'pending') => ({
  id,
  userId: 300000 + id,
  nickname: `用户${id}`,
  avatar: '',
  message: '想加你好友',
  remark: '',
  status,
  createdAt: 1784035945,
  source: 'search_chat_id',
})

describe('useFriendRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getContact.mockReturnValue(undefined)
    mocks.getFriendRequests.mockResolvedValue({ list: [sample(1)], total: 1, page: 1, pageSize: 20 })
    mocks.handleFriendRequest.mockResolvedValue(undefined)
    mocks.deleteFriendRequest.mockResolvedValue(undefined)
    mocks.clearFriendRequests.mockResolvedValue(undefined)
  })

  it('load 拉取自有服务列表并填充状态', async () => {
    const state = useFriendRequests()
    await state.load()
    expect(mocks.getFriendRequests).toHaveBeenCalledWith(1, 20)
    expect(state.list.value).toHaveLength(1)
    expect(state.total.value).toBe(1)
    expect(state.loading.value).toBe(false)
    expect(state.isEmpty.value).toBe(false)
  })

  it('load 失败进入错误态，不清空为空态', async () => {
    mocks.getFriendRequests.mockRejectedValue(new Error('获取好友申请失败'))
    const state = useFriendRequests()
    await state.load()
    expect(state.error.value).toBe(true)
    expect(state.isEmpty.value).toBe(false)
  })

  it('同意成功后改状态并写入本地联系人，无成功 toast', async () => {
    const state = useFriendRequests()
    await state.load()
    const item = state.list.value[0]
    await expect(state.handle(item, 'accept')).resolves.toBe(true)

    expect(mocks.handleFriendRequest).toHaveBeenCalledWith(1, 'accept')
    expect(item.status).toBe('accepted')
    expect(mocks.addContact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tielian-300001', name: '用户1' }),
    )
    expect(mocks.showSuccess).not.toHaveBeenCalled()
  })

  it('忽略成功后只改状态，不写本地联系人', async () => {
    const state = useFriendRequests()
    await state.load()
    const item = state.list.value[0]
    await expect(state.handle(item, 'reject')).resolves.toBe(true)
    expect(item.status).toBe('rejected')
    expect(mocks.addContact).not.toHaveBeenCalled()
  })

  it('处理失败 toast 服务端 msg 且不改状态', async () => {
    mocks.handleFriendRequest.mockRejectedValue(new Error('申请不存在'))
    const state = useFriendRequests()
    await state.load()
    const item = state.list.value[0]
    await expect(state.handle(item, 'accept')).resolves.toBe(false)
    expect(item.status).toBe('pending')
    expect(mocks.showError).toHaveBeenCalledWith('申请不存在')
  })

  it('删除成功后从列表移除并提示已删除', async () => {
    const state = useFriendRequests()
    await state.load()
    await expect(state.remove(state.list.value[0])).resolves.toBe(true)
    expect(mocks.deleteFriendRequest).toHaveBeenCalledWith(1)
    expect(state.list.value).toHaveLength(0)
    expect(state.total.value).toBe(0)
    expect(mocks.showSuccess).toHaveBeenCalledWith('contacts.requests.deleted')
  })

  it('一键清空成功后清空列表并提示已清空', async () => {
    const state = useFriendRequests()
    await state.load()
    await expect(state.clearAll()).resolves.toBe(true)
    expect(mocks.clearFriendRequests).toHaveBeenCalled()
    expect(state.list.value).toHaveLength(0)
    expect(mocks.showSuccess).toHaveBeenCalledWith('contacts.requests.cleared')
  })

  it('loadMore 在第二页返回后追加并按 id 去重', async () => {
    mocks.getFriendRequests
      .mockResolvedValueOnce({ list: [sample(1)], total: 3, page: 1, pageSize: 2 })
      .mockResolvedValueOnce({ list: [sample(1), sample(2)], total: 3, page: 2, pageSize: 2 })
    const state = useFriendRequests()
    await state.load()
    expect(state.hasMore.value).toBe(true)
    await state.loadMore()
    expect(mocks.getFriendRequests).toHaveBeenLastCalledWith(2, 20)
    expect(state.list.value.map((i) => i.id)).toEqual([1, 2])
  })
})
