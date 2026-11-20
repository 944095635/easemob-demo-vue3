import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from '@/utils/friendRequestTime'

const NOW = 1_784_035_945 * 1000

describe('formatRelativeTime', () => {
  it('0 / 无效时间戳返回空串', () => {
    expect(formatRelativeTime(0, NOW)).toBe('')
    expect(formatRelativeTime(Number.NaN, NOW)).toBe('')
  })

  it('未来时间或 1 分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(1_784_035_950, NOW)).toBe('刚刚')
    expect(formatRelativeTime(1_784_035_945 - 30, NOW)).toBe('刚刚')
  })

  it('分钟级显示 N分钟前', () => {
    expect(formatRelativeTime(1_784_035_945 - 60, NOW)).toBe('1分钟前')
    expect(formatRelativeTime(1_784_035_945 - 59 * 60, NOW)).toBe('59分钟前')
  })

  it('小时级显示 N小时前', () => {
    expect(formatRelativeTime(1_784_035_945 - 60 * 60, NOW)).toBe('1小时前')
    expect(formatRelativeTime(1_784_035_945 - 23 * 3600, NOW)).toBe('23小时前')
  })

  it('天级显示 N天前（对齐 Flutter TimeUtils.formatDisplay）', () => {
    expect(formatRelativeTime(1_784_035_945 - 24 * 3600, NOW)).toBe('1天前')
    expect(formatRelativeTime(1_784_035_945 - 3 * 24 * 3600, NOW)).toBe('3天前')
  })
})
