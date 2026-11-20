<script setup lang="ts">
/**
 * 发送好友申请页：对齐 Flutter UserRequestsSendPage。
 * 顶部用户信息卡 + 申请理由（≤50 字，默认「我想添加你为好友」）+ 备注信息（≤20 字）
 * + 只读来源，提交走自有服务 POST /api/friend/apply，成功后 toast 并返回上一页。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { EmIcon, useToast } from '@easemob-community/uikit-im'

import { getUserDetail, sendFriendApply, type FriendApplySource } from '@/api/friend'
import { resolveFriendSource } from '@/config/friendSource'
import { DEMO_ICON_SIZE } from '@/config/demo'
import { trackEvent } from '@/utils/analytics'

defineOptions({ name: 'FriendApplyPage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { success: showSuccess, error: showError } = useToast()

const MESSAGE_MAX = 50
const REMARK_MAX = 20

const userId = computed(() => String(route.params.userId || ''))
const numericUserId = computed(() => Number.parseInt(userId.value, 10) || 0)
const nickname = ref(String(route.query.nickname || ''))
const avatar = ref(String(route.query.avatar || ''))
const tlId = ref(String(route.query.tlId || ''))
const message = ref('')
const remark = ref('')
const sending = ref(false)

const source = computed(() => resolveFriendSource(String(route.query.source || '')))
const sourceLabel = computed(() => t(source.value.labelKey))

function avatarFallback(): string {
  return (nickname.value || tlId.value || '?').trim().charAt(0).toUpperCase()
}

onMounted(async () => {
  // query 已带齐展示信息时无需再拉接口，避免无 token 时干扰页面
  if (nickname.value && tlId.value) return
  if (!numericUserId.value) return
  try {
    const detail = await getUserDetail(numericUserId.value)
    if (!detail) return
    nickname.value = detail.nickname || nickname.value
    avatar.value = detail.avatar || avatar.value
    tlId.value = detail.tlId || tlId.value
  } catch {
    // 资料拉取失败不阻塞申请：userId 已知即可发送
  }
})

async function submit() {
  if (sending.value || !numericUserId.value) return
  if (message.value.length > MESSAGE_MAX) {
    showError(`${t('contacts.apply.reason')} ≤ ${MESSAGE_MAX}`)
    return
  }
  if (remark.value.length > REMARK_MAX) {
    showError(`${t('contacts.apply.remark')} ≤ ${REMARK_MAX}`)
    return
  }

  sending.value = true
  try {
    await sendFriendApply({
      toUserId: numericUserId.value,
      message: message.value.trim() || t('contacts.apply.defaultMessage'),
      remark: remark.value.trim(),
      source: source.value.source as FriendApplySource,
    })
    showSuccess(t('contacts.apply.sent'))
    trackEvent('contacts', 'friend-apply')
    goBack()
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error))
  } finally {
    sending.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'ContactSearch' })
}
</script>

<template>
  <div class="friend-apply">
    <header class="friend-apply__header">
      <button type="button" class="friend-apply__back" @click="goBack">
        <EmIcon name="arrow/left" :size="DEMO_ICON_SIZE.back" />
        <span>{{ t('common.back') }}</span>
      </button>
      <span class="friend-apply__title">{{ t('contacts.apply.title') }}</span>
    </header>

    <div class="friend-apply__body">
      <section class="friend-apply__card friend-apply__card--user">
        <img v-if="avatar" class="friend-apply__avatar" :src="avatar" alt="" />
        <span v-else class="friend-apply__avatar friend-apply__avatar--fallback">{{
          avatarFallback()
        }}</span>
        <div class="friend-apply__user-info">
          <span class="friend-apply__name">{{ nickname || userId }}</span>
          <span class="friend-apply__tlid">{{ t('contacts.profile.tlId') }}: {{ tlId || '-' }}</span>
        </div>
      </section>

      <section class="friend-apply__card">
        <label class="friend-apply__label" for="friend-apply-reason">{{
          t('contacts.apply.reason')
        }}</label>
        <textarea
          id="friend-apply-reason"
          v-model="message"
          class="friend-apply__textarea"
          rows="4"
          :maxlength="MESSAGE_MAX"
          :placeholder="t('contacts.apply.reasonPlaceholder')"
        />
        <span class="friend-apply__counter">{{ message.length }}/{{ MESSAGE_MAX }}</span>
      </section>

      <section class="friend-apply__card">
        <label class="friend-apply__label" for="friend-apply-remark">{{
          t('contacts.apply.remark')
        }}</label>
        <input
          id="friend-apply-remark"
          v-model="remark"
          class="friend-apply__input"
          type="text"
          :maxlength="REMARK_MAX"
          :placeholder="t('contacts.apply.remarkPlaceholder')"
        />
        <span class="friend-apply__counter">{{ remark.length }}/{{ REMARK_MAX }}</span>
      </section>

      <section class="friend-apply__card friend-apply__card--source">
        <span class="friend-apply__label">{{ t('contacts.apply.source') }}</span>
        <span class="friend-apply__source">{{ sourceLabel }}</span>
      </section>
    </div>

    <footer class="friend-apply__footer">
      <button
        type="button"
        class="friend-apply__submit"
        :disabled="sending || !numericUserId"
        @click="submit"
      >
        {{ sending ? t('contacts.apply.sending') : t('contacts.apply.send') }}
      </button>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.friend-apply {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--color-bg-secondary, var(--uikit-bg-page, #f5f6f7));

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 16px;
    box-sizing: border-box;
    background: var(--uikit-bg-elevated, #fff);
    border-bottom: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
  }

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: none;
    background: none;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    cursor: pointer;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--uikit-text-primary, #171a1c);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    box-sizing: border-box;
  }

  &__card {
    position: relative;
    margin-bottom: 12px;
    padding: 14px 16px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--uikit-bg-elevated, #fff);

    &--user {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    &--source {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  &__avatar {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--uikit-primary-color-light, #e8f1ff);
      color: var(--uikit-primary-color, #1677ff);
      font-size: 18px;
      font-weight: 500;
    }
  }

  &__user-info {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  &__name {
    overflow: hidden;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tlid {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 13px;
  }

  &__label {
    display: block;
    margin-bottom: 8px;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    font-weight: 500;
  }

  &__textarea,
  &__input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    background: var(--uikit-bg-elevated, #fff);
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    outline: none;
    resize: vertical;

    &:focus {
      border-color: var(--uikit-primary-color, #1677ff);
    }
  }

  &__textarea {
    min-height: 84px;
    padding: 8px 10px;
  }

  &__input {
    height: 40px;
    padding: 0 10px;
  }

  &__counter {
    display: block;
    margin-top: 4px;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 12px;
    text-align: right;
  }

  &__source {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 14px;
  }

  &__footer {
    flex-shrink: 0;
    padding: 12px 16px;
    box-sizing: border-box;
    background: var(--uikit-bg-elevated, #fff);
    border-top: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
  }

  &__submit {
    width: 100%;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: var(--uikit-primary-color, #1677ff);
    color: #fff;
    font-size: 15px;
    cursor: pointer;

    &:disabled {
      background: var(--uikit-color-disabled, #c9d1d6);
      cursor: not-allowed;
    }
  }
}
</style>
