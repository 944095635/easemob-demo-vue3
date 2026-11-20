<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { ensureUserProfile } from '@/composables/useUserProfile'
import { useUserStore } from '@/store/modules/user'

import DangerZone from './account/DangerZone.vue'
import ProfileDetails from './account/ProfileDetails.vue'

defineOptions({ name: 'AccountInfo' })

const { t } = useI18n()
const userStore = useUserStore()

// 进入账户页时确保个人资料已加载（启动/登录已加载则不会重复请求）
onMounted(() => {
  void ensureUserProfile(userStore.userId)
})
</script>

<template>
  <div class="account-info">
    <div class="account-info__header">
      <span class="account-info__title">{{ t('settings.account.title') }}</span>
    </div>

    <div class="account-info__body">
      <div class="account-info__content">
        <!-- 资料分组卡片（对齐 App「我的信息」页）：基础设置 + 资料卡 -->
        <ProfileDetails />

        <DangerZone />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-info {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);

  /* 头部对齐设计稿 top_bars：60px 高、18px 标题，底部 1px 通宽分割线 */
  &__header {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    min-height: 60px;
    padding: 0 16px;

    &::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 1px;
      background: var(--color-border);
    }
  }

  &__title {
    font-size: calc(18px * var(--demo-font-scale, 1));
    font-weight: 500;
    color: var(--color-text);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 32px 24px;
  }

  /* 内容列：520px 宽水平居中、垂直居中（margin auto 保证超高时可滚动不裁切），区块间距对齐设计稿 */
  &__content {
    width: 100%;
    max-width: 520px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
}
</style>
