<script setup lang="ts">
/**
 * 笔记/收藏消息（event === 'note'）渲染，对齐 Flutter MessageNote2Render：
 * - 卡片结构：标题(15px/w500) → 横排缩略图(最多4张, 48×48, 圆角4, cover) → 分割线 → "笔记" 灰色角标；
 * - 最大宽 220，外层 padding 10px 14px、圆角 12（由 UIKit 气泡外壳提供）；
 * - 缩略图点击进全屏图片预览（复用 EmImageViewer）；
 * - 标题/图片由 params 自包含（V2）；V1（只有 id，内容需服务端拉取）Web 端降级为「笔记」占位。
 *
 * 缩略图的 OSS/CDN 防盗链由全局 <img src> 改写走 /oss-cdn 代理（src/utils/avatarSrcRewrite.ts），
 * 预览器内部 <img> 同样受益，无需在此手动改写。
 *
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EmImageViewer } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getNoteView } from '@/utils/noteMessage'

const props = defineProps<{ message: UiMessage }>()
const { t } = useI18n()

const note = computed(() => getNoteView(props.message))
const thumbnails = computed(() => note.value.images.slice(0, 4))
const previewVisible = ref(false)
const previewIndex = ref(0)

function openPreview(index: number): void {
  previewIndex.value = index
  previewVisible.value = true
}
</script>

<template>
  <div class="note-message">
    <!-- V2：标题 + 缩略图 + 角标 -->
    <template v-if="note.isV2">
      <div class="note-message__title">{{ note.title }}</div>
      <div v-if="thumbnails.length" class="note-message__thumbs">
        <img
          v-for="(img, i) in thumbnails"
          :key="i"
          class="note-message__thumb"
          :src="img"
          alt=""
          @click="openPreview(i)"
        />
      </div>
      <div class="note-message__divider"></div>
      <div class="note-message__label">{{ t('chat.noteLabel') }}</div>
    </template>

    <!-- V1：只有 id、内容需服务端拉取，Web 端无对应接口，降级占位 -->
    <div v-else class="note-message__fallback">{{ t('chat.noteFallback') }}</div>

    <EmImageViewer
      :show="previewVisible"
      :srcs="note.images"
      :index="previewIndex"
      :show-navigator="false"
      @update:show="previewVisible = $event"
      @update:index="previewIndex = $event"
    />
  </div>
</template>

<style lang="scss" scoped>
.note-message {
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

  &__title {
    font-size: 15px;
    font-weight: 500;
    color: var(--uikit-text-primary, #171a1c);
    word-break: break-word;
  }

  &__thumbs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__thumb {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 4px;
    object-fit: cover;
    object-position: top center;
    cursor: pointer;
  }

  &__divider {
    height: 1px;
    background-color: var(--uikit-divider-color, rgba(0, 0, 0, 0.06));
  }

  &__label {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: var(--uikit-font-size-13);
  }

  &__fallback {
    color: var(--uikit-text-secondary, #5e686e);
    font-size: var(--uikit-font-size-13);
  }
}
</style>
