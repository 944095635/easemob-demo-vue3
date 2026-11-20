<script setup lang="ts">
import { computed, onUnmounted, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  CONVERSATION_TYPE,
  EmChatContainer,
  EmConversationContainer,
  EmCreateGroupModal,
  EmCustomMessage,
  EmIcon,
  EmResizable,
  useConversation,
  useConversationTabs,
  useLocale,
  useToast,
  useUIKit,
  useViewport,
} from '@easemob-community/uikit-im'
import type {
  ConversationHeaderMenuItem,
  ConversationTabKey,
  UiMessage,
} from '@easemob-community/uikit-im'

import MarkdownStreamMessage from '@/components/ai/MarkdownStreamMessage.vue'
import BidirectionalMessage from '@/components/chat/BidirectionalMessage.vue'
import CardMessage from '@/components/chat/CardMessage.vue'
import EmojiMessage from '@/components/chat/EmojiMessage.vue'
import GroupInviteMessage from '@/components/chat/GroupInviteMessage.vue'
import NoteMessage from '@/components/chat/NoteMessage.vue'
import SystemNoticeMessage from '@/components/chat/SystemNoticeMessage.vue'
import UnsupportedCustomTip from '@/components/chat/UnsupportedCustomTip.vue'
import { useDemoCreateGroup } from '@/composables/useDemoCreateGroup'
import { useDemoSettings } from '@/composables/useDemoSettings'
import { useGroupAnnouncement } from '@/composables/useGroupAnnouncement'
import { useGroupMemberCountVisibility } from '@/composables/useGroupMemberCountVisibility'
import { useMobileTabbar } from '@/composables/useMobileTabbar'
import { useMobileView } from '@/composables/useMobileView'
import { useSidebarWidth } from '@/composables/useSidebarWidth'
import { getMockAiReply, simulateStreamMessage } from '@/composables/useStreamDemo'
import { isBidirectionalMessage } from '@/utils/bidirectionalMessage'
import { isCardMessage } from '@/utils/cardMessage'
import { isEmojiMessage } from '@/utils/customEmojiMessage'
import { isGroupInviteMessage } from '@/utils/groupInviteMessage'
import { isNoteMessage } from '@/utils/noteMessage'
import { isSystemNoticeMessage } from '@/utils/systemNoticeMessage'
import { isUnsupportedCustomMessage } from '@/utils/customMessage'
import { addCustomEmoji, createCollection } from '@/api/collection'
import { buildCollectionFromMessage, canCollectMessage } from '@/utils/favoriteMessage'
import { trackEvent } from '@/utils/analytics'
import {
  DEMO_CHAT_CONFIG,
  DEMO_CONVERSATION_CONFIG,
  DEMO_ICON_SIZE,
  DEMO_RESIZABLE_CONFIG,
  DEMO_SIDEBAR_CONFIG,
} from '@/config/demo'

defineOptions({ name: 'ChatPage' })

const { t, locale } = useI18n()
const router = useRouter()
const isMobileView = useMobileView()
const { isMobile } = useViewport()
const { currentConversation, leaveConversation, refreshConversationPreviews } = useConversation()
const { demoCreateGroup } = useDemoCreateGroup()
const { t: tUI, locale: uikitLocale } = useLocale()
const { success: showSuccess, error: showError } = useToast()

const hasCurrentConversation = computed(() => !!currentConversation.value)

/* ===== 群公告：点击群会话时拉取自有服务端群资料，写入 UIKit group store ===== */
const { load: loadGroupAnnouncement } = useGroupAnnouncement()

/* ===== 群人数后缀可见性：按 App 规则由「是否隐藏群成员」+「当前账号 VIP / 群角色」动态决定 ===== */
const { showMemberCount, showGroupMemberList } = useGroupMemberCountVisibility()

/* ===== 消息收藏：右键/长按菜单「收藏」，对齐 App onTapCollection =====
 * Web 端不上传文件到 OSS：图片/视频/文件直接收藏消息体里的原始地址（见 favoriteMessage.ts）。
 */
/**
 * 右键菜单里「收藏」的位置：UIKit 把 extra 插槽内容固定渲染在整个菜单最后，
 * 而 App 里收藏排在「置顶」之前。菜单是 flex column，内置项的 class 为
 * .message-action-menu__item 且无稳定 type 标识，故按「置顶/取消置顶」文案定位，
 * 用 flex order 把置顶及其后的项后置，让收藏自然落在置顶前。
 * 只改 style.order、不动 DOM 结构，避免与 Vue patch 冲突；函数幂等可重复调用。
 * H5 action sheet 结构不同（父容器非 .message-action-menu），保持末尾不变。
 */
function placeCollectItem(ref: Element | ComponentPublicInstance | null): void {
  const el = ref instanceof Element ? ref : null
  if (!el) return
  const host = el.parentElement
  if (!host?.classList.contains('message-action-menu')) return
  const items = Array.from(host.children).filter((node) =>
    node.classList.contains('message-action-menu__item'),
  ) as HTMLElement[]
  if (!items.length) return

  // 菜单 label 与 tUI 同源（同一 i18n key）；把 key 本身也纳入候选，兼容缺翻译时返回 key 的情况
  const pinLabels = [
    tUI('message.action.pin'),
    tUI('message.action.unpin'),
    'message.action.pin',
    'message.action.unpin',
    '置顶',
    '取消置顶',
    'Pin',
    'Unpin',
  ].filter(Boolean) as string[]
  const pinIndex = items.findIndex((item) => {
    const label = (item.textContent || '').trim()
    return pinLabels.some((candidate) => label === candidate || label.includes(candidate))
  })
  if (pinIndex < 0) return

  items.slice(pinIndex).forEach((item) => {
    item.style.order = '1'
  })
  ;(el as HTMLElement).style.order = '0'
}

async function onCollectMessage(message: UiMessage): Promise<void> {
  if (!canCollectMessage(message)) return
  try {
    const result = buildCollectionFromMessage(message)
    if (!result) return
    if (result.kind === 'emoji') {
      if (!result.emojiUrl) throw new Error(t('favorite.collectFailed'))
      await addCustomEmoji(result.emojiUrl)
      showSuccess(t('favorite.collectEmojiSuccess'))
      return
    }
    if (!result.payload) throw new Error(t('favorite.collectFailed'))
    await createCollection(result.payload)
    showSuccess(t('favorite.collectSuccess'))
  } catch (err) {
    showError(err instanceof Error ? err.message : t('favorite.collectFailed'))
  }
}

interface ConversationLike {
  id: string
  type?: string | number
}

function onConversationSelect(conversation: ConversationLike) {
  if (conversation?.type === CONVERSATION_TYPE.GROUPCHAT && conversation.id) {
    void loadGroupAnnouncement(conversation.id)
  }
}

// 点击会话列表 / 程序化切换都会改变 currentConversation，这里兜底覆盖；
// 同一群重复点击由 api 层缓存与 pending 去重，不会重复请求。
watch(
  () => ({ id: currentConversation.value?.id, type: currentConversation.value?.type }),
  ({ id, type }) => {
    if (id && type === CONVERSATION_TYPE.GROUPCHAT) void loadGroupAnnouncement(id)
  },
  { immediate: true },
)

/**
 * 会话列表右上角「+」菜单项：新建会话 + 添加好友。
 * 添加好友按 App 流程跳搜索用户页（搜索 → 资料 → 发送申请），不再使用单步 SDK 弹窗。
 * 创建群组保持 UIKit 内置弹窗（见下方 #create-group 插槽）。
 */
const conversationMenuItems = computed<ConversationHeaderMenuItem[]>(() => {
  // 依赖 uikitLocale，确保切换语言时重新取文案（tUI 本身非 ref）
  void uikitLocale.value
  return [
    {
      key: 'newChat',
      label: tUI('conversation.newChat'),
      icon: 'bubble/rect/empty',
    },
    {
      key: 'addFriend',
      label: t('contacts.search.title'),
      icon: 'person/plus',
      handler: () => {
        void router.push({ name: 'ContactSearch' })
      },
    },
  ]
})

// 进入页面及切换语言时仅重算摘要，不覆盖草稿、免打扰、名称、头像或本地独有会话
watch(locale, () => refreshConversationPreviews(), { immediate: true })

/* ===== 会话UIKit 特性开关配置（由特性抽屉「会话」面板驱动） ===== */
const {
  statusBannerEnabled,
  conversationUnreadMode,
  conversationUnreadPlacement,
  conversationBadgePlacement,
  conversationTabs,
  conversationTabsVisible,
  conversationTabsTakeover,
  conversationActiveTab,
  // 聊天UIKit 特性开关
  chatInputMode,
  chatInputStyle,
  chatInputFeatures,
  chatInputAutoFocus,
  chatInputFocusBorderColor,
  chatInputCaretColor,
  chatInputSelectionColor,
  chatInputMaxLength,
  groupReadReceiptEnabled,
  groupReadReceiptMaxSize,
  chatPinnedBarVisible,
  chatGroupAnnouncementBarVisible,
  chatShowTime,
  chatMessageSearchEnabled,
  chatMessageServerSearchEnabled,
  chatMessageListShowAvatar,
  chatMessageShowSelfAvatar,
  chatMessageStatusShowText,
  chatMessageStatusDirection,
  chatMessageStatusPosition,
  chatMessageStatusStyle,
  chatMessageAction,
  // AI 流式演示
  aiMockReplyEnabled,
} = useDemoSettings()

/** 完全接管模式：使用 useConversationTabs hook 自绘 tab 栏 */
const {
  tabs: takeoverTabs,
  activeTab: takeoverActiveTab,
  selectTab: takeoverSelectTab,
} = useConversationTabs({
  tabs: ['all', 'unread', 'single', 'group'],
  activeTab: 'all',
})

/** 实际传给 EmConversationContainer 的 tabs（接管模式优先；普通模式按显隐开关置空） */
const effectiveConversationTabs = computed(() =>
  conversationTabsTakeover.value
    ? takeoverTabs.value
    : conversationTabsVisible.value
      ? conversationTabs.value
      : [],
)

/** 实际激活的 tab：接管模式用 hook 状态，普通模式用面板状态 */
const effectiveConversationActiveTab = computed(() =>
  conversationTabsTakeover.value ? takeoverActiveTab.value : conversationActiveTab.value,
)

function onConversationActiveTabChange(tab: ConversationTabKey) {
  if (conversationTabsTakeover.value) takeoverSelectTab(tab)
  else conversationActiveTab.value = tab
}

/** 接管模式下自绘 tab 按钮的文案 */
const takeoverTabLabels = computed<Record<string, string>>(() => ({
  all: t('features.conversation.tabLabels.all'),
  unread: t('features.conversation.tabLabels.unread'),
  atMe: t('features.conversation.tabLabels.atMe'),
  single: t('features.conversation.tabLabels.single'),
  group: t('features.conversation.tabLabels.group'),
}))

/** H5：返回会话列表 */
function backToConversationList() {
  leaveConversation()
}

/* ===== H5 会话聊天态隐藏底部 tabbar（复用 hasCurrentConversation 驱动，不新造平行状态） ===== */
const { hideTabbar, showTabbar } = useMobileTabbar()

// 仅 H5 生效：进入会话聊天态隐藏 tabbar（避免顶起表情面板 / 输入区），返回列表态恢复；
// PC 下 tabbar 本就不渲染，此处始终保持显示态、无影响
watch(
  [hasCurrentConversation, isMobileView],
  ([inChat, mobile]) => {
    if (mobile && inChat) hideTabbar()
    else showTabbar()
  },
  { immediate: true },
)

// 离开聊天页兜底复位，避免其他页面 tabbar 消失
onUnmounted(showTabbar)

/* ===== 会话列表宽度（默认 360px + EmResizable 拖拽定宽 + localStorage 持久化） ===== */

const { stores } = useUIKit()
// 无记忆时 sidebarWidth 回退默认宽度 360px（不走 UIKit fluid 弹性基准，宽窗口下 25% 过宽）；
// 拖拽后持久化，三页（会话 / 通讯录 / 设置）同一存储 key，宽度联动一致
const { sidebarWidth, persistSidebarWidth } = useSidebarWidth('layout_sidebar_width')

/* ===== 聊天UIKit 特性开关配置（由特性抽屉「聊天」面板驱动） ===== */
const chatConfig = computed(() => ({
  ...DEMO_CHAT_CONFIG,
  // 群人数后缀：对齐 App ChatAppbarWidget——群隐藏成员时仅 VIP / 群主 / 管理员露出人数，
  // 普通成员不显示；未隐藏成员时正常显示。由 useGroupMemberCountVisibility 动态计算。
  header: { showMemberCount: showMemberCount.value },
  // 抽屉挤出模式（对齐 UIKit demo 默认档）：好友 / 群信息面板作为独立平面区域挤压聊天区，
  // 与聊天主区之间的间隙透出外层灰底；'overlay' 则为遮挡式浮层
  drawer: { mode: 'push' as const },
  // 隐藏群文件入口：聊天详情抽屉与群管理面板的「群文件/共享文件」入口均读该开关，
  // 关闭后两处入口一并消失（群文件消息本身仍可正常收发展示）。
  groupManagement: { showSharedFiles: false },
  groupReadReceipt: {
    enabled: groupReadReceiptEnabled.value,
    maxGroupSize: groupReadReceiptMaxSize.value,
  },
  input: {
    ...DEMO_CHAT_CONFIG.input,
    mode: chatInputMode.value,
    style: chatInputStyle.value,
    features: { ...chatInputFeatures.value },
    autoFocus: chatInputAutoFocus.value,
    ...(chatInputFocusBorderColor.value
      ? { focusBorderColor: chatInputFocusBorderColor.value }
      : {}),
    ...(chatInputCaretColor.value ? { caretColor: chatInputCaretColor.value } : {}),
    ...(chatInputSelectionColor.value ? { selectionColor: chatInputSelectionColor.value } : {}),
    ...(chatInputMaxLength.value > 0 ? { maxLength: chatInputMaxLength.value } : {}),
  },
  messageList: {
    pinnedBar: { visible: chatPinnedBarVisible.value },
    groupAnnouncementBar: { visible: chatGroupAnnouncementBarVisible.value },
    showTime: chatShowTime.value,
    showAvatar: chatMessageListShowAvatar.value,
    showSelfAvatar: chatMessageShowSelfAvatar.value,
    search: {
      enabled: chatMessageSearchEnabled.value,
      enableServerSearch: chatMessageServerSearchEnabled.value,
    },
    messageStatus: {
      showText: chatMessageStatusShowText.value,
      direction: chatMessageStatusDirection.value,
      position: chatMessageStatusPosition.value,
      style: chatMessageStatusStyle.value,
    },
  },
  messageAction: { ...chatMessageAction.value },
}))

/* ===== AI 流式演示（mock） ===== */

const aiRepliedMessageIds = new Set<string>()

/**
 * AI 应答（mock）：开启后自己发送文本消息，自动注入 mock AI 的 markdown 流式回复。
 * 监听当前会话最后一条消息（isSelf 文本、非流式、非撤回）→ 延迟触发模拟器。
 */
watch(
  () => {
    const cvsId = stores.conversation.currentConversationId
    if (!cvsId || !aiMockReplyEnabled.value) return ''
    const msgs = stores.message.getMessages(cvsId)
    const last = msgs[msgs.length - 1]
    if (
      !last ||
      !last.isSelf ||
      last.type !== 'text' ||
      last.recalled ||
      last.stream ||
      aiRepliedMessageIds.has(last.msgLocalId || last.msgServerId)
    ) {
      return ''
    }
    return last.msgLocalId || last.msgServerId
  },
  (msgId) => {
    if (!msgId) return
    const cvs = stores.conversation.currentConversation
    if (!cvs) return
    const msgs = stores.message.getMessages(cvs.id)
    const last = msgs[msgs.length - 1]
    if (!last) return
    aiRepliedMessageIds.add(msgId)
    // 百度统计：AI 流式应答触发（核心功能触达）
    trackEvent('chat', 'ai-reply')
    const question = (last.body as { content?: string }).content || ''
    window.setTimeout(() => {
      simulateStreamMessage(stores.message, {
        conversationId: cvs.id,
        conversationType: cvs.type,
        to: stores.client.currentUser || '',
        customType: 'markdown',
        content: getMockAiReply(question),
      })
    }, 700)
  },
)

/* ===== 百度统计：发消息触达（每会话首次，reach 口径不看发送量） ===== */
const trackedSendConversationIds = new Set<string>()

// 监听当前会话最后一条消息（isSelf、非流式、非撤回、非通知）；
// timestamp 新鲜度守卫：打开含漫游历史的会话时，历史己方消息不计为「发送」。
// 已知取舍：本人在其他设备刚发的消息多设备同步进来也会被命中，demo 埋点口径接受该误差
watch(
  () => {
    const cvsId = stores.conversation.currentConversationId
    if (!cvsId) return null
    const msgs = stores.message.getMessages(cvsId)
    const last = msgs[msgs.length - 1]
    if (!last || !last.isSelf || last.recalled || last.stream || last.type === 'notice') return null
    if (Date.now() - last.timestamp > 10_000) return null
    // 随 getter 一并返回消息类型：回调里不重读最后一条，避免期间对方秒回导致 label 串台
    return { id: last.msgLocalId || last.msgServerId, type: last.type }
  },
  (msg) => {
    if (!msg) return
    const cvs = stores.conversation.currentConversation
    if (!cvs || trackedSendConversationIds.has(cvs.id)) return
    trackedSendConversationIds.add(cvs.id)
    trackEvent('chat', 'send-message', msg.type)
  },
)
</script>

<template>
  <div
    class="chat-page"
    :class="{
      'chat-page--pc': !isMobileView,
      // 人数后缀：隐藏成员且非 VIP / 非群主管理员时隐藏（对齐 App ChatAppbarWidget）
      'chat-page--hide-member-count': !showMemberCount,
      // 成员列表：隐藏成员且非群主 / 管理员时隐藏（对齐 App chat_setup_group_page.dart，VIP 不含在内）
      'chat-page--hide-group-members': !showGroupMemberList,
    }"
  >
    <!-- PC 端：左侧会话列表 + 右侧聊天窗口（容器间距对齐 UIKit demo，见 DEMO_CONTAINER_CONFIG） -->
    <template v-if="!isMobileView">
      <!-- 会话列表宽度默认 360px，可拖拽定宽（240~480），拖拽后持久化到 UIKIT 内部配置存储 -->
      <EmResizable
        v-model="sidebarWidth"
        :axis="DEMO_RESIZABLE_CONFIG.axis"
        :min="DEMO_SIDEBAR_CONFIG.minWidth"
        :max="DEMO_SIDEBAR_CONFIG.maxWidth"
        :initial="DEMO_SIDEBAR_CONFIG.defaultWidth"
        :handle-size="DEMO_RESIZABLE_CONFIG.handleSize"
        class="chat-page__sidebar"
        @resize-end="persistSidebarWidth"
      >
        <EmConversationContainer
          :pull-refresh="isMobile && DEMO_CONVERSATION_CONFIG.pullRefresh"
          :menu-items="conversationMenuItems"
          :tabs="effectiveConversationTabs"
          :active-tab="effectiveConversationActiveTab"
          :show-status-banner="statusBannerEnabled"
          :unread-mode="conversationUnreadMode"
          :unread-placement="conversationUnreadPlacement"
          :badge-placement="conversationBadgePlacement"
          @conversation-select="onConversationSelect"
          @conversation-click="onConversationSelect"
          @update:active-tab="onConversationActiveTabChange"
        >
          <!-- 创建群组接管：群名改为「群组 + 创建日期时间」，便于区分造数 -->
          <template #create-group="{ show, close }">
            <EmCreateGroupModal :show="show" :create-fn="demoCreateGroup" @update:show="close" />
          </template>
          <template v-if="conversationTabsTakeover" #tabs="{ tabs, activeTab, selectTab }">
            <div class="chat-page__takeover-tabs">
              <button
                v-for="tab in tabs"
                :key="tab"
                type="button"
                class="chat-page__takeover-tab"
                :class="{ 'chat-page__takeover-tab--active': activeTab === tab }"
                @click="selectTab(tab)"
              >
                {{ takeoverTabLabels[tab] || tab }}
              </button>
            </div>
          </template>
        </EmConversationContainer>
      </EmResizable>
      <div class="chat-page__main">
        <!-- card 档位（对齐 UIKit demo）：圆角卡片壳（细边框 + 圆角 + 底色）由容器自绘，
             宿主壳退化为纯定位容器，避免双层卡片 -->
        <EmChatContainer variant="card" :config="chatConfig">
          <template #message-text="{ message }">
            <MarkdownStreamMessage :message="message as UiMessage" />
          </template>
          <!-- 右键/长按菜单追加「收藏」（对齐 App message_item.dart 的收藏项） -->
          <template #message-action-extra="{ message }">
            <div :ref="placeCollectItem" class="chat-collect-action" @click="onCollectMessage(message as UiMessage)">
              <EmIcon name="status/star" :size="16" />
              <span>{{ t('favorite.collectAction') }}</span>
            </div>
          </template>
          <!-- 自定义消息：bidirectional 走系统样式；emoji 渲染为裸图；note 渲染为笔记卡片；
               card/userCard 渲染为名片卡片；groupInviteV1 渲染为邀请卡片；notice 渲染为
               居中灰色系统文案（进群/退群提示）；其余不支持的显示提示 -->
          <template #message-custom="{ message }">
            <BidirectionalMessage
              v-if="isBidirectionalMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <EmojiMessage
              v-else-if="isEmojiMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <NoteMessage
              v-else-if="isNoteMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <CardMessage
              v-else-if="isCardMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <GroupInviteMessage
              v-else-if="isGroupInviteMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <SystemNoticeMessage
              v-else-if="isSystemNoticeMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <UnsupportedCustomTip
              v-else-if="isUnsupportedCustomMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <EmCustomMessage v-else :message="message as UiMessage" />
          </template>
        </EmChatContainer>
      </div>
    </template>

    <!-- H5 端：单栏栈式（列表 → 聊天） -->
    <template v-else>
      <div v-show="!hasCurrentConversation" class="chat-page__mobile-list">
        <EmConversationContainer
          :pull-refresh="DEMO_CONVERSATION_CONFIG.pullRefresh"
          :menu-items="conversationMenuItems"
          :tabs="effectiveConversationTabs"
          :active-tab="effectiveConversationActiveTab"
          :show-status-banner="statusBannerEnabled"
          :unread-mode="conversationUnreadMode"
          :unread-placement="conversationUnreadPlacement"
          :badge-placement="conversationBadgePlacement"
          @conversation-select="onConversationSelect"
          @conversation-click="onConversationSelect"
          @update:active-tab="onConversationActiveTabChange"
        >
          <!-- 创建群组接管：群名改为「群组 + 创建日期时间」，便于区分造数 -->
          <template #create-group="{ show, close }">
            <EmCreateGroupModal :show="show" :create-fn="demoCreateGroup" @update:show="close" />
          </template>
          <template v-if="conversationTabsTakeover" #tabs="{ tabs, activeTab, selectTab }">
            <div class="chat-page__takeover-tabs">
              <button
                v-for="tab in tabs"
                :key="tab"
                type="button"
                class="chat-page__takeover-tab"
                :class="{ 'chat-page__takeover-tab--active': activeTab === tab }"
                @click="selectTab(tab)"
              >
                {{ takeoverTabLabels[tab] || tab }}
              </button>
            </div>
          </template>
        </EmConversationContainer>
      </div>
      <div v-show="hasCurrentConversation" class="chat-page__mobile-chat">
        <div class="chat-page__mobile-header safe-area-top">
          <button type="button" class="chat-page__mobile-back" @click="backToConversationList">
            <EmIcon name="arrow/left" :size="DEMO_ICON_SIZE.back" />
            <span>{{ t('common.back') }}</span>
          </button>
        </div>
        <div class="chat-page__mobile-body">
          <EmChatContainer :config="chatConfig">
            <template #message-text="{ message }">
              <MarkdownStreamMessage :message="message as UiMessage" />
            </template>
            <!-- 右键/长按菜单追加「收藏」（对齐 App message_item.dart 的收藏项） -->
            <template #message-action-extra="{ message }">
              <div :ref="placeCollectItem" class="chat-collect-action" @click="onCollectMessage(message as UiMessage)">
                <EmIcon name="status/star" :size="16" />
                <span>{{ t('favorite.collectAction') }}</span>
              </div>
            </template>
            <template #message-custom="{ message }">
              <BidirectionalMessage
                v-if="isBidirectionalMessage(message as UiMessage)"
                :message="message as UiMessage"
              />
              <EmojiMessage
                v-else-if="isEmojiMessage(message as UiMessage)"
                :message="message as UiMessage"
              />
            <NoteMessage
              v-else-if="isNoteMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <CardMessage
              v-else-if="isCardMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <GroupInviteMessage
              v-else-if="isGroupInviteMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <SystemNoticeMessage
              v-else-if="isSystemNoticeMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <UnsupportedCustomTip
              v-else-if="isUnsupportedCustomMessage(message as UiMessage)"
              :message="message as UiMessage"
            />
            <EmCustomMessage v-else :message="message as UiMessage" />
          </template>
          </EmChatContainer>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);

  /* PC：容器间距对齐 UIKit demo（gap + padding 取 --demo-container-gap），次级色背景凸显容器卡片 */
  &--pc {
    gap: var(--demo-container-gap, 8px);
    padding: var(--demo-container-padding, 8px);
    box-sizing: border-box;
    background: var(--color-bg-secondary);
  }

  &__sidebar {
    flex-shrink: 0;
    /* 未拖拽时按 UIKIT 侧栏基准弹性取值（随窗口伸缩，与 --uikit-sidebar-width 默认一致）；
       拖拽后由 EmResizable 内联宽度覆盖。内部列表容器覆写 token 为 100% 填满拖拽壳（对齐 UIKit 官方 demo） */
    width: clamp(var(--uikit-sidebar-min-width, 240px), 25%, var(--uikit-sidebar-max-width, 480px));
    --uikit-sidebar-width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--demo-component-radius, 8px);
    background: var(--color-bg);
    transition:
      box-shadow 0.2s,
      border-color 0.2s;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  /* 宿主壳退化为纯定位容器（对齐 UIKit demo demo-layout__main--bare）：
     card 档位的卡片壳（细边框 + 圆角 + 底色）由 EmChatContainer variant="card" 自绘，
     此处不再叠边框/圆角/阴影，避免双层卡片；
     push 抽屉挤出时容器变透明壳（chat-container--drawer-push），此处透出外层灰底 */
  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: transparent;

    /* 空状态对齐 Figma：图标 100px / #ccc（EmIcon 尺寸是 svg 属性，CSS 可直接覆盖；
       颜色经 EmEmpty 消费的 --uikit-empty-icon-color 变量下发）；
       EmEmpty 默认 gap 12px 改为设计稿的 8px；内容组垂直中心上移 13.5px（设计稿 top: 50% - 13.5px） */
    :deep(.chat__empty) {
      --uikit-empty-icon-color: var(--color-text-quaternary);
      padding-bottom: 27px;

      .uikit-empty {
        gap: 8px;
      }

      .uikit-empty__icon {
        width: 100px;
        height: 100px;
      }
    }
  }

  &__mobile-list,
  &__mobile-chat {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  &__mobile-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 12px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  &__mobile-back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    font-size: calc(14px * var(--demo-font-scale, 1));
    color: var(--color-text);
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  &__mobile-body {
    flex: 1;
    min-height: 0;
  }

  /* 完全接管 #tabs 插槽：下划线风格 */
  &__takeover-tabs {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
  }

  &__takeover-tab {
    flex-shrink: 0;
    padding: 6px 4px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: calc(14px * var(--demo-font-scale, 1));
    cursor: pointer;
    transition: all 0.15s;

    &--active {
      color: var(--uikit-primary-color, var(--color-primary));
      border-bottom-color: var(--uikit-primary-color, var(--color-primary));
      font-weight: 500;
    }
  }
}
</style>

<!-- 非 scoped：#message-custom 插槽只替换消息内容，外层 wrapper 仍带头像/昵称/气泡。
     用 :has() 命中含本项目锚点类（.unsupported-custom-tip / .bidirectional-tip /
     .system-notice-tip）的消息行，抵消其外壳并居中，外观与 UIKit 系统消息（notice）一致。
     锚点类为本组件独有，不误伤其它消息。 -->
<style lang="scss">
.message-bubble-wrapper:has(.unsupported-custom-tip),
.message-bubble-wrapper:has(.bidirectional-tip),
.message-bubble-wrapper:has(.system-notice-tip) {
  justify-content: center;

  .message-bubble-wrapper__main {
    flex: 0 1 auto;
    flex-direction: row !important;
    justify-content: center;
  }

  .message-bubble-wrapper__avatar,
  .message-bubble-wrapper__nickname,
  .message-bubble-wrapper__status-column,
  .message-bubble-wrapper__time {
    display: none !important;
  }

  .message-bubble-wrapper__content {
    align-items: center;
    max-width: 100%;
  }

  .message-bubble-wrapper__body,
  .message-bubble-wrapper__message-row,
  .message-renderer__slot {
    width: auto;
    align-items: center;
  }
}

/* 右键/长按菜单里追加的「收藏」项：#message-action-extra 插槽内容直接渲染在
   .message-action-menu 容器内（不在 __item 里），故需复刻 .message-action-menu__item 的样式。
   菜单可能 teleport 渲染，样式放在非 scoped 区。 */
.message-action-menu .chat-collect-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: var(--uikit-font-size-13);
  color: var(--uikit-text-primary);
  cursor: pointer;
  border-radius: var(--uikit-item-hover-radius, 8px);
  white-space: nowrap;
  transition: background-color var(--uikit-anim-duration, 0.15s) var(--uikit-anim-easing, ease);

  &:hover {
    background-color: var(--uikit-bg-hover, #f5f5f5);
  }
}
</style>
