/**
 * 群会话公告加载：点击群会话时用自有服务端群资料覆盖 UIKit 群公告。
 *
 * UIKit 原生横幅与群详情抽屉都读 `stores.group.getGroupAnnouncement(groupId)`，
 * 因此只需写入 store，不必自绘公告组件。
 *
 * 关键竞态：UIKit 在 currentConversation 变化时会检查
 * `getGroupAnnouncement(id) === undefined`，若为 undefined 就用 SDK 再拉一次公告，
 * 其异步回填会盖掉接口结果。因此切群时先同步占位（空串或缓存值），
 * 阻止 SDK 预加载，再写入接口返回的公告；同时持续纠正 SDK 事件后续覆盖。
 */

import { watch } from 'vue'
import { useUIKit } from '@easemob-community/uikit-im'

import {
  getCachedGroupAnnouncementText,
  getGroupAnnouncementText,
  loadGroupDetail,
} from '@/api/group'
import { useUserStore } from '@/store/modules/user'

/** 最近一次请求的群，避免快速切会话时旧响应覆盖新公告 */
let activeGroupId = ''
/** 已由自有接口接管的公告，SDK 事件再次写入时会被纠正回来 */
const ownedAnnouncements = new Map<string, string>()

export function useGroupAnnouncement() {
  const { stores } = useUIKit()
  const userStore = useUserStore()

  function apply(groupId: string, text: string) {
    ownedAnnouncements.set(groupId, text)
    stores.group.setGroupAnnouncement(groupId, text)
  }

  // SDK 的 onAnnouncementChanged 事件会直接写 group store；这里保证自有接口结果始终优先。
  watch(
    () => stores.group.groupAnnouncementMap,
    (map) => {
      for (const [groupId, text] of ownedAnnouncements) {
        if (map?.[groupId] !== text) stores.group.setGroupAnnouncement(groupId, text)
      }
    },
    { deep: true },
  )

  async function load(groupId: string) {
    if (!groupId) return
    activeGroupId = groupId
    // 无登录态时不请求，避免 401 拦截器反复跳登录页
    if (!userStore.token) return

    // 1) 同步占位：避免 UIKit 看到 undefined 后走 SDK 拉取并异步覆盖
    const cached = getCachedGroupAnnouncementText(groupId)
    apply(groupId, cached ?? '')
    if (cached !== undefined) return

    // 2) 自有接口结果写入（失败时保留空串，不再回退到 SDK 旧公告）
    const detail = await loadGroupDetail(groupId)
    if (!detail || activeGroupId !== groupId) return
    apply(groupId, getGroupAnnouncementText(detail))
  }

  return { load }
}
