<script setup lang="ts">
/**
 * 自定义表情消息（event === 'emoji'）渲染，对齐 Flutter MessageEmojiRender：
 * - 裸图展示（无气泡背景/内边距），圆角 8，等比缩放，最大宽 120；
 * - 点击进全屏图片预览（对齐 Flutter chat_page.dart 把 emoji 当图片预览）；
 * - URL 缺失时给出与系统消息一致的灰色提示，不暴露 event/params 原文。
 *
 * 图片的 OSS/CDN 防盗链由全局 <img src> 改写统一走 /oss-cdn 代理
 * （src/utils/avatarSrcRewrite.ts），预览器内部 <img> 同样受益，无需在此手动改写。
 *
 * 通过 EmChatContainer 的 #message-custom 插槽接管，见 src/views/chat/index.vue。
 */
import { computed, ref } from 'vue'
import { EmImageViewer } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { getEmojiView } from '@/utils/customEmojiMessage'

const props = defineProps<{ message: UiMessage }>()

const view = computed(() => getEmojiView(props.message))
const previewVisible = ref(false)
const previewIndex = ref(0)

function openPreview(): void {
  if (view.value.url) previewVisible.value = true
}
</script>

<template>
  <div class="emoji-message">
    <img
      v-if="view.url"
      class="emoji-message__img"
      :src="view.url"
      alt="emoji"
      @click="openPreview"
    />
    <div v-else class="emoji-message__fallback">[表情]</div>

    <EmImageViewer
      :show="previewVisible"
      :srcs="view.url ? [view.url] : []"
      :index="previewIndex"
      :show-navigator="false"
      @update:show="previewVisible = $event"
      @update:index="previewIndex = $event"
    />
  </div>
</template>

<style lang="scss" scoped>
.emoji-message {
  display: flex;

  &__img {
    display: block;
    max-width: 120px;
    width: auto;
    height: auto;
    border-radius: 8px;
    object-fit: contain;
    cursor: pointer;
  }

  &__fallback {
    padding: 2px 8px;
    border-radius: var(--uikit-components-radius, 8px);
    background-color: var(--uikit-message-chip-bg, var(--uikit-bubble-bg-other, #e4e6e7));
    color: var(--uikit-text-secondary, #5e686e);
    font-size: var(--uikit-font-size-13);
    line-height: 18px;
  }
}
</style>
