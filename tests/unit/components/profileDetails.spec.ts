import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// UIKit 的组件/hook 依赖 Provider；此处 mock 掉以独立验证组件渲染逻辑
vi.mock('@easemob-community/uikit-im', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useUserInfoStore: () => ({ getUserInfo: () => undefined, setUserInfo: vi.fn() }),
  useUIKit: () => ({ client: { value: { currentUserId: 'test-user' } } }),
  useOwnUserInfo: () => ({
    avatarUrl: { value: '' },
    displayName: { value: '' },
    userInfo: { value: undefined },
    updateOwnInfo: vi.fn(),
    updateOwnInfoByAttribute: vi.fn(),
  }),
  EmAvatar: { template: '<span class="mock-avatar" />' },
  EmIcon: { template: '<span class="mock-icon" />', props: ['name', 'size'] },
  EmInput: { template: '<input />' },
  EmPopup: { template: '<div><slot /></div>', props: ['show'] },
}))

import { useCurrentProfile } from '@/composables/useUserProfile'
import i18n from '@/locales'
import ProfileDetails from '@/views/settings/components/account/ProfileDetails.vue'

describe('ProfileDetails 账户资料展示（对齐 App 我的信息页）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useCurrentProfile().value = null
  })

  function mount() {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const app = createApp({
      components: { ProfileDetails },
      template: '<ProfileDetails />',
    })
    app.use(i18n)
    app.mount(el)
    return el
  }

  it('无数据时组件仍能挂载并显示占位，不白屏', async () => {
    const el = mount()
    await nextTick()
    expect(el.textContent).toContain('Tielian ID')
    expect(el.textContent).toContain('—')
  })

  it('渲染两组卡片标题：基础设置 / 资料卡', async () => {
    const el = mount()
    await nextTick()
    expect(el.textContent).toContain('Basic')
    expect(el.textContent).toContain('Profile')
  })

  it('头像/昵称/签名在基础设置或资料卡分组内，且铁恋ID/性别/封面正常显示', async () => {
    useCurrentProfile().value = {
      chat_id: 'TL_abc123',
      nickname: '铁恋用户',
      gender: 1,
      profile_cover: 'https://cdn.example.com/cover.jpg',
    }
    const el = mount()
    await nextTick()
    expect(el.textContent).toContain('TL_abc123')
    expect(el.textContent).toContain('Avatar')
    expect(el.textContent).toContain('Nickname')
    expect(el.textContent).toContain('Signature')
    expect(el.textContent).toContain('Male')
    expect(el.querySelector('img.account-info__cover')).not.toBeNull()
  })
})
