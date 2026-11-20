import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import request from '@/api/request'
import { cacheProfile } from '@/api/profile'
import {
  ensureUserProfile,
  loadUserProfile,
  useCurrentProfile,
} from '@/composables/useUserProfile'
import { useUserStore } from '@/store/modules/user'

describe('个人资料加载与集中状态', () => {
  let mock: MockAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    mock = new MockAdapter(request)
    localStorage.clear()
    // 重置模块级单例状态：写入空对象再加载真实资料时会覆盖
    useCurrentProfile().value = null
  })

  afterEach(() => {
    mock.restore()
    localStorage.clear()
  })

  it('拉取成功后写入集中状态并缓存到本地', async () => {
    mock.onGet(/\/user\/profile$/).reply(200, {
      code: 0,
      message: 'ok',
      data: { id: 300008, chat_id: 'TL_abc123', nickname: '铁恋用户', gender: 1 },
    })

    const profile = await loadUserProfile('tielian-300008')

    expect(profile?.chat_id).toBe('TL_abc123')
    expect(useCurrentProfile().value?.nickname).toBe('铁恋用户')
    // 完整资料写入本地缓存，供下次启动首屏兜底
    expect(JSON.parse(localStorage.getItem('webImUserProfile:tielian-300008') || '{}').profile?.chat_id).toBe('TL_abc123')
  })

  it('ensureUserProfile 在已有资料时不重复请求', async () => {
    mock.onGet(/\/user\/profile$/).reply(200, {
      code: 0,
      message: 'ok',
      data: { nickname: '缓存用户' },
    })
    await loadUserProfile('tielian-300008')
    const callsBefore = mock.history.get.filter((c) => String(c.url).includes('/user/profile')).length

    await ensureUserProfile('tielian-300008')

    const callsAfter = mock.history.get.filter((c) => String(c.url).includes('/user/profile')).length
    expect(callsAfter).toBe(callsBefore)
  })

  it('ensureUserProfile 在本地有缓存时回填集中状态', async () => {
    cacheProfile('tielian-999', { nickname: '离线用户', chat_id: 'TL_offline' })
    mock.onGet(/\/user\/profile$/).reply(500, { code: 500, message: 'error', data: null })

    const profile = await ensureUserProfile('tielian-999')

    expect(profile?.nickname).toBe('离线用户')
    expect(useCurrentProfile().value?.chat_id).toBe('TL_offline')
    // 命中缓存后不应再发网络请求
    expect(mock.history.get.filter((c) => String(c.url).includes('/user/profile')).length).toBe(0)
  })

  it('无用户 ID 时不发起请求', async () => {
    useUserStore().setUserId('')
    await expect(loadUserProfile()).resolves.toBeNull()
    expect(mock.history.get.length).toBe(0)
  })
})
