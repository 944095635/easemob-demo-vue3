<script setup lang="ts">
/**
 * 不支持的自定义消息提示（系统消息样式）。
 *
 * 通过 EmChatContainer 的 `#message-custom` 插槽接管 custom 类型消息后渲染本组件：
 * - 不展示 body.event / params 原文，避免把内部结构暴露给终端用户；
 * - 外观对齐 UIKit 系统消息（居中、灰色小胶囊、无头像无气泡），CSS 取自
 *   uikit-im theme 的 .message-bubble-wrapper__notice。
 */
import { useI18n } from 'vue-i18n'
import type { UiMessage } from '@easemob-community/uikit-im'

defineProps<{ message: UiMessage }>()

const { t } = useI18n()
</script>

<template>
  <div class="unsupported-custom-tip">{{ t('chat.unsupportedCustomMessage') }}</div>
</template>

<style lang="scss" scoped>
.unsupported-custom-tip {
  align-self: center;
  max-width: 70%;
  margin: 0 auto;
  padding: 2px 8px;
  border-radius: var(--uikit-components-radius, 8px);
  background-color: var(--uikit-message-chip-bg, var(--uikit-bubble-bg-other, #e4e6e7));
  color: var(--uikit-text-secondary, #5e686e);
  font-size: var(--uikit-font-size-11);
  line-height: 16px;
  text-align: center;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
