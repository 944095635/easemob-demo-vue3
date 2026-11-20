/// <reference types="vite/client" />

/** 构建注入：当前实际安装的 easemob-websdk 版本号（vite/vitest config 的 define 注入，见 scripts/resolve-websdk-version.mts） */
declare const __SDK_VERSION__: string

interface ImportMetaEnv {
  /** 通用接口基地址：dev 为 /api 同源代理，生产 / Electron 直连自有 API 服务 */
  readonly VITE_API_BASE_URL: string
  /** 请求超时时间（毫秒），未配置时默认 15000 */
  readonly VITE_API_TIMEOUT?: string
  /** 自有 App Server 地址（登录、用户、头像等接口） */
  readonly VITE_APP_SERVER_URL?: string
  /** 阿里云验证码 2.0（仅生产环境，配置在 .env.production.local，不入库） */
  readonly VITE_CAPTCHA_SCENE_ID?: string
  readonly VITE_CAPTCHA_PREFIX?: string
  readonly VITE_CAPTCHA_SECRET?: string
  /** UIKit 接入：环信 AppKey（格式 xxxx#xxxx），未配置时 Provider 不初始化 SDK */
  readonly VITE_APP_KEY?: string
  /** OSS/CDN 头像读链路：CDN 域名（默认 cdnv2.cntlyun.com），须与 vite.config.ts 代理一致 */
  readonly VITE_OSS_CDN_HOST?: string
  /** OSS/CDN 头像读链路：防盗链 Referer（默认 https://<CDN host>/） */
  readonly VITE_OSS_REFERER?: string
  /** OSS/CDN 头像读链路：是否启用同源 /oss-cdn 改写（默认启用；无反代的环境设 false 关闭） */
  readonly VITE_OSS_PROXY_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
