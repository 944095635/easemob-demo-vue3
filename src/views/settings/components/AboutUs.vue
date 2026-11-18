<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '@easemob-community/uikit-im'

import tielianLogo from '@/assets/about/tielian-logo.png'

defineOptions({ name: 'AboutUs' })

const { t } = useI18n()
const { success: showSuccess } = useToast()

/** 客服邮箱：展示与复制共用，对齐 Flutter 关于页 */
const SUPPORT_EMAIL = 'tlkf2025@163.com'

/**
 * 用户协议 / 隐私政策：指向项目内置的协议静态页。
 * 原 Flutter 用的 OSS 地址带 `Content-Disposition: attachment`，浏览器会触发下载，
 * 因此把协议 HTML 内置到 public/agreements 并以本地路径新开页展示。
 */
const base = import.meta.env.BASE_URL
const agreementLinks = [
  { label: t('settings.about.userAgreement'), href: `${base}agreements/user-agreement.html` },
  { label: t('settings.about.privacyPolicy'), href: `${base}agreements/privacy-policy.html` },
]

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(SUPPORT_EMAIL)
    showSuccess(t('common.copySuccess'))
  } catch {
    // 复制失败时静默降级，避免阻塞用户
  }
}
</script>

<template>
  <div class="about-us">
    <div class="about-us__header">
      <span class="about-us__title">{{ t('settings.about.title') }}</span>
    </div>

    <div class="about-us__body">
      <!-- 品牌区：圆形 logo + 铁恋名称 + 公众号 + 邮箱（点击复制），对齐 Flutter 关于页 -->
      <div class="about-us__brand">
        <img class="about-us__logo" :src="tielianLogo" :alt="t('settings.about.brandName')" />
        <h2 class="about-us__brand-name">{{ t('settings.about.brandName') }}</h2>
        <p class="about-us__official-account">{{ t('settings.about.officialAccount') }}</p>
        <button
          type="button"
          class="about-us__email"
          :aria-label="t('common.copy')"
          @click="copyEmail"
        >
          {{ t('settings.about.email', { email: SUPPORT_EMAIL }) }}
        </button>
      </div>
    </div>

    <!-- 页脚固定在面板底部：用户协议 / 隐私政策 + 备案号 + 版权 -->
    <div class="about-us__footer">
      <div class="about-us__footer-links">
        <a
          v-for="item in agreementLinks"
          :key="item.label"
          class="about-us__footer-link"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ item.label }}
        </a>
      </div>
      <p class="about-us__icp">{{ t('settings.about.icp') }}</p>
      <p class="about-us__copyright">{{ t('settings.about.copyright') }}</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-us {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);

  /* 顶栏：60px + 18px 标题，与账户信息 / 通用设置面板头部统一 */
  &__header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 16px;
    box-sizing: border-box;
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
    padding: 16px;
  }

  /* 品牌区：顶部留白后垂直居中排列，对齐 Flutter 关于页的 80px 顶部间距 */
  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 80px;
  }

  /* 圆形 logo：80×80 裁剪为圆形（对齐 Flutter ClipOval），object-fit cover 保持图形不拉伸 */
  &__logo {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 50%;
  }

  &__brand-name {
    margin: 20px 0 0;
    font-size: calc(26px * var(--demo-font-scale, 1));
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-text);
  }

  &__official-account {
    margin: 10px 0 0;
    font-size: calc(16px * var(--demo-font-scale, 1));
    color: var(--color-text);
  }

  /* 邮箱：下划线 + 可点击复制，对齐 Flutter 的 GestureDetector + underline */
  &__email {
    margin: 6px 0 0;
    padding: 0;
    font-size: calc(16px * var(--demo-font-scale, 1));
    color: var(--color-text);
    text-decoration: underline;
    cursor: pointer;
    background: transparent;
    border: none;

    &:hover {
      color: var(--color-primary);
    }
  }

  /* 页脚固定在面板底部，不随正文滚动 */
  &__footer {
    flex-shrink: 0;
    padding: 16px 16px 24px;
    text-align: center;
  }

  &__footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
    max-width: 518px;
    margin: 0 auto;
  }

  &__footer-link {
    flex: 1 1 0;
    min-width: fit-content;
    padding: 10px 0;
    font-size: calc(14px * var(--demo-font-scale, 1));
    font-weight: 400;
    color: var(--color-text-secondary);
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      color: var(--color-primary);
    }
  }

  &__icp,
  &__copyright {
    margin: 8px 0 0;
    font-size: calc(12px * var(--demo-font-scale, 1));
    color: var(--color-text-tertiary);
  }
}
</style>
