/**
 * 相对时间展示（对齐 Flutter TimeUtils.formatDisplayByTimestampSeconds / formatDisplay）：
 * - 0 返回空串；
 * - 1 天以上 → N天前；1 小时以上 → N小时前；1 分钟以上 → N分钟前；否则 → 刚刚。
 * 用于好友申请「新朋友」列表项的创建时间展示。
 */
export function formatRelativeTime(seconds: number, nowMs = Date.now()): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return ''
  const diffMs = nowMs - seconds * 1000
  if (diffMs <= 0) return '刚刚'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes <= 0) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
