<script setup lang="ts">
/**
 * 账户资料：完全对齐 App「我的信息」页布局。
 * - 基础设置：头像 / 昵称 / 铁恋ID / 账号 / 二维码
 * - 资料卡：性别 / 地区 / 签名 / 封面
 * 行样式对齐 App SettingsMenuItem：左标签 + 右值 + 右箭头，可编辑行整行点击。
 * 数据源：头像/昵称/签名来自环信 SDK（useOwnUserInfo）；铁恋ID/性别/封面来自自有服务（useCurrentProfile）。
 */
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  EmAvatar,
  EmIcon,
  EmInput,
  EmPopup,
  useOwnUserInfo,
  useToast,
  useUIKit,
  useUserInfoStore,
} from '@easemob-community/uikit-im'

import { uploadAvatar } from '@/api/user'
import { useCurrentProfile } from '@/composables/useUserProfile'
import { useUserStore } from '@/store/modules/user'

import AvatarCropperModal from '../AvatarCropperModal.vue'

defineOptions({ name: 'ProfileDetails' })

const { t } = useI18n()
const { success: showSuccess, error: showError } = useToast()
const userStore = useUserStore()
const profile = useCurrentProfile()
const userInfoStore = useUserInfoStore()
const { client } = useUIKit()
const {
  avatarUrl: sdkAvatarUrl,
  displayName,
  userInfo,
  updateOwnInfo,
  updateOwnInfoByAttribute,
} = useOwnUserInfo()

const userId = computed(
  () => client.value?.currentUserId || userStore.userId || 'supercalifragilisticexpialidocious',
)
const appServerUrl = computed(() => import.meta.env.VITE_APP_SERVER_URL ?? '')

/* ===== 展示字段 ===== */
const nickname = computed(() => displayName.value || t('settings.account.defaultNickname'))
const avatarUrl = computed(() => sdkAvatarUrl.value || '')
/** 签名：SDK 的 sign 为主，自有服务 signature 兜底（两者通常一致） */
const signature = computed(
  () => userInfo.value?.sign || profile.value?.signature || t('settings.account.defaultSignature'),
)
/** 铁恋ID：服务端 chat_id */
const tlId = computed(() => profile.value?.chat_id || '')
/** 账号：登录手机号 */
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

/* ===== 铁恋ID 复制 ===== */
async function copyTlId() {
  if (!tlId.value) return
  try {
    await navigator.clipboard.writeText(tlId.value)
    showSuccess(t('settings.account.copySuccess'))
  } catch {
    showError(t('settings.account.copyFailed'))
  }
}

/* ===== 头像上传（对齐 App _pickAvatar：选图 → 上传 → 同步 IM → 更新缓存） ===== */
const isAvatarModalOpen = ref(false)
const isAvatarSaving = ref(false)

function openAvatarModal() {
  isAvatarModalOpen.value = true
}

function closeAvatarModal() {
  isAvatarModalOpen.value = false
}

async function confirmAvatarUpdate(blob: Blob) {
  if (isAvatarSaving.value) return
  if (userStore.loginMode === 'dev') {
    showError(t('settings.account.devModeAvatarDisabled'))
    return
  }
  isAvatarSaving.value = true
  try {
    if (!appServerUrl.value) {
      showError(t('settings.account.appServerRequired'))
      return
    }
    if (!userStore.accessToken) {
      showError(t('settings.account.avatarUploadFailed'))
      return
    }

    const { avatarUrl: uploadedUrl } = await uploadAvatar(userId.value, blob, userStore.accessToken)
    await updateOwnInfoByAttribute('avatarUrl', uploadedUrl)

    const existing = userInfoStore.getUserInfo(userId.value)
    userInfoStore.setUserInfo({
      userId: userId.value,
      avatarUrl: uploadedUrl,
      nickname: existing?.nickname,
      sign: existing?.sign,
      mail: existing?.mail,
      phone: existing?.phone,
      gender: existing?.gender,
      birth: existing?.birth,
      ext: existing?.ext,
    })

    showSuccess(t('common.saveSuccess'))
    closeAvatarModal()
  } catch (err) {
    console.error('upload avatar failed:', err)
    showError(t('settings.account.avatarUploadFailed'))
  } finally {
    isAvatarSaving.value = false
  }
}

/* ===== 昵称 / 签名编辑弹窗 ===== */
type EditField = 'nickname' | 'signature'

const isEditModalOpen = ref(false)
const editingField = ref<EditField | null>(null)
const editValue = ref('')
const editError = ref('')
const isSaving = ref(false)
const editInputRef = ref<{ inputRef?: HTMLInputElement | null } | null>(null)

const editModalTitle = computed(() => {
  if (editingField.value === 'nickname') return t('settings.account.editNickname')
  if (editingField.value === 'signature') return t('settings.account.editSignature')
  return ''
})

const editPlaceholder = computed(() => {
  if (editingField.value === 'nickname') return t('settings.account.nicknamePlaceholder')
  if (editingField.value === 'signature') return t('settings.account.signaturePlaceholder')
  return ''
})

function openEditModal(field: EditField) {
  editingField.value = field
  editValue.value = field === 'nickname' ? nickname.value : signature.value
  editError.value = ''
  isEditModalOpen.value = true
  nextTick(() => {
    editInputRef.value?.inputRef?.focus()
  })
}

function closeEditModal() {
  isEditModalOpen.value = false
  editingField.value = null
  editValue.value = ''
  editError.value = ''
}

async function confirmEdit() {
  if (!editingField.value || isSaving.value) return
  const trimmed = editValue.value.trim()

  if (editingField.value === 'nickname' && !trimmed) {
    editError.value = t('settings.account.nicknameRequired')
    return
  }

  isSaving.value = true
  try {
    if (editingField.value === 'nickname') {
      await updateOwnInfo({ nickname: trimmed })
    } else {
      await updateOwnInfoByAttribute('sign', trimmed)
    }
    showSuccess(t('common.saveSuccess'))
    closeEditModal()
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.saveFailed'))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="account-info__groups">
    <!-- ===== 基础设置（对齐 App 第一组 CardWidget） ===== -->
    <section class="account-info__group">
      <h3 class="account-info__group-title">{{ t('settings.account.groupBasic') }}</h3>

      <!-- 头像 -->
      <button type="button" class="account-info__row account-info__row--link" @click="openAvatarModal">
        <span class="account-info__label">{{ t('settings.account.avatar') }}</span>
        <span class="account-info__field">
          <EmAvatar
            :size="32"
            :src="avatarUrl"
            :name="nickname"
            shape="circle"
            class="account-info__field-avatar"
          />
          <EmIcon name="chevron/right" :size="16" class="account-info__arrow" />
        </span>
      </button>

      <!-- 昵称 -->
      <button
        type="button"
        class="account-info__row account-info__row--link"
        @click="openEditModal('nickname')"
      >
        <span class="account-info__label">{{ t('settings.account.nickname') }}</span>
        <span class="account-info__field">
          <span class="account-info__field-text">{{ nickname }}</span>
          <EmIcon name="chevron/right" :size="16" class="account-info__arrow" />
        </span>
      </button>

      <!-- 铁恋ID（App 点击可编辑；Web 侧仅支持复制） -->
      <div class="account-info__row">
        <span class="account-info__label">{{ t('settings.account.tlId') }}</span>
        <span class="account-info__field">
          <span class="account-info__field-text">{{ tlId || '—' }}</span>
          <button
            v-if="tlId"
            type="button"
            class="account-info__copy"
            :aria-label="t('settings.account.copyTlId')"
            @click="copyTlId"
          >
            {{ t('settings.account.copy') }}
          </button>
        </span>
      </div>

      <!-- 账号（App showArrow:false，不可点） -->
      <div class="account-info__row">
        <span class="account-info__label">{{ t('settings.account.account') }}</span>
        <span class="account-info__field-text">{{ account || '—' }}</span>
      </div>

      <!-- 二维码（App 点击跳二维码页；Web 无该页，提示用手机 App） -->
      <button
        type="button"
        class="account-info__row account-info__row--link"
        @click="showError(t('common.unsupportedMobileOnly'))"
      >
        <span class="account-info__label">{{ t('settings.account.qrCode') }}</span>
        <span class="account-info__field">
          <EmIcon name="rect_notched/qrcode" :size="20" class="account-info__qr-icon" />
          <EmIcon name="chevron/right" :size="16" class="account-info__arrow" />
        </span>
      </button>
    </section>

    <!-- ===== 资料卡（对齐 App 第二组 CardWidget） ===== -->
    <section class="account-info__group">
      <h3 class="account-info__group-title">{{ t('settings.account.groupProfileCard') }}</h3>

      <!-- 性别 -->
      <div class="account-info__row">
        <span class="account-info__label">{{ t('settings.account.gender') }}</span>
        <span class="account-info__field-text">{{ genderLabel }}</span>
      </div>

      <!-- 地区（App 固定「不支持」、不可点） -->
      <div class="account-info__row">
        <span class="account-info__label">{{ t('settings.account.region') }}</span>
        <span class="account-info__field-text">{{ t('settings.account.regionUnsupported') }}</span>
      </div>

      <!-- 签名 -->
      <button
        type="button"
        class="account-info__row account-info__row--link"
        @click="openEditModal('signature')"
      >
        <span class="account-info__label">{{ t('settings.account.signature') }}</span>
        <span class="account-info__field">
          <span class="account-info__field-text">{{ signature }}</span>
          <EmIcon name="chevron/right" :size="16" class="account-info__arrow" />
        </span>
      </button>

      <!-- 封面 -->
      <div class="account-info__row account-info__row--last">
        <span class="account-info__label">{{ t('settings.account.cover') }}</span>
        <span class="account-info__field">
          <img
            v-if="profileCover"
            class="account-info__cover"
            :src="profileCover"
            :alt="t('settings.account.cover')"
          />
          <span v-else class="account-info__field-text">—</span>
        </span>
      </div>
    </section>

    <!-- ===== 编辑弹窗（昵称 / 签名） ===== -->
    <EmPopup
      v-model:show="isEditModalOpen"
      position="center"
      :close-on-click-overlay="false"
      :close-on-esc="false"
      class="account-info__edit-popup"
    >
      <div class="account-info__edit-modal">
        <div class="account-info__edit-modal-header">
          <span class="account-info__edit-modal-title">{{ editModalTitle }}</span>
        </div>
        <div class="account-info__edit-modal-body">
          <EmInput
            ref="editInputRef"
            v-model="editValue"
            :placeholder="editPlaceholder"
            :error="!!editError"
            :error-message="editError"
            :disabled="isSaving"
            :maxlength="50"
            @submit="confirmEdit"
          />
        </div>
        <div class="account-info__edit-modal-footer">
          <button
            type="button"
            class="account-info__edit-btn account-info__edit-btn--cancel"
            :disabled="isSaving"
            @click="closeEditModal"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="account-info__edit-btn account-info__edit-btn--confirm"
            :disabled="isSaving"
            @click="confirmEdit"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </EmPopup>

    <!-- ===== 头像裁剪弹窗 ===== -->
    <AvatarCropperModal v-model:show="isAvatarModalOpen" @confirm="confirmAvatarUpdate" />
  </div>
</template>

<style lang="scss" scoped>
.account-info {
  &__groups {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 24px;
  }

  /* 分组卡片：对齐 App CardWidget.children（圆角白卡 + 组标题 + 行分割线） */
  &__group {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: var(--color-bg-secondary, transparent);
  }

  &__group-title {
    margin: 0;
    padding: 12px 14px 6px;
    font-size: calc(15px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text);
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

    /* 每组最后一行去分割线 */
    &--last::after {
      display: none;
    }
  }

  /* 整行可点击 */
  &__row--link {
    width: 100%;
    font: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: none;

    &:hover .account-info__field-text,
    &:hover .account-info__arrow,
    &:hover .account-info__qr-icon {
      color: var(--color-primary);
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
    gap: 4px;
    min-width: 0;
  }

  &__field-text {
    max-width: 260px;
    overflow: hidden;
    font-size: calc(14px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text-secondary);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__field-avatar {
    font-size: calc(12px * var(--demo-font-scale, 1));
    font-weight: 500;
  }

  /* 右箭头：对齐 App ForwardIcon（灰色 chevron，尺寸 16） */
  &__arrow {
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  &__qr-icon {
    flex-shrink: 0;
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

  &__edit-popup {
    :deep(.uikit-popup__content) {
      padding: 0;
      border-radius: 12px;
      background: var(--color-bg);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
  }

  &__edit-modal {
    width: 320px;
    padding: 20px;
    box-sizing: border-box;
  }

  &__edit-modal-header {
    margin-bottom: 16px;
  }

  &__edit-modal-title {
    font-size: calc(16px * var(--demo-font-scale, 1));
    font-weight: 600;
    color: var(--color-text);
  }

  &__edit-modal-body {
    margin-bottom: 20px;
  }

  &__edit-modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  &__edit-btn {
    height: 36px;
    padding: 0 16px;
    font-size: calc(14px * var(--demo-font-scale, 1));
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background-color 0.2s,
      opacity 0.2s;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    &--cancel {
      color: var(--color-text);
      background: var(--color-bg-secondary);

      &:hover:not(:disabled) {
        background: var(--color-border);
      }
    }

    &--confirm {
      color: #ffffff;
      background: var(--color-primary);

      &:hover:not(:disabled) {
        background: var(--color-primary-hover, var(--color-primary));
      }
    }
  }
}
</style>
