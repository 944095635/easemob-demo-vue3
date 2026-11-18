<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  EmBadge,
  EmIcon,
  EmPresenceAvatar,
  useClient,
  useContact,
  useConversationStore,
  useOwnUserInfo,
} from '@easemob-community/uikit-im'
import type { UiContactInvite } from '@easemob-community/uikit-im'
import { useRoute } from 'vue-router'

import CheckUpdates from '@/components/CheckUpdates.vue'
import { useMobileTabbar } from '@/composables/useMobileTabbar'
import { useMobileView } from '@/composables/useMobileView'
import { useSettingsDrawer } from '@/composables/useSettingsDrawer'
import { DEMO_AVATAR_CONFIG } from '@/config/demo'

import SettingsDrawer from './SettingsDrawer.vue'

defineOptions({ name: 'AppLayout' })

const isMobileView = useMobileView()
const { isTabbarHidden } = useMobileTabbar()
const {
  isOpen: isSettingsDrawerOpen,
  close: closeSettingsDrawer,
} = useSettingsDrawer()
const { t } = useI18n()
const route = useRoute()
const { currentUser } = useClient()
const { avatarUrl, displayName } = useOwnUserInfo()
const conversationStore = useConversationStore()
const { inviteList } = useContact()

/* 导航图标对齐设计稿图标资源：聚焦为面性（filled），不聚焦为线性（stroked） */
interface NavTab {
  key: string
  icon: string
  activeIcon: string
  label: string
  to: string
  size: number
}

const tabs: NavTab[] = [
  {
    key: 'chat',
    icon: 'bubble/rect',
    activeIcon: 'filled/bubble/rect/empty',
    label: t('nav.chat'),
    to: '/chat',
    size: 24,
  },
  {
    key: 'contacts',
    icon: 'person/list',
    activeIcon: 'filled/person/list',
    label: t('nav.contacts'),
    to: '/contacts',
    size: 24,
  },
]

/** 当前路由命中时返回面性图标，否则返回线性图标 */
function navIcon(tab: NavTab) {
  return route.path.startsWith(tab.to) ? tab.activeIcon : tab.icon
}

/* H5 tabbar 在导航两项之后追加「设置」入口（PC 的设置入口在侧边栏工具区，不进 tabs）；
   hamburger 图标无 filled 变体，选中态靠主色区分 */
const mobileTabs: NavTab[] = [
  ...tabs,
  {
    key: 'settings',
    icon: 'hamburger',
    activeIcon: 'hamburger',
    label: t('nav.settings'),
    to: '/settings',
    size: 24,
  },
]

/** 会话未读总数（忽略静音会话） */
const totalUnread = computed(() => {
  return conversationStore.conversationList.reduce((sum, cvs) => {
    if (cvs.isMuted) return sum
    return sum + (cvs.unreadCount || 0)
  }, 0)
})

/** 联系人/群邀请待处理数量 + 我发出的申请被对方拒绝且未读的通知数 */
const pendingNoticeCount = computed(() => {
  // installed store 的类型声明缺 unread 字段，以 contract 的 UiContactInvite 为准（运行时存在）
  const list = inviteList.value as UiContactInvite[]
  return list.filter(
    (item) =>
      item.status === 'pending' ||
      (item.outgoing === true && item.status === 'declined' && item.unread === true),
  ).length
})

/* 路由切换（H5 底部 tabbar / PC 侧边栏导航）时自动收起设置抽屉：
   抽屉是布局级浮层，跨页面保留会让它罩在无关页面上 */
watch(
  () => route.path,
  () => closeSettingsDrawer(),
)

</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--mobile': isMobileView }">
    <!-- PC：左侧图标导航栏 -->
    <aside v-if="!isMobileView" class="app-layout__aside">
      <div class="app-layout__avatar">
        <EmPresenceAvatar
          :user-id="currentUser || 'Guest'"
          :src="avatarUrl"
          :name="displayName || currentUser || 'Guest'"
          :size="DEMO_AVATAR_CONFIG.size"
          :presence-size="DEMO_AVATAR_CONFIG.presenceSize"
          :editable="DEMO_AVATAR_CONFIG.editable"
          selector-placement="right"
        />
      </div>

      <nav class="app-layout__nav">
        <router-link v-for="tab in tabs" :key="tab.key" class="app-layout__nav-item" :to="tab.to">
          <EmBadge
            v-if="tab.key === 'chat' && totalUnread > 0"
            :count="totalUnread"
            class="app-layout__nav-badge"
          >
            <EmIcon :name="navIcon(tab)" :size="tab.size" />
          </EmBadge>
          <EmBadge
            v-else-if="tab.key === 'contacts' && pendingNoticeCount > 0"
            :count="pendingNoticeCount"
            class="app-layout__nav-badge"
          >
            <EmIcon :name="navIcon(tab)" :size="tab.size" />
          </EmBadge>
          <EmIcon v-else :name="navIcon(tab)" :size="tab.size" />
        </router-link>
      </nav>

      <div class="app-layout__tools">
        <router-link class="app-layout__tool-btn" to="/settings" :aria-label="t('nav.settings')">
          <EmIcon name="hamburger" :size="24" />
        </router-link>
      </div>
    </aside>

    <main class="app-layout__main">
      <div class="app-layout__content">
        <router-view />
      </div>
      <!-- 右侧设置抽屉：挤占式（flex 兄弟节点宽度动画），非遮盖 -->
      <Transition name="settings-drawer">
        <SettingsDrawer v-if="isSettingsDrawerOpen" />
      </Transition>
    </main>

    <!-- H5：底部 tabbar 导航（会话聊天态下隐藏，见 useMobileTabbar） -->
    <nav v-if="isMobileView && !isTabbarHidden" class="app-layout__tabbar safe-area-bottom">
      <router-link v-for="tab in mobileTabs" :key="tab.key" class="app-layout__tab" :to="tab.to">
        <EmBadge
          v-if="tab.key === 'chat' && totalUnread > 0"
          :count="totalUnread"
          class="app-layout__tab-badge"
        >
          <EmIcon :name="navIcon(tab)" :size="tab.size" />
        </EmBadge>
        <EmBadge
          v-else-if="tab.key === 'contacts' && pendingNoticeCount > 0"
          :count="pendingNoticeCount"
          class="app-layout__tab-badge"
        >
          <EmIcon :name="navIcon(tab)" :size="tab.size" />
        </EmBadge>
        <EmIcon v-else :name="navIcon(tab)" :size="tab.size" />
        <span class="app-layout__tab-label">{{ tab.label }}</span>
      </router-link>
    </nav>

    <!-- 新版本检测：轮询 index.html 指纹变化时全屏弹窗引导刷新 -->
    <CheckUpdates />
  </div>
</template>

<style lang="scss" scoped src="./index.scss"></style>
