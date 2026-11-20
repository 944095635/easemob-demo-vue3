<script setup lang="ts">
/**
 * 账户资料展示：对齐 App「我的信息」页字段。
 * - App 已有但本页缺失的字段：铁恋ID / 账号 / 性别 / 地区 / 封面
 * - 头像、昵称、签名由现有 AvatarSection / ProfileEditor 渲染，此处不重复
 * - 数据来源：启动时拉取并缓存的自有服务端个人资料（useCurrentProfile）+ userStore（手机号）
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@easemob-community/uikit-im'

import { useCurrentProfile } from '@/composables/useUserProfile'
import { useUserStore } from '@/store/modules/user'

defineOptions({ name: 'ProfileDetails' })

const { t } = useI18n()
const { success: showSuccess, error: showError } = useToast()
const profile = useCurrentProfile()
const userStore = useUserStore()

/** 铁恋ID：服务端 chat_id */
const tlId = computed(() => profile.value?.chat_id || '')
/** 账号：登录手机号（Flutter 中来自登录结果，不在 user/profile 接口内） */
const account = computed(() => userStore.phoneNumber || profile.value?.mobile || '')

/** 性别：0 未知 / 1 男 / 2 女（对齐 Flutter Gender 枚举） */
const genderLabel = computed(() => {
  const value = profile.value?.gender
  if (value === 1) return t('settings.account.genderMale')
  if (value === 2) return t('settings.account.genderFemale')
  return t('settings.account.genderUnknown')
})

/** 资料卡封面图（OSS 防盗链由全局 <img src> 重写链路处理） */
const profileCover = computed(() => profile.value?.profile_cover || '')

async function copyTlId() {
  if (!tlId.value) return
  try {
    await navigator.clipboard.writeText(tlId.value)
    showSuccess(t('settings.account.copySuccess'))
  } catch {
    showError(t('settings.account.copyFailed'))
  }
}
</script>

<template>
  <div class="profile-details">
    <div class="profile-details__group">
      <span class="profile-details__group-title">{{ t('settings.account.groupBasic') }}</span>
      <div class="profile-details__row">
        <span class="profile-details__label">{{ t('settings.account.tlId') }}</span>
        <div class="profile-details__field">
          <span class="profile-details__value">{{ tlId || '—' }}</span>
          <button
            v-if="tlId"
            type="button"
            class="profile-details__copy"
            :aria-label="t('settings.account.copyTlId')"
            @click="copyTlId"
          >
            {{ t('settings.account.copy') }}
          </button>
        </div>
      </div>
      <div class="profile-details__row">
        <span class="profile-details__label">{{ t('settings.account.account') }}</span>
        <span class="profile-details__value">{{ account || '—' }}</span>
      </div>
    </div>

    <div class="profile-details__group">
      <span class="profile-details__group-title">{{ t('settings.account.groupProfileCard') }}</span>
      <div class="profile-details__row">
        <span class="profile-details__label">{{ t('settings.account.gender') }}</span>
        <span class="profile-details__value">{{ genderLabel }}</span>
      </div>
      <div class="profile-details__row">
        <span class="profile-details__label">{{ t('settings.account.region') }}</span>
        <span class="profile-details__value">{{ t('settings.account.regionUnsupported') }}</span>
      </div>
      <div class="profile-details__row">
        <span class="profile-details__label">{{ t('settings.account.cover') }}</span>
        <div class="profile-details__field">
          <img
            v-if="profileCover"
            class="profile-details__cover"
            :src="profileCover"
            :alt="t('settings.account.cover')"
          />
          <span v-else class="profile-details__value">—</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-details {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 24px;

  &__group {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg-secondary, transparent);
  }

  &__group-title {
    padding: 10px 14px;
    font-size: calc(12px * var(--demo-font-scale, 1));
    color: var(--color-text-secondary);
  }

  &__row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 54px;
    padding: 0 12px 0 14px;

    &::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: 0;
      left: 14px;
      height: 1px;
      background: var(--color-border);
    }

    &:last-child::after {
      display: none;
    }
  }

  &__label {
    font-size: calc(14px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text);
  }

  &__field {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__value {
    font-size: calc(14px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  &__copy {
    padding: 2px 8px;
    font-size: calc(12px * var(--demo-font-scale, 1));
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-primary);
    border-radius: 999px;
    cursor: pointer;

    &:hover {
      opacity: 0.8;
    }
  }

  &__cover {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }
}
</style>
