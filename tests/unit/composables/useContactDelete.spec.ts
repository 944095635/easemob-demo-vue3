import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteFriend: vi.fn(),
  removeConversation: vi.fn(),
  removeContact: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/friend', () => ({
  deleteFriend: mocks.deleteFriend,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@easemob-community/uikit-im', () => ({
  useUIKit: () => ({ stores: { contact: { removeContact: mocks.removeContact } } }),
  useConversation: () => ({ removeConversation: mocks.removeConversation }),
  useToast: () => ({ success: mocks.showSuccess, error: mocks.showError }),
}))

import { useContactDelete } from '@/composables/useContactDelete'

describe('useContactDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteFriend.mockResolvedValue(undefined)
    mocks.removeConversation.mockResolvedValue(undefined)
  })

  it('成功后移除本地好友与会话（保留消息）并提示成功', async () => {
    const { deleteContact } = useContactDelete()
    await expect(deleteContact('tielian-300009')).resolves.toBe(true)

    expect(mocks.deleteFriend).toHaveBeenCalledWith(300009)
    expect(mocks.removeContact).toHaveBeenCalledWith('tielian-300009')
    expect(mocks.removeConversation).toHaveBeenCalledWith('tielian-300009')
    expect(mocks.showSuccess).toHaveBeenCalledWith('contacts.deleteFriend.success')
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('调用方已解析数字 id 时直接透传，不重复解析', async () => {
    const { deleteContact } = useContactDelete()
    await deleteContact('300009', 300009)
    expect(mocks.deleteFriend).toHaveBeenCalledWith(300009)
  })

  it('接口失败时展示服务端 msg 原文，且不改动本地状态', async () => {
    mocks.deleteFriend.mockRejectedValue(new Error('非好友关系'))
    const { deleteContact } = useContactDelete()

    await expect(deleteContact('tielian-300009')).resolves.toBe(false)
    expect(mocks.showError).toHaveBeenCalledWith('非好友关系')
    expect(mocks.removeContact).not.toHaveBeenCalled()
    expect(mocks.removeConversation).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
  })

  it('用户 ID 无法解析时提示并返回 false，不发请求', async () => {
    const { deleteContact } = useContactDelete()
    await expect(deleteContact('easemob-uuid')).resolves.toBe(false)

    expect(mocks.showError).toHaveBeenCalled()
    expect(mocks.deleteFriend).not.toHaveBeenCalled()
  })

  it('会话清理失败不影响删除好友结果', async () => {
    mocks.removeConversation.mockRejectedValue(new Error('no conversation'))
    const { deleteContact } = useContactDelete()

    await expect(deleteContact('300009')).resolves.toBe(true)
    expect(mocks.showSuccess).toHaveBeenCalledWith('contacts.deleteFriend.success')
  })
})
