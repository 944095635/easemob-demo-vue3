import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import router from '@/router'
import { useUserStore } from '@/store/modules/user'
import type { ApiResult } from '@/types'

export type { ApiResult } from '@/types'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 15000,
})

// 401 跳转防抖：并发多个 401 时只跳转一次
let isRedirectingToLogin = false

/** 登录态失效（401）统一处理：清除本地登录态并跳转登录页，携带来源路径便于登录后回跳 */
async function redirectToLogin() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  try {
    useUserStore().reset()
    const current = router.currentRoute.value
    const query = current.path === '/login' ? undefined : { redirect: current.fullPath }
    await router.replace({ path: '/login', query })
  } finally {
    isRedirectingToLogin = false
  }
}

// 请求拦截器：注入自有服务 Web API token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()
    // 自有服务接口（/api/user/profile、/api/group 等）需要 Web API token；
    // 未输入时回退到 token（IM token），保持旧行为，避免破坏未配置 webapi token 的登录流程。
    const token = userStore.webApiToken || userStore.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// 响应拦截器：统一拆包与错误处理
request.interceptors.response.use(
  (response: AxiosResponse<ApiResult>) => {
    const { code, message, data } = response.data
    if (code !== 0) {
      // 统一错误提示：待接入全局 toast 组件（如 uikit 内置提示）后在此处弹出
      return Promise.reject(new Error(message || '请求失败'))
    }
    // 拦截器已拆包返回 data，这里对 axios 默认签名做断言
    return data as unknown as AxiosResponse
  },
  (error: AxiosError<ApiResult>) => {
    if (error.response?.status === 401) {
      void redirectToLogin()
    }
    return Promise.reject(error)
  },
)

/**
 * 类型友好的请求方法：拦截器已把响应拆包为 data，
 * 接口模块直接用 http.get<T> / http.post<T> 声明返回类型，
 * 无需再写 request.post<unknown, unknown>(...) 的形式。
 */
export const http = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return request.get(url, config) as Promise<T>
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request.post(url, data, config) as Promise<T>
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request.put(url, data, config) as Promise<T>
  },
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return request.delete(url, config) as Promise<T>
  },
}

export default request
