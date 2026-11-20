<script setup lang="ts">
/**
 * 系统通知消息（event === 'notice'）渲染，对齐 Flutter SystemMsg / MessageSystemRender：
 * - 展示 params.text 的灰色小字，居中、无头像无气泡（外层 wrapper 由 chat/index.vue 的
 *   全局样式抵消）；
 * - params.operator / members 中的昵称渲染为蓝色可点击，点击打开 UIKit 用户名片
 *   （对齐 Flutter MessageSystemRender.onTapUser → UserInfoPage.to）；
 * - 进群/退群/被移出群等提示都走这条链路，不再显示「请使用手机 App 查看」。
 *
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed, ref } from 'vue'
import { EmUserCardModal } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getSystemNoticeView } from '@/utils/systemNoticeMessage'

const props = defineProps<{ message: UiMessage }>()

const notice = computed(() => getSystemNoticeView(props.message))
const cardVisible = ref(false)
const selectedUserId = ref('')

function openUserCard(chatUserId: string): void {
  if (!chatUserId) return
  selectedUserId.value = chatUserId
  cardVisible.value = true
}
</script>

<template>
  <div class="system-notice-tip">
    <template v-for="(segment, index) in notice.segments" :key="index">
      <span
        v-if="segment.chatUserId"
        class="system-notice-tip__user"
        @click.stop="openUserCard(segment.chatUserId)"
        >{{ segment.text }}</span
      >
      <template v-else>{{ segment.text }}</template>
    </template>

    <EmUserCardModal
      :show="cardVisible"
      :user-id="selectedUserId"
      @update:show="cardVisible = $event"
    />
  </div>
</template>

<style lang="scss" scoped>
.system-notice-tip {
  align-self: center;
  max-width: 260px;
  margin: 0 auto;
  color: var(--uikit-text-secondary, #808080);
  font-size: 12.5px;
  line-height: 18px;
  text-align: center;
  white-space: pre-wrap;
  word-break: break-word;

  &__user {
    color: var(--uikit-primary-color, #1677ff);
    font-weight: 500;
    cursor: pointer;
  }
}
</style>
