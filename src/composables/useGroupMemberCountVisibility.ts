/**
 * 聊天页群人数后缀的可见性（对齐 Flutter ChatAppbarWidget 的群聊副标题规则）。
 *
 * App 规则（lib/page/chat/widget/chat_appbar_widget.dart）：
 * - isHideMember = groupInfo?.hideMemberList ?? true（查不到群资料也当隐藏）；
 * - 未隐藏群成员 → 显示 "N 成员"（露出人数）；
 * - 隐藏群成员 → 仅 isVip || isOwnerOrManager 时显示 "群成员已隐藏 N 成员"（露出人数），
 *   普通成员只显示 "群成员已隐藏"（不露出人数）。
 *
 * Web 端 UIKit 只提供 config.header.showMemberCount 布尔开关控制标题后的 "(N)"，
 * 没有「群成员已隐藏」文案态，故此处只决定「露不露人数」这一布尔值：
 *   showMemberCount = !isHideMember || isVip || isOwnerOrManager
 *
 * 数据来源：
 * - hide_member_list / my_role：自有服务端群资料 GET /api/group/{id}（loadGroupDetail 自带缓存+pending 去重）；
 * - is_vip：当前登录用户完整资料（useCurrentProfile，登录时拉取）；
 * - 角色兜底：UIKit group store 的 role（自有接口未返回 my_role 时）。
 *
 * 需在 UIKit Provider 作用域内调用（useUIKit / useConversation 依赖注入）。
 */
import { computed, ref, watch } from 'vue'
import { CONVERSATION_TYPE, useConversation, useUIKit } from '@easemob-community/uikit-im'

import { loadGroupDetail, type GroupDetail } from '@/api/group'
import { useCurrentProfile } from '@/composables/useUserProfile'
import { useUserStore } from '@/store/modules/user'

/** 自有接口群资料缓存：群 ID -> GroupDetail（模块级，跨页面切换保留，与 api 层缓存互补） */
const groupDetailMap = ref<Record<string, GroupDetail>>({})

/** 最近一次请求的群，避免快速切会话时旧响应覆盖新结果 */
let activeGroupId = ''

/** 群角色中可查看隐藏成员的人数：群主 / 管理员 */
const OWNER_OR_MANAGER_ROLES = ['owner', 'admin']

/**
 * 纯判断函数：给定群资料 / VIP / 兜底角色，是否显示人数后缀。
 * 抽出便于单测覆盖 App 规则的各个分支。
 *
 * @param detail 自有接口群资料（可为空，空则按「隐藏成员」处理）
 * @param isVip 当前账号是否 VIP
 * @param fallbackRole 自有接口未返回 my_role 时，UIKit group store 的角色兜底
 */
export function computeShowMemberCount(
  detail: GroupDetail | undefined,
  isVip: boolean,
  fallbackRole?: string | number,
): boolean {
  // 查不到群资料时按 App 语义当「隐藏」
  const isHideMember = detail?.hide_member_list ?? true
  if (!isHideMember) return true

  const role = detail?.my_role ?? fallbackRole
  const isOwnerOrManager = OWNER_OR_MANAGER_ROLES.includes(String(role))
  return isVip || isOwnerOrManager
}

export function useGroupMemberCountVisibility() {
  const { stores } = useUIKit()
  const { currentConversation } = useConversation()
  const currentProfile = useCurrentProfile()
  const userStore = useUserStore()

  /** 当前会话为群聊时返回群 ID，否则空串 */
  const currentGroupId = computed(() => {
    const cvs = currentConversation.value
    return cvs && cvs.type === CONVERSATION_TYPE.GROUPCHAT && cvs.id ? cvs.id : ''
  })

  /** 拉取群资料供可见性判断；无登录态不请求，避免 401 拦截器反复跳登录页 */
  async function load(groupId: string) {
    if (!groupId) return
    activeGroupId = groupId
    if (!userStore.webApiToken && !userStore.token) return

    const detail = await loadGroupDetail(groupId)
    if (!detail || activeGroupId !== groupId) return
    groupDetailMap.value = { ...groupDetailMap.value, [groupId]: detail }
  }

  // 群会话切换即加载（与 useGroupAnnouncement 共用 loadGroupDetail：同群只发一次请求）
  watch(currentGroupId, (id) => { if (id) void load(id) }, { immediate: true })

  /**
   * 聊天页是否显示群人数后缀。
   * 非群聊恒为 true（单聊 header 本就不渲染人数，不影响）；
   * 群聊按 App 规则：未隐藏成员、VIP、群主/管理员任一成立即显示。
   */
  const showMemberCount = computed(() => {
    const groupId = currentGroupId.value
    if (!groupId) return true

    const detail = groupDetailMap.value[groupId]
    const isVip = currentProfile.value?.is_vip ?? false
    // 自有接口 my_role 优先，UIKit group store 角色兜底（owner/admin/member）
    const fallbackRole = stores.group.getGroupById(groupId)?.role
    return computeShowMemberCount(detail, isVip, fallbackRole)
  })

  return { showMemberCount, load }
}
