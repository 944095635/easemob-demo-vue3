/**
 * 群邀请处理接口（对齐 Flutter GroupApi.handleGroupInvite）。
 *
 * Flutter: POST group-invite/handle, data = { invite_id: int, action: 'accept' | 'reject' }
 * 签名：body 参数参与签名（见 NetClient.post → calculateSign）。
 * 成功判断由 src/api/request.ts 统一处理（code !== 0 抛错），此处只负责发请求。
 */
import { http } from '@/api/request'
import { createRequestSignHeaders } from '@/utils/requestSign'

// 生产 baseURL 带 /api 前缀时不再重复拼；dev baseURL 为 /api（代理保留前缀）
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

export type GroupInviteAction = 'accept' | 'reject'

export interface HandleGroupInviteResult {
  [key: string]: unknown
}

/** 同意 / 拒绝群邀请；失败时抛出异常，由调用方 toast 提示 */
export async function handleGroupInvite(
  inviteId: number,
  action: GroupInviteAction,
): Promise<HandleGroupInviteResult> {
  const path = `${BASE_HAS_API_PREFIX ? '' : '/api'}/group-invite/handle`
  const body = { invite_id: inviteId, action }
  return http.post<HandleGroupInviteResult>(path, body, {
    headers: createRequestSignHeaders(body),
  })
}
