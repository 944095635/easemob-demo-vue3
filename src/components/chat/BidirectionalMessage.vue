<script setup lang="ts">
/**
 * 双向消息（bidirectional）渲染：对齐 Flutter MessageItem 里的处理——
 * 复用系统消息外观（居中、灰色小胶囊、无头像无气泡），内容取 BidirectionalMsg.description：
 *   我发的 → self；别人发的 → other（showPrefix 时加发送人昵称前缀）。
 *
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed } from 'vue'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getBidirectionalView } from '@/utils/bidirectionalMessage'

const props = defineProps<{ message: UiMessage }>()

const description = computed(() => getBidirectionalView(props.message).description)
</script>

<template>
  <div class="bidirectional-tip">{{ description }}</div>
</template>

<style lang="scss" scoped>
.bidirectional-tip {
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
