/**
 * 好友申请列表（完全对齐 Flutter UserRequestsPage，数据源改为自有服务端）：
 *
 * - 不再使用 UIKit 的 inviteList / EmContactNoticeList（那些来自环信 SDK 事件）；
 * - 列表走自有服务 GET /api/friend/requests（分页），同意/忽略走 POST /friend/request/handle；
 * - 删除单条 / 一键清空分别走 DELETE /friend/request/{id}、DELETE /friend/requests/clear；
 * - 交互与 App 一致：同意后本地写入好友并改状态、忽略只改状态（成功均不弹 toast，失败 toast 服务端 msg）；
 *   删除与清空成功分别提示「已删除」「已清空」。
 *
 * 需在 UIKit Provider 作用域内调用（useUIKit / useToast 依赖注入）。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast, useUIKit } from '@easemob-community/uikit-im'
import type { UiContact } from '@easemob-community/uikit-im'

import {
  clearFriendRequests,
  deleteFriendRequest,
  getFriendRequests,
  handleFriendRequest,
  type FriendRequest,
} from '@/api/friend'

const PAGE_SIZE = 20

export function useFriendRequests() {
  const { t } = useI18n()
  const { stores } = useUIKit()
  const { error: showError, success: showSuccess } = useToast()

  const list = ref<FriendRequest[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref(false)
  const page = ref(1)
  const total = ref(0)

  const hasMore = computed(() => list.value.length < total.value)
  const isEmpty = computed(() => !loading.value && !error.value && list.value.length === 0)

  /** 首次加载 / 重新加载（重置分页） */
  async function load(): Promise<void> {
    loading.value = true
    error.value = false
    page.value = 1
    try {
      const result = await getFriendRequests(1, PAGE_SIZE)
      list.value = result.list
      total.value = result.total
      page.value = result.page || 1
    } catch {
      error.value = true
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 上拉加载更多（App EasyRefresh onLoad：pageIndex++，按 list.length < total 判断 noMore） */
  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    const nextPage = page.value + 1
    try {
      const result = await getFriendRequests(nextPage, PAGE_SIZE)
      // 简单的去重：按申请 id 合并，避免分页边界重复
      const existing = new Set(list.value.map((item) => item.id))
      list.value.push(...result.list.filter((item) => !existing.has(item.id)))
      total.value = result.total
      page.value = result.page || nextPage
    } catch (e) {
      // 加载更多失败不覆盖整页，仅提示（对齐 App 失败态只影响当前请求）
      showError(errorMessage(e, 'contacts.requests.loadFailed'))
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * 同意 / 忽略：成功后只改本地状态，不弹成功 toast（对齐 Flutter onAgree/onReject）。
   * 同意时额外把对方写入本地联系人（对齐 Flutter FriendService.addFriend）。
   * @returns 是否处理成功
   */
  async function handle(
    request: FriendRequest,
    action: 'accept' | 'reject',
  ): Promise<boolean> {
    if (!request.id) return false
    try {
      await handleFriendRequest(request.id, action)
    } catch (e) {
      showError(errorMessage(e, 'contacts.requests.handleFailed'))
      return false
    }

    request.status = action === 'accept' ? 'accepted' : 'rejected'
    if (action === 'accept') {
      addLocalFriend(request)
    }
    return true
  }

  /** 删除单条记录（确认弹窗由组件负责） */
  async function remove(request: FriendRequest): Promise<boolean> {
    try {
      await deleteFriendRequest(request.id)
    } catch (e) {
      showError(errorMessage(e, 'contacts.requests.handleFailed'))
      return false
    }
    list.value = list.value.filter((item) => item.id !== request.id)
    total.value = Math.max(0, total.value - 1)
    showSuccess(t('contacts.requests.deleted'))
    return true
  }

  /** 一键清空（确认弹窗由组件负责） */
  async function clearAll(): Promise<boolean> {
    try {
      await clearFriendRequests()
    } catch (e) {
      showError(errorMessage(e, 'contacts.requests.handleFailed'))
      return false
    }
    list.value = []
    total.value = 0
    page.value = 1
    showSuccess(t('contacts.requests.cleared'))
    return true
  }

  /** 同意后写入本地联系人，使通讯录即时可见（chatId 用 tielian- 前缀，与 App 一致） */
  function addLocalFriend(request: FriendRequest): void {
    if (!request.userId || stores.contact.getContact(`tielian-${request.userId}`)) return
    const contact: UiContact = {
      userId: `tielian-${request.userId}`,
      name: request.remark || request.nickname,
      avatar: request.avatar,
      remark: request.remark,
    }
    stores.contact.addContact(contact)
  }

  return {
    list,
    loading,
    loadingMore,
    error,
    page,
    total,
    hasMore,
    isEmpty,
    load,
    loadMore,
    handle,
    remove,
    clearAll,
  }
}

function errorMessage(e: unknown, fallbackKey: string): string {
  return e instanceof Error && e.message ? e.message : fallbackKey
}
