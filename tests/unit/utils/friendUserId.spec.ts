import { describe, expect, it } from 'vitest'

import { toNumericUserId } from '@/utils/friendUserId'

describe('toNumericUserId', () => {
  it('纯数字 userId 原样返回', () => {
    expect(toNumericUserId('300009')).toBe(300009)
  })

  it('tielian- 前缀的环信 ID 提取末尾数字', () => {
    expect(toNumericUserId('tielian-300009')).toBe(300009)
  })

  it('无法解析时抛错，避免把非法 ID 传给自有服务', () => {
    expect(() => toNumericUserId('')).toThrow('无法解析用户 ID')
    expect(() => toNumericUserId('easemob-uuid')).toThrow('无法解析用户 ID')
    expect(() => toNumericUserId('tielian-0')).toThrow('无法解析用户 ID')
  })
})
