<script setup lang="ts">
/**
 * 用户资料页：对齐 Flutter UserInfoPage 的资料展示与主按钮。
 * 搜索结果 / 群成员 / 名片等入口都可带 query（nickname/avatar/tlId/source）跳入，
 * 打开后调用 GET /api/user/{id} 拉取完整资料；接口失败时用 query 兜底，仍可发起好友申请。
 */
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  CONVERSATION_TYPE,
  EmIcon,
  useContact,
  useConversation,
  useToast,
  useUIKit,
} from '@easemob-community/uikit-im'

import { getUserDetail, type UserDetail } from '@/api/friend'
import { resolveFriendSource } from '@/config/friendSource'
import { DEMO_ICON_SIZE } from '@/config/demo'
import { useUserStore } from '@/store/modules/user'
import { trackEvent } from '@/utils/analytics'

defineOptions({ name: 'ContactUserProfilePage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { error: showError, success: showSuccess } = useToast()
const { stores } = useUIKit()
const { selectConversation } = useConversation()
const { contactList } = useContact()

const userId = computed(() => String(route.params.userId || ''))
const numericUserId = computed(() => Number.parseInt(userId.value, 10) || 0)
const querySource = computed(() => String(route.query.source || ''))
const queryNickname = computed(() => String(route.query.nickname || ''))
const queryAvatar = computed(() => String(route.query.avatar || ''))
const queryTlId = computed(() => String(route.query.tlId || ''))

const detail = ref<UserDetail | null>(null)
const loading = ref(false)

const displayName = computed(
  () => detail.value?.friendRemark || detail.value?.nickname || queryNickname.value || userId.value,
)
const avatar = computed(() => detail.value?.avatar || queryAvatar.value)
const tlId = computed(() => detail.value?.tlId || queryTlId.value)
const genderLabel = computed(() => {
  const gender = detail.value?.gender
  if (gender === 1) return t('contacts.profile.genderMale')
  if (gender === 2) return t('contacts.profile.genderFemale')
  return t('contacts.profile.genderUnknown')
})
const isSelf = computed(
  () => detail.value?.isSelf || userId.value === (stores.client.currentUser || userStore.userId),
)
const isFriend = computed(
  () =>
    detail.value?.isFriend === true ||
    (detail.value?.isFriend === null &&
      contactList.value.some((contact) => contact.userId === userId.value)),
)
const isBlocked = computed(() => detail.value?.isBlocked === true)
const source = computed(() => resolveFriendSource(querySource.value))

function avatarFallback(): string {
  return (displayName.value || '?').trim().charAt(0).toUpperCase()
}

/** 服务端返回秒级时间戳（兼容毫秒），对齐 App TimeUtils.formatDateDisplay */
function formatTime(value?: number): string {
  if (!value) return ''
  const ms = value > 1_000_000_000_000 ? value : value * 1000
  return dayjs(ms).format('YYYY-MM-DD')
}

async function load() {
  if (!numericUserId.value) return
  loading.value = true
  try {
    detail.value = await getUserDetail(
      numericUserId.value,
      String(route.query.groupId || '') || undefined,
    )
  } catch (error) {
    showError(`${t('contacts.profile.loadFailed')}：${error instanceof Error ? error.message : ''}`)
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function copyTlId() {
  if (!tlId.value) return
  try {
    await navigator.clipboard.writeText(tlId.value)
    showSuccess(t('contacts.profile.copySuccess'))
  } catch {
    showError(t('contacts.profile.copyFailed'))
  }
}

function openApply() {
  router.push({
    name: 'FriendApply',
    params: { userId: userId.value },
    query: {
      nickname: displayName.value,
      avatar: avatar.value,
      tlId: tlId.value,
      source: source.value.source,
    },
  })
}

function sendMessage() {
  const id = userId.value
  if (!stores.conversation.conversationList.find((item) => item.id === id)) {
    stores.conversation.addConversation({
      id,
      name: displayName.value,
      avatar: avatar.value,
      type: CONVERSATION_TYPE.SINGLECHAT,
      unreadCount: 0,
      lastMessageText: '',
      isPinned: false,
      isMuted: false,
      marks: [],
    })
  }
  selectConversation(id)
  router.push('/chat')
  trackEvent('contacts', 'profile-message')
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/contacts/search')
}
</script>

<template>
  <div class="user-profile">
    <header class="user-profile__header">
      <button type="button" class="user-profile__back" @click="goBack">
        <EmIcon name="arrow/left" :size="DEMO_ICON_SIZE.back" />
        <span>{{ t('common.back') }}</span>
      </button>
      <span class="user-profile__title">{{ t('contacts.profile.title') }}</span>
    </header>

    <div class="user-profile__body">
      <section class="user-profile__card user-profile__card--hero">
        <img v-if="avatar" class="user-profile__avatar" :src="avatar" alt="" />
        <span v-else class="user-profile__avatar user-profile__avatar--fallback">{{
          avatarFallback()
        }}</span>
        <div class="user-profile__hero-info">
          <div class="user-profile__name-row">
            <span class="user-profile__name">{{ displayName }}</span>
            <span v-if="detail?.vip" class="user-profile__vip">{{ t('contacts.profile.vip') }}</span>
          </div>
          <button type="button" class="user-profile__tlid" @click="copyTlId">
            {{ t('contacts.profile.tlId') }}: {{ tlId || '-' }}
          </button>
        </div>
      </section>

      <section class="user-profile__card">
        <div class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.signature') }}</span>
          <span class="user-profile__value">{{
            detail?.signature || t('contacts.profile.signatureEmpty')
          }}</span>
        </div>
        <div class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.gender') }}</span>
          <span class="user-profile__value">{{ genderLabel }}</span>
        </div>
        <div class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.commonFriends') }}</span>
          <span class="user-profile__value">{{
            detail?.commonFriendCount ? detail.commonFriendCount : t('contacts.profile.none')
          }}</span>
        </div>
        <div class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.commonGroups') }}</span>
          <span class="user-profile__value">{{
            detail?.commonGroupCount ? detail.commonGroupCount : t('contacts.profile.none')
          }}</span>
        </div>
        <div v-if="detail?.isFriend && detail?.friendAddedAt" class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.friendSince') }}</span>
          <span class="user-profile__value">{{ formatTime(detail?.friendAddedAt) }}</span>
        </div>
        <div v-if="detail?.groupJoin?.joinedAt" class="user-profile__row">
          <span class="user-profile__label">{{ t('contacts.profile.groupJoin') }}</span>
          <span class="user-profile__value">
            {{ formatTime(detail.groupJoin.joinedAt) }}
            {{ detail.groupJoin.source === 'qrcode' ? t('contacts.profile.groupJoinQrcode') : '' }}
          </span>
        </div>
      </section>

      <p v-if="loading" class="user-profile__state">{{ t('contacts.search.searching') }}</p>
    </div>

    <footer class="user-profile__footer">
      <button v-if="isSelf" type="button" class="user-profile__primary" disabled>
        {{ t('contacts.profile.self') }}
      </button>
      <button v-else-if="isBlocked" type="button" class="user-profile__primary" disabled>
        {{ t('contacts.profile.blocked') }}
      </button>
      <button v-else-if="isFriend" type="button" class="user-profile__primary" @click="sendMessage">
        {{ t('contacts.profile.sendMessage') }}
      </button>
      <button v-else type="button" class="user-profile__primary" @click="openApply">
        {{ t('contacts.profile.addFriend') }}
      </button>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.user-profile {
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
    margin-bottom: 12px;
    padding: 16px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--uikit-bg-elevated, #fff);

    &--hero {
      display: flex;
      align-items: center;
      gap: 14px;
    }
  }

  &__avatar {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--uikit-primary-color-light, #e8f1ff);
      color: var(--uikit-primary-color, #1677ff);
      font-size: 26px;
      font-weight: 500;
    }
  }

  &__hero-info {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
  }

  &__name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__name {
    overflow: hidden;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__vip {
    padding: 1px 6px;
    border-radius: 4px;
    background: #fff3d6;
    color: #b8860b;
    font-size: 11px;
  }

  &__tlid {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 13px;
    cursor: pointer;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    border-bottom: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.06));

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    flex-shrink: 0;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 14px;
  }

  &__value {
    min-width: 0;
    overflow: hidden;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 13px;
    text-align: center;
  }

  &__footer {
    flex-shrink: 0;
    padding: 12px 16px;
    box-sizing: border-box;
    background: var(--uikit-bg-elevated, #fff);
    border-top: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
  }

  &__primary {
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
