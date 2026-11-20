<script setup lang="ts">
/**
 * 我的收藏（移植自 Flutter `lib/page/collection/collection_page.dart`）。
 *
 * - 数据全部来自自有 Web API（非 SDK），见 src/api/collection.ts；
 * - 顶部分类：最近使用 / 笔记 / 聊天记录 / 图片和视频 / 文件 / 位置（对齐 App displayTypes）；
 * - 分页：page 从 1 起、page_size=20，返回不足 20 条即停止（App loadList 逻辑）；
 * - 各类型按 App CollectionItem 展示，点击预览、按钮删除/复制；
 * - 语音 / 群邀请不在 App 收藏范围内，此处同样不处理。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EmIcon, EmImageViewer, EmModal, useToast } from '@easemob-community/uikit-im'

import {
  deleteCollection,
  getCollections,
  getRecentCollections,
  type CollectionCategory,
  type CollectionItem,
} from '@/api/collection'
import { useMobileView } from '@/composables/useMobileView'
import {
  formatCollectionTime,
  formatFileSize,
  parseCollectionContent,
  type CollectionContent,
} from '@/utils/collectionContent'

defineOptions({ name: 'FavoritePage' })

const { t } = useI18n()
const { show: showToast, success: showSuccess, error: showError } = useToast()
const isMobileView = useMobileView()

const PAGE_SIZE = 20

interface CategoryTab {
  key: CollectionCategory
  label: string
}

const categories: CategoryTab[] = [
  { key: 'recent', label: t('favorite.category.recent') },
  { key: 'note', label: t('favorite.category.note') },
  { key: 'chat', label: t('favorite.category.chat') },
  { key: 'media', label: t('favorite.category.media') },
  { key: 'file', label: t('favorite.category.file') },
  { key: 'location', label: t('favorite.category.location') },
]

const activeCategory = ref<CollectionCategory>('recent')
const keywordInput = ref('')
const appliedKeyword = ref('')
const items = ref<CollectionItem[]>([])
const page = ref(0)
const hasMore = ref(true)
const loading = ref(false)

/** 缓存解析结果，避免模板里对同一项重复 JSON.parse */
const contentMap = computed(() => {
  const map = new Map<number, CollectionContent>()
  for (const item of items.value) map.set(item.id, parseCollectionContent(item))
  return map
})
function contentOf(item: CollectionItem): CollectionContent {
  return contentMap.value.get(item.id) ?? parseCollectionContent(item)
}

/** 加载指定页（reset 时清空并从第 1 页开始） */
async function load(reset = false): Promise<void> {
  if (loading.value || (!reset && !hasMore.value)) return
  if (reset) {
    page.value = 0
    hasMore.value = true
    items.value = []
  }
  loading.value = true
  try {
    const nextPage = page.value + 1
    const result =
      activeCategory.value === 'recent'
        ? await getRecentCollections(nextPage, PAGE_SIZE)
        : await getCollections(activeCategory.value, nextPage, appliedKeyword.value, PAGE_SIZE)
    page.value = nextPage
    items.value = items.value.concat(result.list)
    // 与 App 一致：用返回条数判断是否还有更多，不依赖后端的 has_more 字段
    if (result.list.length < PAGE_SIZE) hasMore.value = false
  } catch (err) {
    hasMore.value = false
    showError(err instanceof Error ? err.message : t('favorite.loadFailed'))
  } finally {
    loading.value = false
  }
}

function changeCategory(category: CollectionCategory): void {
  if (activeCategory.value === category) return
  activeCategory.value = category
  keywordInput.value = ''
  appliedKeyword.value = ''
  void load(true)
}

/** App 中「最近使用」不允许搜索；其它分类点搜索图标才真正发起查询 */
function doSearch(): void {
  if (activeCategory.value === 'recent') {
    showToast(t('favorite.searchRecentTip'))
    return
  }
  appliedKeyword.value = keywordInput.value.trim()
  void load(true)
}

function onListScroll(event: Event): void {
  const el = event.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) void load()
}

/* ===== 删除（对齐 App 长按菜单里的「删除」+ 二次确认）===== */
const deleteTarget = ref<CollectionItem | null>(null)
const deleteModalVisible = ref(false)

function openDelete(item: CollectionItem): void {
  deleteTarget.value = item
  deleteModalVisible.value = true
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  try {
    await deleteCollection(target.id)
    items.value = items.value.filter((item) => item.id !== target.id)
    showSuccess(t('favorite.deleteSuccess'))
  } catch (err) {
    showError(err instanceof Error ? err.message : t('favorite.deleteFailed'))
  } finally {
    deleteTarget.value = null
    deleteModalVisible.value = false
  }
}

/* ===== 复制文本 ===== */
async function copyText(text: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(t('favorite.copySuccess'))
  } catch {
    showError(t('favorite.copyFailed'))
  }
}

/* ===== 点击预览 ===== */
const previewItem = ref<CollectionItem | null>(null)
const previewVisible = computed({
  get: () => previewItem.value !== null,
  set: (value: boolean) => { if (!value) previewItem.value = null },
})
const previewContent = computed<CollectionContent>(() =>
  previewItem.value ? contentOf(previewItem.value) : parseCollectionContent({} as CollectionItem),
)

/** 图片/视频预览队列：把列表里所有媒体按 App showPreview 的方式组成队列 */
const viewerSrcs = computed(() =>
  items.value
    .filter((item) => item.type === 'image' || item.type === 'video')
    .map((item) => contentOf(item).url)
    .filter((url) => !!url),
)
const viewerVisible = ref(false)
const viewerIndex = ref(0)

function openViewer(item: CollectionItem): void {
  const url = contentOf(item).url
  const index = viewerSrcs.value.indexOf(url)
  viewerIndex.value = index >= 0 ? index : 0
  viewerVisible.value = true
}

function openPreview(item: CollectionItem): void {
  const content = contentOf(item)
  if (item.type === 'image' && content.url) {
    openViewer(item)
    return
  }
  previewItem.value = item
}

function openExternal(url: string): void {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** 位置：对齐 App MapPage.toByCollection，用腾讯地图 URI 打开经纬度 */
function openMap(content: CollectionContent): void {
  const { latitude, longitude, name } = content
  if (!latitude && !longitude) return
  window.open(
    `https://apis.map.qq.com/uri/v1/marker?marker=coord:${latitude},${longitude};title:${encodeURIComponent(name)}`,
    '_blank',
    'noopener,noreferrer',
  )
}

onMounted(() => { void load(true) })
</script>

<template>
  <div class="favorite-page" :class="{ 'favorite-page--pc': !isMobileView }">
    <header class="favorite-page__header">
      <nav class="favorite-page__tabs" aria-label="收藏分类">
        <button
          v-for="category in categories"
          :key="category.key"
          type="button"
          class="favorite-page__tab"
          :class="{ 'favorite-page__tab--active': activeCategory === category.key }"
          @click="changeCategory(category.key)"
        >
          {{ category.label }}
        </button>
      </nav>
      <div v-if="activeCategory !== 'recent'" class="favorite-page__search">
        <EmIcon name="search" :size="18" />
        <input
          v-model="keywordInput"
          type="search"
          :placeholder="t('favorite.searchPlaceholder')"
          @keyup.enter="doSearch"
        />
        <button type="button" class="favorite-page__search-btn" @click="doSearch">
          {{ t('favorite.search') }}
        </button>
      </div>
    </header>

    <div class="favorite-page__list" @scroll="onListScroll">
      <div
        v-if="activeCategory === 'media' && items.length"
        class="favorite-page__grid"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="favorite-page__media"
          role="button"
          tabindex="0"
          @click="openPreview(item)"
          @keydown.enter="openPreview(item)"
        >
          <img
            :src="contentOf(item).thumb || contentOf(item).url"
            alt=""
            class="favorite-page__media-thumb"
          />
          <span v-if="item.type === 'video'" class="favorite-page__media-play">▶</span>
          <button type="button" class="favorite-page__media-delete" @click.stop="openDelete(item)">
            <EmIcon name="trash" :size="16" />
          </button>
        </div>
      </div>

      <template v-else>
        <div
          v-for="item in items"
          :key="item.id"
          class="favorite-page__item"
          role="button"
          tabindex="0"
          @click="openPreview(item)"
          @keydown.enter="openPreview(item)"
        >
          <div class="favorite-page__item-body">
            <template v-if="item.type === 'text'">
              <p class="favorite-page__text">{{ contentOf(item).text }}</p>
            </template>
            <template v-else-if="item.type === 'link'">
              <p class="favorite-page__primary">{{ contentOf(item).desc }}</p>
              <p class="favorite-page__secondary favorite-page__link">{{ contentOf(item).url }}</p>
            </template>
            <template v-else-if="item.type === 'file'">
              <p class="favorite-page__primary">{{ contentOf(item).filename }}</p>
              <p class="favorite-page__secondary">{{ formatFileSize(contentOf(item).size) }}</p>
            </template>
            <template v-else-if="item.type === 'location'">
              <p class="favorite-page__primary">{{ contentOf(item).name }}</p>
              <p class="favorite-page__secondary">{{ contentOf(item).address }}</p>
            </template>
            <template v-else-if="item.type === 'note'">
              <p class="favorite-page__primary">{{ item.title || t('favorite.type.note') }}</p>
              <div v-if="contentOf(item).images.length" class="favorite-page__thumbs">
                <img
                  v-for="(img, index) in contentOf(item).images.slice(0, 4)"
                  :key="index"
                  :src="img"
                  alt=""
                  class="favorite-page__thumb"
                />
              </div>
            </template>
            <template v-else-if="item.type === 'image' || item.type === 'video'">
              <div class="favorite-page__media-row">
                <img
                  :src="contentOf(item).thumb || contentOf(item).url"
                  alt=""
                  class="favorite-page__thumb"
                />
                <span v-if="item.type === 'video'" class="favorite-page__video-tag">▶</span>
              </div>
            </template>
          </div>
          <div class="favorite-page__meta">
            <span>{{ t(`favorite.type.${item.type}`) }}</span>
            <span>{{ formatCollectionTime(item.createdAt) }}</span>
          </div>
          <div class="favorite-page__actions">
            <button
              v-if="item.type === 'text'"
              type="button"
              class="favorite-page__action favorite-page__action--text"
              :title="t('favorite.copy')"
              @click.stop="copyText(contentOf(item).text)"
            >
              {{ t('favorite.copy') }}
            </button>
            <button
              type="button"
              class="favorite-page__action"
              :title="t('favorite.delete')"
              @click.stop="openDelete(item)"
            >
              <EmIcon name="trash" :size="18" />
            </button>
          </div>
        </div>
      </template>

      <div class="favorite-page__status">
        <span v-if="loading">{{ t('favorite.loading') }}</span>
        <span v-else-if="!hasMore && items.length">{{ t('favorite.noMore') }}</span>
        <span v-else-if="!items.length">{{ t('favorite.empty') }}</span>
      </div>
    </div>

    <!-- 删除确认（对齐 App Dialogs.showConfirm） -->
    <EmModal
      v-model:show="deleteModalVisible"
      :title="t('favorite.deleteTitle')"
      :confirm-text="t('favorite.delete')"
      type="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    >
      <p>{{ t('favorite.deleteConfirm') }}</p>
    </EmModal>

    <!-- 预览层 -->
    <div v-if="previewVisible" class="favorite-preview" @click.self="previewVisible = false">
      <div class="favorite-preview__panel">
        <header class="favorite-preview__header">
          <span>{{ t(`favorite.type.${previewItem?.type ?? 'text'}`) }}</span>
          <button type="button" class="favorite-preview__close" @click="previewVisible = false">
            <EmIcon name="xmark/bold" :size="20" />
          </button>
        </header>
        <div class="favorite-preview__body">
          <template v-if="previewItem?.type === 'text'">
            <p class="favorite-preview__text">{{ previewContent.text }}</p>
            <button type="button" class="favorite-preview__btn" @click="copyText(previewContent.text)">
              {{ t('favorite.copy') }}
            </button>
          </template>
          <template v-else-if="previewItem?.type === 'link'">
            <p class="favorite-preview__primary">{{ previewContent.desc }}</p>
            <a class="favorite-preview__url" :href="previewContent.url" target="_blank" rel="noopener noreferrer">
              {{ previewContent.url }}
            </a>
            <button type="button" class="favorite-preview__btn" @click="openExternal(previewContent.url)">
              {{ t('favorite.openLink') }}
            </button>
          </template>
          <template v-else-if="previewItem?.type === 'file'">
            <p class="favorite-preview__primary">{{ previewContent.filename }}</p>
            <p class="favorite-preview__secondary">{{ formatFileSize(previewContent.size) }}</p>
            <button type="button" class="favorite-preview__btn" @click="openExternal(previewContent.url)">
              {{ t('favorite.openFile') }}
            </button>
          </template>
          <template v-else-if="previewItem?.type === 'location'">
            <p class="favorite-preview__primary">{{ previewContent.name }}</p>
            <p class="favorite-preview__secondary">{{ previewContent.address }}</p>
            <button type="button" class="favorite-preview__btn" @click="openMap(previewContent)">
              {{ t('favorite.openMap') }}
            </button>
          </template>
          <template v-else-if="previewItem?.type === 'video'">
            <video v-if="previewContent.url" :src="previewContent.url" controls class="favorite-preview__video" />
          </template>
          <template v-else-if="previewItem?.type === 'note'">
            <p class="favorite-preview__primary">{{ previewItem.title }}</p>
            <p class="favorite-preview__text">{{ previewContent.text }}</p>
            <div v-if="previewContent.images.length" class="favorite-preview__images">
              <img v-for="(img, index) in previewContent.images" :key="index" :src="img" alt="" />
            </div>
          </template>
          <template v-else-if="previewItem?.type === 'image'">
            <img :src="previewContent.url" alt="" class="favorite-preview__image" />
          </template>
        </div>
      </div>
    </div>

    <EmImageViewer
      :show="viewerVisible"
      :srcs="viewerSrcs"
      :index="viewerIndex"
      :show-navigator="true"
      @update:show="viewerVisible = $event"
      @update:index="viewerIndex = $event"
    />
  </div>
</template>

<style lang="scss" scoped>
.favorite-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);

  &--pc {
    box-sizing: border-box;
    padding: var(--demo-container-padding, 8px);
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  &__tabs {
    display: flex;
    flex: 1;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
  }

  &__tab {
    flex-shrink: 0;
    padding: 6px 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-secondary, #8a8f94);
    font-size: 14px;
    cursor: pointer;

    &--active {
      background: var(--color-primary, #0079ff);
      color: #fff;
    }
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary, #8a8f94);

    input {
      width: 160px;
      max-width: 32vw;
      border: none;
      outline: none;
      background: transparent;
      color: var(--color-text, #171a1c);
      font-size: 14px;
    }
  }

  &__search-btn {
    border: none;
    background: transparent;
    color: var(--color-primary, #0079ff);
    font-size: 14px;
    cursor: pointer;
  }

  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 16px 24px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  &__media {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    background: var(--color-bg-secondary);
  }

  &__media-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__media-play {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 24px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  }

  &__media-delete {
    position: absolute;
    right: 6px;
    top: 6px;
    display: flex;
    padding: 4px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
  }

  &__item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 64px 12px 16px;
    margin-bottom: 10px;
    border-radius: 12px;
    background: var(--color-bg-secondary);
    cursor: pointer;

    &:hover .favorite-page__actions {
      opacity: 1;
    }
  }

  &__item-body {
    min-width: 0;
  }

  &__text,
  &__primary,
  &__secondary {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__text {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text, #171a1c);
  }

  &__primary {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text, #171a1c);
  }

  &__secondary {
    margin-top: 4px;
    font-size: 13px;
    color: var(--color-text-secondary, #8a8f94);
  }

  &__link {
    color: var(--color-primary, #0079ff);
  }

  &__thumbs,
  &__media-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  &__thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 12px;
  }

  &__video-tag {
    align-self: flex-end;
    color: var(--color-text-secondary, #8a8f94);
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--color-text-secondary, #8a8f94);
  }

  &__actions {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  &__action {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border: none;
    border-radius: 50%;
    background: var(--color-bg);
    color: var(--color-text-secondary, #8a8f94);
    cursor: pointer;

    &--text {
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
    }
  }

  &__status {
    padding: 20px 0;
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary, #8a8f94);
  }
}

.favorite-preview {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.5);

  &__panel {
    display: flex;
    flex-direction: column;
    width: min(640px, 100%);
    max-height: 80vh;
    border-radius: 16px;
    background: var(--color-bg);
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
    font-weight: 500;
  }

  &__close {
    display: flex;
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--color-text, #171a1c);
    cursor: pointer;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px;
  }

  &__primary {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 500;
    word-break: break-word;
  }

  &__secondary {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--color-text-secondary, #8a8f94);
    word-break: break-word;
  }

  &__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }

  &__url {
    display: block;
    margin-bottom: 16px;
    color: var(--color-primary, #0079ff);
    word-break: break-all;
  }

  &__btn {
    margin-top: 16px;
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: var(--color-primary, #0079ff);
    color: #fff;
    cursor: pointer;
  }

  &__image,
  &__video {
    display: block;
    max-width: 100%;
    max-height: 60vh;
    border-radius: 8px;
  }

  &__images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;

    img {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
    }
  }
}
</style>
