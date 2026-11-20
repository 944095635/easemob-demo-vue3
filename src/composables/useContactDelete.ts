/**
 * 删除好友（对齐 Flutter FriendHelper.deleteUser）：
 *
 * - 调自有服务 DELETE /api/friend/{userId}，不再走环信 SDK 的 deleteContact；
 * - 成功后本地移除好友、删除单聊会话但保留聊天记录（与 App 一致）；
 * - 失败 toast 服务端 msg 原文，返回 false，由调用方决定页面是否保留。
 *
 * 需在 UIKit Provider 作用域内调用（useUIKit / useConversation / useToast 依赖注入）。
 */
import { useI18n } from 'vue-i18n'
import { useConversation, useToast, useUIKit } from '@easemob-community/uikit-im'

import { deleteFriend } from '@/api/friend'
import { toNumericUserId } from '@/utils/friendUserId'

export function useContactDelete() {
  const { t } = useI18n()
  const { stores } = useUIKit()
  const { removeConversation } = useConversation()
  const { success: showSuccess, error: showError } = useToast()

  /**
   * @param userId 环信用户 ID（可能是 tielian-300009 或纯数字）
   * @param numericUserId 可选：调用方已解析出的数字 userId
   * @returns 删除是否成功
   */
  async function deleteContact(userId: string, numericUserId?: number): Promise<boolean> {
    let numericId = numericUserId
    if (numericId === undefined) {
      try {
        numericId = toNumericUserId(userId)
      } catch (error) {
        showError(error instanceof Error ? error.message : t('contacts.deleteFriend.failed'))
        return false
      }
    }

    try {
      await deleteFriend(numericId)
    } catch (error) {
      // request.ts 已把服务端 msg 作为 Error.message 抛出，直接展示原文（对齐 App DialogHelper）
      showError(error instanceof Error ? error.message : t('contacts.deleteFriend.failed'))
      return false
    }

    // 与 Flutter FriendService.removeFriend 对齐：即时从通讯录移除
    stores.contact.removeContact(userId)

    // 与 Flutter ChatsHelper.deleteChatById(chatId, deleteMessages: false) 对齐：只删会话，保留消息
    try {
      await removeConversation(userId)
    } catch {
      // 会话清理失败不影响好友删除结果
    }

    showSuccess(t('contacts.deleteFriend.success'))
    return true
  }

  return { deleteContact }
}
