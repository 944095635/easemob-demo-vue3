<script setup lang="ts">
/**
 * 群邀请消息卡片（event === 'groupInviteV1'），对齐 Flutter MessageGroupInviteRender。
 *
 * 卡片：左侧两行文字（"邀请你加入群聊" + "邀请你加入群聊《群名》"）+ 右侧 44px 圆角群头像；
 *       maxWidth 220、padding 10px 14px、圆角 12（与名片卡片一致）。
 * 点击 → 打开群邀请详情弹窗：60px 群头像 + 群名 + "{邀请人} 邀请你加入群聊" + 群人数 +
 *       拒绝/同意按钮，调用自有服务 POST /api/group-invite/handle（对齐 Flutter
 *       GroupInvitePage._onTapHandle）；成功后按钮消失（对齐 Flutter 的 handled 状态）。
 *
 * params（均为字符串）：groupName / groupAvatar / memberCount / inviteId / inviterNickname。
 * 头像 OSS/CDN 防盗链由全局 <img src> 改写走 /oss-cdn 代理（avatarSrcRewrite.ts）。
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EmPopup, useToast } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { handleGroupInvite } from '@/api/groupInvite'
import { getGroupInviteView } from '@/utils/groupInviteMessage'

const props = defineProps<{ message: UiMessage }>()
const { t } = useI18n()
const { show: showToast, error: showError } = useToast()

const invite = computed(() => getGroupInviteView(props.message))
const detailVisible = ref(false)
const handled = ref(false)
const isSubmitting = ref(false)

/** 群头像首字占位：头像缺失时避免空 src 请求当前页面 */
const avatarFallback = computed(() => (invite.value.groupName || '群').trim().charAt(0))

function openDetail(): void {
  if (invite.value.expired) {
    showToast(t('chat.groupInvite.expired'))
    return
  }
  detailVisible.value = true
}

async function onHandle(action: 'accept' | 'reject'): Promise<void> {
  if (isSubmitting.value || handled.value) return
  if (invite.value.expired) {
    showToast(t('chat.groupInvite.expired'))
    return
  }
  isSubmitting.value = true
  try {
    await handleGroupInvite(invite.value.inviteId, action)
    handled.value = true
    showToast(
      action === 'accept' ? t('chat.groupInvite.accepted') : t('chat.groupInvite.rejected'),
    )
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.saveFailed'))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="group-invite-message" @click="openDetail">
    <div class="group-invite-message__row">
      <div class="group-invite-message__text">
        <div class="group-invite-message__title">{{ t('chat.groupInvite.title') }}</div>
        <div class="group-invite-message__subtitle" :title="invite.groupName">
          {{ t('chat.groupInvite.title') }}《{{ invite.groupName }}》
        </div>
      </div>
      <img
        v-if="invite.groupAvatar"
        class="group-invite-message__avatar"
        :src="invite.groupAvatar"
        alt=""
      />
      <div v-else class="group-invite-message__avatar group-invite-message__avatar--fallback">
        {{ avatarFallback }}
      </div>
    </div>

    <!-- 群邀请详情弹窗（对齐 Flutter GroupInvitePage） -->
    <EmPopup
      v-model:show="detailVisible"
      position="center"
      :close-on-click-overlay="true"
      class="group-invite-detail"
    >
      <div class="group-invite-detail__card">
        <img
          v-if="invite.groupAvatar"
          class="group-invite-detail__avatar"
          :src="invite.groupAvatar"
          alt=""
        />
        <div v-else class="group-invite-detail__avatar group-invite-detail__avatar--fallback">
          {{ avatarFallback }}
        </div>

        <div class="group-invite-detail__name" :title="invite.groupName">
          {{ invite.groupName }}
        </div>
        <div class="group-invite-detail__desc">
          <template v-if="invite.inviterNickname">
            {{ invite.inviterNickname }} {{ t('chat.groupInvite.inviteWithName') }}
          </template>
          <template v-else>
            {{ t('chat.groupInvite.title') }}
          </template>
        </div>
        <div v-if="invite.memberCount" class="group-invite-detail__members">
          {{ invite.memberCount }}{{ t('chat.groupInvite.members') }}
        </div>

        <div v-if="!handled" class="group-invite-detail__actions">
          <button
            type="button"
            class="group-invite-detail__btn group-invite-detail__btn--reject"
            :disabled="isSubmitting"
            @click.stop="onHandle('reject')"
          >
            {{ t('chat.groupInvite.reject') }}
          </button>
          <button
            type="button"
            class="group-invite-detail__btn group-invite-detail__btn--accept"
            :disabled="isSubmitting"
            @click.stop="onHandle('accept')"
          >
            {{ t('chat.groupInvite.accept') }}
          </button>
        </div>
        <div v-else class="group-invite-detail__handled">
          {{ t('chat.groupInvite.title') }}
        </div>
      </div>
    </EmPopup>
  </div>
</template>

<style lang="scss" scoped>
.group-invite-message {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  max-width: 220px;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: var(--uikit-components-radius, 12px);
  background-color: var(--uikit-bubble-bg-other, #e4e6e7);
  color: var(--uikit-bubble-text-other, #171a1c);
  cursor: pointer;

  &__row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-weight: 500;
    font-size: var(--uikit-font-size-14, 14px);
    color: var(--uikit-text-primary, #171a1c);
  }

  &__subtitle {
    overflow: hidden;
    font-size: var(--uikit-font-size-13, 13px);
    color: var(--uikit-text-secondary, #5e686e);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__avatar {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--uikit-color-primary-light, #c9d1d6);
      color: var(--uikit-text-secondary, #5e686e);
      font-size: 18px;
      font-weight: 500;
    }
  }
}

/* 详情弹窗样式（非 scoped 由父级透传，这里 scoped 仅作用于本组件渲染的节点） */
.group-invite-detail {
  :deep(.uikit-popup__content) {
    padding: 0;
    border-radius: 16px;
    background: var(--color-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 280px;
    padding: 24px 20px 20px;
    box-sizing: border-box;
  }

  &__avatar {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--uikit-color-primary-light, #c9d1d6);
      color: var(--uikit-text-secondary, #5e686e);
      font-size: 24px;
      font-weight: 500;
    }
  }

  &__name {
    margin-top: 12px;
    max-width: 100%;
    overflow: hidden;
    font-size: calc(18px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    margin-top: 8px;
    font-size: calc(13px * var(--demo-font-scale, 1));
    color: var(--color-text-secondary);
    text-align: center;
  }

  &__members {
    margin-top: 4px;
    font-size: calc(12px * var(--demo-font-scale, 1));
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    gap: 12px;
    width: 100%;
    margin-top: 24px;
  }

  &__btn {
    flex: 1;
    height: 40px;
    font-size: calc(14px * var(--demo-font-scale, 1));
    font-weight: 500;
    border: none;
    border-radius: 999px;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    &--reject {
      color: var(--color-text);
      background: var(--color-bg-secondary);

      &:hover:not(:disabled) {
        background: var(--color-border);
      }
    }

    &--accept {
      color: #ffffff;
      background: var(--color-primary);

      &:hover:not(:disabled) {
        background: var(--color-primary-hover, var(--color-primary));
      }
    }
  }

  &__handled {
    margin-top: 24px;
    font-size: calc(13px * var(--demo-font-scale, 1));
    color: var(--color-text-secondary);
  }
}
</style>
