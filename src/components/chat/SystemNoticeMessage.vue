<script setup lang="ts">
/**
 * 系统通知消息（event === 'notice'）渲染，对齐 Flutter SystemMsg / MessageSystemRender：
 * - 展示 params.text 的灰色小字，居中、无头像无气泡（外层 wrapper 由 chat/index.vue 的
 *   全局样式抵消）；
 * - params.operator / members 中的昵称渲染为蓝色可点击，点击跳到 UserProfile 页
 *   （对齐 Flutter MessageSystemRender.onTapUser → UserInfoPage.to，删除好友走自有接口）；
 * - 进群/退群/被移出群等提示都走这条链路，不再显示「请使用手机 App 查看」。
 *
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getSystemNoticeView } from '@/utils/systemNoticeMessage'
import { toNumericUserId } from '@/utils/friendUserId'

const props = defineProps<{ message: UiMessage }>()

const router = useRouter()
const notice = computed(() => getSystemNoticeView(props.message))

function openUserCard(chatUserId: string): void {
  if (!chatUserId) return
  let userId: number
  try {
    userId = toNumericUserId(chatUserId)
  } catch {
    return
  }
  router.push({ name: 'ContactUserProfile', params: { userId: String(userId) } })
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
