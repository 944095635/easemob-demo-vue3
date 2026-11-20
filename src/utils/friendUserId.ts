/**
 * 环信 userId → 自有服务数字 userId。
 *
 * Flutter App 内部用 int userId，环信侧用 `tielian-{userId}`；Web 的 UIKit 联系人/名片
 * 里拿到的 userId 可能是纯数字，也可能是 `tielian-300009` 这类前缀形式。
 * 自有服务删除好友接口只接受数字 userId，这里统一提取末尾连续数字。
 */
export function toNumericUserId(userId: string): number {
  const matched = String(userId || '').match(/(\d+)\s*$/)
  const value = matched ? Number.parseInt(matched[1], 10) : 0
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('无法解析用户 ID')
  }
  return value
}
