import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cacheProfile, clearCachedProfile, fetchUserProfile, getCachedProfile } from '@/api/profile'
import request from '@/api/request'

describe('个人资料接口与本地缓存', () => {
  let mock: MockAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    mock = new MockAdapter(request)
    localStorage.clear()
  })

  afterEach(() => {
    mock.restore()
    localStorage.clear()
  })

  it('缓存按 userId 隔离读写', () => {
    cacheProfile('tielian-1', { nickname: '张三', avatar: 'https://a.png' })
    cacheProfile('tielian-2', { nickname: '李四' })

    expect(getCachedProfile('tielian-1')?.nickname).toBe('张三')
    expect(getCachedProfile('tielian-2')?.nickname).toBe('李四')
    expect(getCachedProfile('unknown')).toBeNull()
  })

  it('可清除单个账号或全部缓存', () => {
    cacheProfile('tielian-1', { nickname: '张三' })
    cacheProfile('tielian-2', { nickname: '李四' })

    clearCachedProfile('tielian-1')
    expect(getCachedProfile('tielian-1')).toBeNull()
    expect(getCachedProfile('tielian-2')?.nickname).toBe('李四')

    clearCachedProfile()
    expect(getCachedProfile('tielian-2')).toBeNull()
  })

  it('请求 /api/user/profile 并返回资料', async () => {
    mock.onGet(/\/user\/profile$/).reply(200, {
      code: 0,
      message: 'ok',
      data: { id: 300008, nickname: '铁恋用户', avatar: 'https://cdn/a.png' },
    })

    const profile = await fetchUserProfile()
    expect(profile?.nickname).toBe('铁恋用户')
    expect(profile?.avatar).toBe('https://cdn/a.png')
  })

  it('接口失败时返回 null，由调用方用缓存兜底', async () => {
    mock.onGet(/\/user\/profile$/).reply(500, { code: 500, message: 'error', data: null })
    await expect(fetchUserProfile()).resolves.toBeNull()
  })
})
