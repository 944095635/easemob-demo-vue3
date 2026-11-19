/**
 * 浏览器侧的「HttpOverrides」：全局改写 <img> 的 src，把 OSS/CDN 头像走同源代理。
 *
 * 为什么需要它：UIKit 内部（会话列表、通讯录、消息气泡、群成员等）的头像由
 * EmAvatar 直接渲染 <img :src>，没有暴露 avatarUrl resolver 之类的钩子，Demo 自身
 * 无法逐个改。Flutter 端用 OssHttpOverrides 在 HttpClient 层统一改写 + 注入 Referer；
 * 浏览器不能给 <img> 注入自定义 Referer，于是这里统一把 OSS src 改写成同源代理
 * 路径（/oss-cdn/...），由 Vite 代理注入 Referer（见 vite.config.ts）。
 *
 * 拦截时机：Vue 3 的 patchDOMProp 对 img.src 走的是 `el.src = value` 属性赋值
 * （shouldSetAsProp 判定 'src' in el 为 true），模板静态 src 走 setAttribute。
 * 两者都在浏览器发起请求之前，patch 这两个入口即可在请求前改写，避免先 403 再重试。
 */

import { toProxyUrl } from './ossAccess'

let uninstalled: (() => void) | null = null

function rewrite(value: string): string {
  return toProxyUrl(typeof value === 'string' ? value : String(value ?? ''))
}

/** 安装全局头像 src 改写。重复调用幂等；返回 uninstall 便于测试隔离。 */
export function installAvatarSrcRewrite(): () => void {
  if (uninstalled) return uninstalled

  const proto = HTMLImageElement.prototype
  const srcDescriptor = Object.getOwnPropertyDescriptor(proto, 'src')
  const setAttributeDescriptor = Object.getOwnPropertyDescriptor(proto, 'setAttribute')
  if (!srcDescriptor || !srcDescriptor.get || !srcDescriptor.set) {
    // 非浏览器环境（如 node 单测无 happy-dom）降级为空实现
    uninstalled = () => {}
    return uninstalled
  }

  const nativeGet: (this: HTMLImageElement) => string = srcDescriptor.get
  const nativeSet: (this: HTMLImageElement, value: string) => void = srcDescriptor.set

  Object.defineProperty(proto, 'src', {
    configurable: true,
    enumerable: srcDescriptor.enumerable,
    get(this: HTMLImageElement) {
      return nativeGet.call(this)
    },
    set(this: HTMLImageElement, value: string) {
      nativeSet.call(this, rewrite(value))
    },
  })

  // setAttributeDescriptor 取自 HTMLImageElement 自身；浏览器里 setAttribute 实际继承自 Element，
  // 所以这里从原型链上取实际可用者再覆盖到 HTMLImageElement.prototype 上。
  const nativeSetAttribute: (this: HTMLImageElement, name: string, value: string) => void =
    (setAttributeDescriptor?.value as (this: HTMLImageElement, name: string, value: string) => void) ??
    Element.prototype.setAttribute

  Object.defineProperty(proto, 'setAttribute', {
    configurable: true,
    writable: true,
    value(this: HTMLImageElement, name: string, value: string) {
      if (name.toLowerCase() === 'src') {
        nativeSetAttribute.call(this, name, rewrite(value))
      } else {
        nativeSetAttribute.call(this, name, value)
      }
    },
  })

  uninstalled = () => {
    Object.defineProperty(proto, 'src', srcDescriptor)
    if (setAttributeDescriptor) {
      Object.defineProperty(proto, 'setAttribute', setAttributeDescriptor)
    } else {
      // 原本 setAttribute 继承自 Element：删掉自有覆盖，恢复原型链查找
      delete (proto as Partial<HTMLImageElement>).setAttribute
    }
    uninstalled = null
  }

  return uninstalled
}
