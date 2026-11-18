/**
 * Demo UIKit 特性开关 - 聊天域
 *
 * 职责：
 * - 持有「聊天」特性面板内聊天输入框、群已读回执、消息列表、消息操作菜单的可配置状态
 * - 由 chat/index.vue 绑定到聊天容器相关 props
 *
 * 设计取舍：
 * - 只做「状态 + 动作」聚合，不持有任何 UI 结构
 * - 模块级单例，保证面板修改能实时作用到页面
 */
import { ref } from 'vue'

function createChatSettings() {
  /* ===== 聊天输入框配置 ===== */
  const chatInputMode = ref<'simple' | 'rich'>('simple')
  const chatInputStyle = ref<'toolbar-top' | 'toolbar-bottom'>('toolbar-top')
  // multiBody 默认关闭：选图/视频/文件后立即发送，不进输入框附件草稿。
  // 背景：UIKit 在 multiBody=true 时，PC 端选图会先转为附件草稿，与文字合并成复合消息发送，
  // 该混排路径存在「丢失文字或图片」问题；关闭后走 UIKit 原生 send-file 即发流程（PC simple + H5 本就即发），
  // 且引用(msgQuote)/@(em_at_list)/离线推送 ext 均会保留。设置面板开关仍可手动打开恢复图文混排。
  // 注意：rich 模式下关闭 multiBody 时图片会内联插入编辑器（UIKit 既定行为），非即发。
  const chatInputFeatures = ref({
    emoji: true,
    image: true,
    file: true,
    voice: true,
    video: true,
    multiBody: false,
    mention: true,
  })
  const chatInputAutoFocus = ref(false)
  const chatInputFocusBorderColor = ref('')
  const chatInputCaretColor = ref('')
  const chatInputSelectionColor = ref('')
  const chatInputMaxLength = ref(0)

  /* ===== 群已读回执配置 ===== */
  /* 因正式 Prod 集群已读回执（已读/未读状态变更）问题，默认关闭；另受 Provider 面板「已读回执」总开关控制 */
  const groupReadReceiptEnabled = ref(false)
  const groupReadReceiptMaxSize = ref(200)

  /* ===== 消息列表配置 ===== */
  const chatPinnedBarVisible = ref(true)
  const chatGroupAnnouncementBarVisible = ref(true)
  const chatShowTime = ref<false | true | 'always' | 'hover'>(false)
  const chatMessageSearchEnabled = ref(false)
  const chatMessageServerSearchEnabled = ref(false)
  const chatMessageListShowAvatar = ref(true)
  /** 是否展示己方消息头像（2.7.0+：设为 false 仅隐藏己方头像，对方头像照常显示） */
  const chatMessageShowSelfAvatar = ref(true)
  const chatMessageStatusShowText = ref(false)
  const chatMessageStatusDirection = ref<'horizontal' | 'vertical'>('horizontal')
  const chatMessageStatusPosition = ref<'below' | 'inline'>('inline')
  const chatMessageStatusStyle = ref<'classic' | 'capsule'>('classic')

  /* ===== 消息操作菜单配置 ===== */
  const chatMessageAction = ref({
    enableQuote: true,
    enableCopy: true,
    enableDownload: true,
    enableDelete: true,
    enableRecall: true,
    enableRecallOther: true,
    enableEdit: true,
    enableForward: true,
    enableMultiSelect: true,
    enableTranslate: true,
    enableVoiceToText: true,
    enablePin: true,
  })

  /** 一键重置聊天相关状态 */
  function resetChatSettings() {
    chatInputMode.value = 'simple'
    chatInputStyle.value = 'toolbar-top'
    chatInputFeatures.value = {
      emoji: true,
      image: true,
      file: true,
      voice: true,
      video: true,
      multiBody: false,
      mention: true,
    }
    chatInputAutoFocus.value = false
    chatInputFocusBorderColor.value = ''
    chatInputCaretColor.value = ''
    chatInputSelectionColor.value = ''
    chatInputMaxLength.value = 0
    groupReadReceiptEnabled.value = false
    groupReadReceiptMaxSize.value = 200
    chatPinnedBarVisible.value = true
    chatGroupAnnouncementBarVisible.value = true
    chatShowTime.value = false
    chatMessageSearchEnabled.value = false
    chatMessageServerSearchEnabled.value = false
    chatMessageListShowAvatar.value = true
    chatMessageShowSelfAvatar.value = true
    chatMessageStatusShowText.value = false
    chatMessageStatusDirection.value = 'horizontal'
    chatMessageStatusPosition.value = 'inline'
    chatMessageStatusStyle.value = 'classic'
    chatMessageAction.value = {
      enableQuote: true,
      enableCopy: true,
      enableDownload: true,
      enableDelete: true,
      enableRecall: true,
      enableRecallOther: true,
      enableEdit: true,
      enableForward: true,
      enableMultiSelect: true,
      enableTranslate: true,
      enableVoiceToText: true,
      enablePin: true,
    }
  }

  return {
    // 聊天输入框
    chatInputMode,
    chatInputStyle,
    chatInputFeatures,
    chatInputAutoFocus,
    chatInputFocusBorderColor,
    chatInputCaretColor,
    chatInputSelectionColor,
    chatInputMaxLength,
    // 群已读回执
    groupReadReceiptEnabled,
    groupReadReceiptMaxSize,
    // 消息列表
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
    // 消息操作菜单
    chatMessageAction,
    // 动作
    resetChatSettings,
  }
}

/**
 * 全局单例访问：设置面板（SettingsChatPanel）与 chat/index.vue 必须共享同一份状态，
 * 否则面板修改无法作用到页面。首次调用创建实例，之后一律复用。
 */
let chatSettings: ReturnType<typeof createChatSettings> | null = null

export function useChatSettings() {
  if (!chatSettings) chatSettings = createChatSettings()
  return chatSettings
}
