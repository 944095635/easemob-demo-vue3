import { createApp, watch } from 'vue'

import App from './App.vue'
import i18n from './locales'
import router from './router'
import pinia from './store'

import UIKit from '@easemob-community/uikit-im'
// SDK5 默认适配器注册入口（uikit-im 3.x 双 adapter 架构）：import 即注册，Provider 不传 adapter 时使用
import '@easemob-community/uikit-im/websdk5'
import '@easemob-community/uikit-im/theme'

import { applyDemoContainerConfig } from './config/demo'
import { applyUIKitLocaleOverrides } from './config/uikit-locale'
import { useDevMode } from './composables/useDevMode'
import { useTheme } from './composables/useTheme'
import { isMobile } from './utils/env'
import { applyOssAccess } from './utils/ossAccess'
import { installAvatarSrcRewrite } from './utils/avatarSrcRewrite'
import { setupBaiduAnalytics } from './utils/analytics'

import 'nprogress/nprogress.css'
import './styles/index.scss'

// 初始化主题（模块内 watch 注册于 import 时，这里显式调用保证入口即生效）
useTheme()

// 应用 Demo 容器配置（间距 / 圆角 → CSS 变量），与 UIKit demo 的容器间距对齐
applyDemoContainerConfig()

// 覆盖 UIKit 内置文案（添加联系人弹窗输入框支持手机号或用户 ID）
applyUIKitLocaleOverrides()

// OSS/CDN 头像读链路（移植自 Flutter OssHttpOverrides）：用环境变量覆盖读链路配置，
// 再全局接管 <img src>，把 OSS 头像改写为同源 /oss-cdn 路径，由同源代理注入 Referer
// 头解决 403 denied by Referer ACL。须在 app 挂载、UIKit 渲染头像前安装。
//
// 开发环境：Vite server.proxy 的 /oss-cdn 代理（vite.config.ts）。
// 正式环境（Web 静态）：需 nginx 配同名 /oss-cdn 反代，见 AGENTS.md 部署小节。
// 正式环境（Electron）：electron/static-server.cjs 内置 /oss-cdn 反代，开箱即用。
// 若某部署形态没有 /oss-cdn 反代，把 VITE_OSS_PROXY_ENABLED=false 即可关闭改写，
// 头像退回直连 OSS（可能 403），避免改写后路径 404。
if (import.meta.env.VITE_OSS_PROXY_ENABLED !== 'false') {
  applyOssAccess({
    publicBase: import.meta.env.VITE_OSS_CDN_HOST
      ? `https://${import.meta.env.VITE_OSS_CDN_HOST}`
      : undefined,
    referer: import.meta.env.VITE_OSS_REFERER,
  })
  installAvatarSrcRewrite()
}

// 百度统计：仅生产环境加载（import.meta.env.PROD 守卫，见 src/utils/analytics.ts）
setupBaiduAnalytics()

// H5 真机调试面板：移动端跟随开发者模式开关，开启时动态加载、关闭时销毁
if (isMobile) {
  const { devEnabled } = useDevMode()
  let eruda: typeof import('eruda').default | null = null
  watch(
    devEnabled,
    async (enabled) => {
      if (enabled) {
        if (!eruda) eruda = (await import('eruda')).default
        eruda.init()
      } else if (eruda) {
        eruda.destroy()
      }
    },
    { immediate: true },
  )
}

const app = createApp(App)

app.use(pinia)
app.use(UIKit)
app.use(router)
app.use(i18n)

app.mount('#app')

// 挂载后延迟注入拼音适配器（实现见 src/utils/pinyin.ts）：UIKit 调用时才读取 adapter
// （模块级变量，注册时无快照），动态 import 把 pinyin-pro 完整词典移出首屏关键链；
// 注册前 UIKit 自动降级为字符串匹配，注册后拼音搜索 / 分组即恢复。
void import('./utils/pinyin').then((m) => m.setupPinyinAdapter())
