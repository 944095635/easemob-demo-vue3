<script setup lang="ts">
/**
 * 好友申请列表（新朋友）：对齐 Flutter UserRequestsPage / UserRequestsItem。
 *
 * 完全替换 UIKit 的 EmContactNoticeList + inviteList（SDK 事件数据），
 * 列表数据全部来自自有服务 GET /api/friend/requests，见 useFriendRequests。
 *
 * 列表项：头像（点击进入资料页）+ 昵称(备注) + 相对时间 + 验证消息（2 行）
 * + 来源标签「来自⌜扫码⌟」+ 同意/忽略 或 已同意/已忽略状态文案；
 * 长按/删除按钮 → 删除记录确认；右上角一键清空 → 清空确认。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { EmIcon, EmModal } from '@easemob-community/uikit-im'

import {
  useFriendRequests,
} from '@/composables/useFriendRequests'
import type { FriendRequest } from '@/api/friend'
import { resolveFriendSource } from '@/config/friendSource'
import { formatRelativeTime } from '@/utils/friendRequestTime'
import { trackEvent } from '@/utils/analytics'

defineOptions({ name: 'FriendRequestList' })

const { t } = useI18n()
const router = useRouter()
const {
  list,
  loading,
  loadingMore,
  error,
  total,
  hasMore,
  isEmpty,
  load,
  loadMore,
  handle,
  remove,
  clearAll,
} = useFriendRequests()

const deleteTarget = ref<FriendRequest | null>(null)
const deleteModalVisible = computed({
  get: () => deleteTarget.value !== null,
  set: (value: boolean) => {
    if (!value) deleteTarget.value = null
  },
})
const clearModalVisible = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'contacts.requests.statusPending',
  accepted: 'contacts.requests.statusAccepted',
  rejected: 'contacts.requests.statusRejected',
  restricted: 'contacts.requests.statusRestricted',
  unknown: 'contacts.requests.statusUnknown',
}

function statusLabel(status: string): string {
  return t(STATUS_LABEL_KEY[status] ?? 'contacts.requests.statusUnknown')
}

function sourceLabel(source: string): string {
  return t(resolveFriendSource(source).labelKey)
}

function timeLabel(seconds: number): string {
  return formatRelativeTime(seconds)
}

function avatarFallback(item: FriendRequest): string {
  return (item.nickname || String(item.userId)).trim().charAt(0).toUpperCase()
}

/** 点击头像进入资料页（对齐 Flutter toUserInfoPage → UserInfoPage.toByUserId） */
function openProfile(item: FriendRequest): void {
  if (!item.userId) return
  router.push({
    name: 'ContactUserProfile',
    params: { userId: String(item.userId) },
    query: {
      nickname: item.nickname,
      avatar: item.avatar,
      tlId: `tielian-${item.userId}`,
      source: 'friend_request',
    },
  })
}

async function onHandle(item: FriendRequest, action: 'accept' | 'reject'): Promise<void> {
  const ok = await handle(item, action)
  if (ok) trackEvent('contacts', `friend-request-${action}`)
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  deleteTarget.value = null
  if (!target) return
  await remove(target)
}

async function confirmClear(): Promise<void> {
  clearModalVisible.value = false
  await clearAll()
}

function setupObserver(): void {
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    },
    { rootMargin: '120px' },
  )
  observer.observe(sentinel.value)
}

onMounted(async () => {
  await load()
  setupObserver()
})

// 组件卸载时断开观察，避免内存泄漏
onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

// 暴露刷新入口，便于外层在需要时重新拉取
defineExpose({ load })
</script>

<template>
  <div class="friend-request-list">
    <div class="friend-request-list__toolbar">
      <span class="friend-request-list__count">
        {{ t('contacts.requests.title') }}
        <template v-if="total > 0"> · {{ total }}</template>
      </span>
      <button
        type="button"
        class="friend-request-list__clear-all"
        :disabled="loading || list.length === 0"
        @click="clearModalVisible = true"
      >
        {{ t('contacts.requests.clearAll') }}
      </button>
    </div>

    <div class="friend-request-list__body">
      <!-- 加载态 -->
      <div v-if="loading" class="friend-request-list__state">
        <span class="friend-request-list__spinner" />
        <span>{{ t('contacts.requests.loading') }}</span>
      </div>
      <!-- 错误态 -->
      <div v-else-if="error" class="friend-request-list__state">
        <span>{{ t('contacts.requests.loadFailed') }}</span>
        <button type="button" class="friend-request-list__retry" @click="load">
          {{ t('contacts.requests.retry') }}
        </button>
      </div>
      <!-- 空态 -->
      <div v-else-if="isEmpty" class="friend-request-list__state">
        <span>{{ t('contacts.requests.empty') }}</span>
      </div>
      <!-- 列表 -->
      <template v-else>
        <div
          v-for="item in list"
          :key="item.id"
          class="friend-request-list__item"
          @contextmenu.prevent="deleteTarget = item"
        >
          <div class="friend-request-list__row">
            <button type="button" class="friend-request-list__avatar-btn" @click="openProfile(item)">
              <img v-if="item.avatar" class="friend-request-list__avatar" :src="item.avatar" alt="" />
              <span v-else class="friend-request-list__avatar friend-request-list__avatar--fallback">
                {{ avatarFallback(item) }}
              </span>
            </button>
            <div class="friend-request-list__info">
              <div class="friend-request-list__line">
                <span class="friend-request-list__name">
                  {{ item.nickname || item.userId }}
                  <span v-if="item.remark" class="friend-request-list__remark">
                    {{ t('contacts.requests.remarkPrefix') }}{{ item.remark }})
                  </span>
                </span>
                <span class="friend-request-list__time">{{ timeLabel(item.createdAt) }}</span>
              </div>
              <p v-if="item.message" class="friend-request-list__message">{{ item.message }}</p>
            </div>
          </div>

          <div class="friend-request-list__actions">
            <span class="friend-request-list__source">
              {{ t('contacts.requests.sourcePrefix') }}{{ sourceLabel(item.source) }}{{ t('contacts.requests.sourceSuffix') }}
            </span>
            <div v-if="item.status === 'pending'" class="friend-request-list__buttons">
              <button type="button" class="friend-request-list__btn" @click="onHandle(item, 'accept')">
                {{ t('contacts.requests.agree') }}
              </button>
              <button
                type="button"
                class="friend-request-list__btn friend-request-list__btn--danger"
                @click="onHandle(item, 'reject')"
              >
                {{ t('contacts.requests.ignore') }}
              </button>
            </div>
            <span v-else class="friend-request-list__status">{{ statusLabel(item.status) }}</span>
          </div>

          <!-- Web 侧补充删除入口（App 为长按）：点击删除该记录 -->
          <button
            type="button"
            class="friend-request-list__delete"
            :aria-label="t('contacts.requests.deleteTitle')"
            @click="deleteTarget = item"
          >
            <EmIcon name="close" :size="14" />
          </button>
        </div>

        <div ref="sentinel" class="friend-request-list__sentinel">
          <span v-if="loadingMore">{{ t('contacts.requests.loadingMore') }}</span>
          <span v-else-if="!hasMore && list.length > 0">{{ t('contacts.requests.noMore') }}</span>
        </div>
      </template>
    </div>

    <!-- 删除单条确认（对齐 App Dialogs.showConfirm 删除记录 / 删除后无法恢复） -->
    <EmModal
      v-model:show="deleteModalVisible"
      :title="t('contacts.requests.deleteTitle')"
      :confirm-text="t('contacts.requests.confirm')"
      type="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    >
      <p class="friend-request-list__tip">{{ t('contacts.requests.deleteConfirm') }}</p>
    </EmModal>

    <!-- 一键清空确认 -->
    <EmModal
      v-model:show="clearModalVisible"
      :title="t('contacts.requests.clearTitle')"
      :confirm-text="t('contacts.requests.confirm')"
      type="danger"
      @confirm="confirmClear"
      @cancel="clearModalVisible = false"
    >
      <p class="friend-request-list__tip">{{ t('contacts.requests.clearConfirm') }}</p>
    </EmModal>
  </div>
</template>

<style lang="scss" scoped>
.friend-request-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--color-bg, var(--uikit-bg-page, #f5f6f7));

  &__toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 14px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
    background: var(--uikit-bg-elevated, #fff);
  }

  &__count {
    color: var(--uikit-text-primary, #171a1c);
    font-size: 14px;
    font-weight: 600;
  }

  &__clear-all {
    border: none;
    background: transparent;
    color: var(--uikit-primary-color, #1677ff);
    font-size: 13px;
    cursor: pointer;

    &:disabled {
      color: var(--uikit-text-secondary, #9aa2a7);
      cursor: not-allowed;
    }
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    box-sizing: border-box;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 160px;
    color: var(--uikit-text-secondary, #9aa2a7);
    font-size: 14px;
  }

  &__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--uikit-primary-color-light, #e8f1ff);
    border-top-color: var(--uikit-primary-color, #1677ff);
    border-radius: 50%;
    animation: friend-request-spin 0.8s linear infinite;
  }

  &__retry {
    padding: 6px 16px;
    border: 1px solid var(--uikit-primary-color, #1677ff);
    border-radius: 6px;
    background: transparent;
    color: var(--uikit-primary-color, #1677ff);
    font-size: 13px;
    cursor: pointer;
  }

  &__item {
    position: relative;
    margin-bottom: 8px;
    padding: 12px;
    box-sizing: border-box;
    border-radius: 10px;
    background: var(--uikit-bg-elevated, #fff);
  }

  &__row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  &__avatar-btn {
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  &__avatar {
    display: block;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    object-fit: cover;

    &--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--uikit-primary-color-light, #e8f1ff);
      color: var(--uikit-primary-color, #1677ff);
      font-size: 16px;
      font-weight: 500;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    color: var(--uikit-text-primary, #171a1c);
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__remark {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 12px;
    font-weight: 400;
  }

  &__time {
    flex-shrink: 0;
    color: var(--uikit-text-secondary, #9aa2a7);
    font-size: 12px;
  }

  &__message {
    margin: 4px 0 0;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 10px;
  }

  &__source {
    padding: 3px 8px;
    border-radius: 8px;
    background: var(--color-bg-secondary, #f2f3f5);
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 12px;
  }

  &__buttons {
    display: flex;
    gap: 8px;
  }

  &__btn {
    min-width: 56px;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--uikit-primary-color, #1677ff);
    border-radius: 6px;
    background: var(--uikit-primary-color, #1677ff);
    color: #fff;
    font-size: 13px;
    cursor: pointer;

    &--danger {
      border-color: var(--uikit-divider-color, rgba(0, 0, 0, 0.12));
      background: transparent;
      color: var(--uikit-error-color, #f0242e);
    }
  }

  &__status {
    color: var(--uikit-text-secondary, #9aa2a7);
    font-size: 13px;
  }

  &__delete {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-bg-secondary, #f2f3f5);
    color: var(--uikit-text-secondary, #9aa2a7);
    cursor: pointer;
  }

  &__sentinel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    color: var(--uikit-text-secondary, #9aa2a7);
    font-size: 12px;
  }

  &__tip {
    margin: 0;
    color: var(--uikit-text-secondary, #5e686e);
    font-size: 14px;
  }
}

@keyframes friend-request-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
