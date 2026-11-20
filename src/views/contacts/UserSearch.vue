<script setup lang="ts">
/**
 * 搜索用户页：对齐 Flutter UserSearchPage。
 * 输入铁恋 ID 或手机号 → POST /api/user/search → 搜索结果三态：
 * 已是好友 / 加好友 / 拒绝被添加；点头像或昵称进入用户资料页，点「加好友」直接进入申请页。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { EmIcon, useContact, useToast } from '@easemob-community/uikit-im'

import { searchUsers, type UserSearchInfo } from '@/api/friend'
import { resolveFriendSource } from '@/config/friendSource'
import { DEMO_ICON_SIZE } from '@/config/demo'
import { trackEvent } from '@/utils/analytics'

defineOptions({ name: 'ContactSearchPage' })

const { t } = useI18n()
const router = useRouter()
const { error: showError } = useToast()
const { contactList } = useContact()

/** 与 App 一致：关键词至少 2 个字符，1 秒内不重复搜索 */
const SEARCH_MIN_LENGTH = 2
const SEARCH_INTERVAL_MS = 1000

const keyword = ref('')
const users = ref<UserSearchInfo[]>([])
const loading = ref(false)
const searched = ref(false)
const sentIds = ref<Set<number>>(new Set())
let lastSearchAt = 0

const friendIds = computed(() => new Set(contactList.value.map((contact) => contact.userId)))

function avatarFallback(user: UserSearchInfo): string {
  return (user.nickname || user.tlId || '?').trim().charAt(0).toUpperCase()
}

function sourceLabel(user: UserSearchInfo): string {
  const source = resolveFriendSource(user.source)
  return source.value === 'unknown' ? '' : t(source.labelKey)
}

function isFriend(user: UserSearchInfo): boolean {
  return user.isFriend || friendIds.value.has(String(user.userId))
}

function isSent(user: UserSearchInfo): boolean {
  return sentIds.value.has(user.userId)
}

function routeQuery(user: UserSearchInfo) {
  return {
    nickname: user.nickname,
    avatar: user.avatar,
    tlId: user.tlId,
    source: user.source,
  }
}

function openProfile(user: UserSearchInfo) {
  router.push({
    name: 'ContactUserProfile',
    params: { userId: String(user.userId) },
    query: routeQuery(user),
  })
}

function openApply(user: UserSearchInfo) {
  if (isFriend(user) || !user.canAdd || isSent(user)) return
  router.push({
    name: 'FriendApply',
    params: { userId: String(user.userId) },
    query: routeQuery(user),
  })
}

async function doSearch() {
  const target = keyword.value.trim()
  if (!target || target.length < SEARCH_MIN_LENGTH || loading.value) return
  const now = Date.now()
  if (now - lastSearchAt < SEARCH_INTERVAL_MS) return
  lastSearchAt = now

  loading.value = true
  searched.value = true
  users.value = []
  try {
    users.value = await searchUsers(target)
    trackEvent('contacts', 'search-user')
  } catch (error) {
    showError(`${t('contacts.search.failed')}：${error instanceof Error ? error.message : ''}`)
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/contacts')
}
</script>

<template>
  <div class="user-search">
    <header class="user-search__header">
      <button type="button" class="user-search__back" @click="goBack">
        <EmIcon name="arrow/left" :size="DEMO_ICON_SIZE.back" />
        <span>{{ t('common.back') }}</span>
      </button>
      <span class="user-search__title">{{ t('contacts.search.title') }}</span>
    </header>

    <div class="user-search__body">
      <div class="user-search__searchbar">
        <input
          v-model="keyword"
          class="user-search__input"
          type="search"
          :placeholder="t('contacts.search.placeholder')"
          @keyup.enter="doSearch"
        />
        <button
          type="button"
          class="user-search__search-btn"
          :disabled="loading || keyword.trim().length < SEARCH_MIN_LENGTH"
          @click="doSearch"
        >
          {{ loading ? t('contacts.search.searching') : t('contacts.search.button') }}
        </button>
      </div>

      <p class="user-search__hint">{{ t('contacts.search.hint') }}</p>

      <div v-if="loading" class="user-search__state">{{ t('contacts.search.searching') }}</div>
      <div v-else-if="searched && !users.length" class="user-search__state">
        {{ t('contacts.search.empty') }}
      </div>

      <ul v-else class="user-search__list">
        <li v-for="user in users" :key="user.userId" class="user-search__item">
          <button type="button" class="user-search__avatar-btn" @click="openProfile(user)">
            <img v-if="user.avatar" class="user-search__avatar" :src="user.avatar" alt="" />
            <span v-else class="user-search__avatar user-search__avatar--fallback">{{
              avatarFallback(user)
            }}</span>
          </button>

          <button type="button" class="user-search__info" @click="openProfile(user)">
            <span class="user-search__name">{{ user.nickname || user.tlId }}</span>
            <span v-if="sourceLabel(user)" class="user-search__tag">{{ sourceLabel(user) }}</span>
          </button>

          <span v-if="isFriend(user)" class="user-search__status">
            {{ t('contacts.search.friend') }}
          </span>
          <span v-else-if="isSent(user)" class="user-search__status">
            {{ t('contacts.search.sent') }}
          </span>
          <span v-else-if="!user.canAdd" class="user-search__status">
            {{ t('contacts.search.cannotAdd') }}
          </span>
          <button v-else type="button" class="user-search__add" @click="openApply(user)">
            {{ t('contacts.search.add') }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user-search {
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

  &__searchbar {
    display: flex;
    gap: 8px;
  }

  &__input {
    flex: 1;
    min-width: 0;
    height: 40px;
    padding: 0 12px;
    box-sizing: border-box;
    border: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    background: var(--uikit-bg-elevated, #fff);
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    outline: none;

    &:focus {
      border-color: var(--uikit-primary-color, #1677ff);
    }
  }

  &__search-btn {
    flex-shrink: 0;
    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 8px;
    background: var(--uikit-primary-color, #1677ff);
    color: #fff;
    font-size: 14px;
    cursor: pointer;

    &:disabled {
      background: var(--uikit-color-disabled, #c9d1d6);
      cursor: not-allowed;
    }
  }

  &__hint,
  &__state {
    margin: 12px 0;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 13px;
    text-align: center;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--uikit-bg-elevated, #fff);
  }

  &__avatar-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 50%;
    overflow: hidden;
    background: none;
    cursor: pointer;
  }

  &__avatar {
    width: 44px;
    height: 44px;
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

  &__info {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  &__name {
    max-width: 100%;
    overflow: hidden;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tag {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--uikit-primary-color-light, #e8f1ff);
    color: var(--uikit-primary-color, #1677ff);
    font-size: 11px;
  }

  &__status {
    flex-shrink: 0;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 12px;
  }

  &__add {
    flex-shrink: 0;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--uikit-primary-color, #1677ff);
    border-radius: 6px;
    background: transparent;
    color: var(--uikit-primary-color, #1677ff);
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background: var(--uikit-primary-color-light, #e8f1ff);
    }
  }
}
</style>
