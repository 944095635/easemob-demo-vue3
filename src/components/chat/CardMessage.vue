<script setup lang="ts">
/**
 * 名片消息（event === 'card' / 'userCard'）渲染，对齐 Flutter MessageCardRender：
 * - 卡片内容：32px 圆形头像 + 显示名（单行省略、w500）+ 分割线 + 灰色「名片」角标；
 * - maxWidth 220，padding 10px 14px、圆角 12（与 NoteMessage 卡片一致）；
 * - 点击整张卡片跳转 UserProfile 页（对齐 Flutter UserInfoPage.toByUserId(card.userId, .card)），
 *   在该页完成查看资料 / 加好友 / 删除好友，删除统一走自有服务接口；
 * - userId <= 0 时点击提示「名片已过期」（对齐 Flutter chat_page.dart 的 toast）。
 *
 * Flutter 会在渲染时用 ProfileService.getProfile 异步刷新显示名/VIP/备注，但 params 已
 * 自包含 uid/name/avatar，Web 端直接展示 params 内容；VIP 与备注信息 params 不携带，
 * 由点击后的 UserProfile 页展示完整资料。
 *
 * 头像的 OSS/CDN 防盗链由全局 <img src> 改写走 /oss-cdn 代理（src/utils/avatarSrcRewrite.ts）。
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getCardView } from '@/utils/cardMessage'

const props = defineProps<{ message: UiMessage }>()
const { t } = useI18n()
const router = useRouter()
const { show: showToast } = useToast()

const card = computed(() => getCardView(props.message))

/** 首字占位：头像缺失时避免空 src 请求当前页面 */
const avatarFallback = computed(() => (card.value.name || '?').trim().charAt(0).toUpperCase())

function openCard(): void {
  if (card.value.expired) {
    showToast(t('chat.cardExpired'))
    return
  }
  router.push({
    name: 'ContactUserProfile',
    params: { userId: String(card.value.userId) },
    query: {
      nickname: card.value.name,
      avatar: card.value.avatar,
      source: 'card',
    },
  })
}
</script>

<template>
  <div class="card-message" @click="openCard">
    <div class="card-message__row">
      <img v-if="card.avatar" class="card-message__avatar" :src="card.avatar" alt="" />
      <div v-else class="card-message__avatar card-message__avatar--fallback">
        {{ avatarFallback }}
      </div>
      <div class="card-message__name" :title="card.name">{{ card.name || t('chat.cardLabel') }}</div>
    </div>
    <div class="card-message__divider"></div>
    <div class="card-message__label">{{ t('chat.cardLabel') }}</div>
  </div>
</template>

<style lang="scss" scoped>
.card-message {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  max-width: 220px;
  box-sizing: border-box;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--uikit-components-radius, 12px);
  background-color: var(--uikit-bubble-bg-other, #e4e6e7);
  color: var(--uikit-bubble-text-other, #171a1c);
  cursor: pointer;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--uikit-color-primary-light, #c9d1d6);
      color: var(--uikit-text-secondary, #5e686e);
      font-size: 14px;
      font-weight: 500;
    }
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
    color: var(--uikit-text-primary, #171a1c);
  }

  &__divider {
    height: 1px;
    background-color: var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
  }

  &__label {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: var(--uikit-font-size-13);
  }
}
</style>
