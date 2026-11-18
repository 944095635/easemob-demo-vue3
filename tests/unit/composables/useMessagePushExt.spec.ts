import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PUSH_TEMPLATE_KEY } from '@/config/push'

/** 动态可控的登录用户，模拟 core client store */
const currentUser = ref('')

/** 每次安装时返回新的 message domain 实例，避免模块级 WeakSet 幂等影响用例隔离 */
let messageDomain: Record<string, unknown>

vi.mock('@easemob-community/uikit-im', () => ({
  CONVERSATION_TYPE: { SINGLECHAT: 'singleChat', GROUPCHAT: 'groupChat' },
  useUIKit: () => ({
    domains: {
      get message() {
        return messageDomain
      },
    },
    stores: { client: { get currentUser() { return currentUser.value } } },
  }),
}))

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ nickname: '张三', userId: 'u1' }),
}))

import { patchMessageDomain, useMessagePushExt } from '@/composables/useMessagePushExt'

interface SendCase {
  method: string
  extIndex: number
  content: string | null
  args: unknown[]
}

/** 覆盖全部发送方法：ext 参数下标与推送摘要（依据 SdkMessageDomain 签名） */
const SEND_CASES: SendCase[] = [
  { method: 'sendText', extIndex: 3, content: null, args: ['cvs', 'groupChat', 'hi', { a: 1 }] },
  { method: 'sendImage', extIndex: 3, content: '[图片]', args: ['cvs', 'groupChat', {}, { a: 1 }] },
  { method: 'sendFile', extIndex: 3, content: '[文件]', args: ['cvs', 'groupChat', {}, { a: 1 }] },
  { method: 'sendVoice', extIndex: 4, content: '[语音]', args: ['cvs', 'groupChat', {}, 5, { a: 1 }] },
  { method: 'sendVideo', extIndex: 4, content: '[视频]', args: ['cvs', 'groupChat', {}, 5, { a: 1 }] },
  { method: 'sendLocation', extIndex: 5, content: '[位置]', args: ['cvs', 'groupChat', 1, 2, 'addr', { a: 1 }] },
  { method: 'sendCustom', extIndex: 4, content: '[消息]', args: ['cvs', 'groupChat', 'evt', {}, { a: 1 }] },
  { method: 'sendCmd', extIndex: 3, content: '[消息]', args: ['cvs', 'groupChat', 'act', { a: 1 }] },
  { method: 'sendCombine', extIndex: 6, content: '[聊天记录]', args: ['cvs', 'groupChat', 't', 's', 'c', [], { a: 1 }] },
  { method: 'sendMultiBody', extIndex: 3, content: '[消息]', args: ['cvs', 'groupChat', [], { a: 1 }] },
]

function makeDomain(methods: string[]): Record<string, unknown> {
  return Object.fromEntries(methods.map((m) => [m, vi.fn(async () => ({}))]))
}

describe('patchMessageDomain（统一注入推送模板）', () => {
  beforeEach(() => {
    currentUser.value = ''
  })

  it.each(SEND_CASES)('$method 在 ext 参数位置注入推送模板', async (item) => {
    const domain = makeDomain([item.method])
    const original = domain[item.method] as ReturnType<typeof vi.fn>

    patchMessageDomain(domain, () => '张三')
    await (domain[item.method] as (...a: unknown[]) => Promise<unknown>)(...item.args)

    expect(original).toHaveBeenCalledTimes(1)
    const forwardedArgs = original.mock.calls[0]
    // 会话类型与其它参数原样透传
    expect(forwardedArgs[1]).toBe('groupChat')
    const extArg = forwardedArgs[item.extIndex]
    expect(extArg).toMatchObject({ a: 1 })
    expect(extArg[PUSH_TEMPLATE_KEY].title_args).toEqual(['张三'])
    expect(extArg[PUSH_TEMPLATE_KEY].name).toBe(
      item.content === null ? 'groupmsg_text' : 'groupmsg',
    )
    if (item.content === null) {
      expect(extArg[PUSH_TEMPLATE_KEY].content_args).toBeUndefined()
    } else {
      expect(extArg[PUSH_TEMPLATE_KEY].content_args).toEqual([item.content])
    }
  })

  it('ext 缺省时补建对象再注入', async () => {
    const domain = makeDomain(['sendText'])
    const original = domain.sendText as ReturnType<typeof vi.fn>

    patchMessageDomain(domain, () => '李四')
    await (domain.sendText as (...a: unknown[]) => Promise<unknown>)('cvs', 'singleChat', 'hi')

    const extArg = original.mock.calls[0][3]
    expect(extArg[PUSH_TEMPLATE_KEY]).toEqual({
      name: 'privatemsg_text',
      title_args: ['李四'],
    })
  })

  it('保留 UIKit 已有 ext 字段（isSticker / em_at_list）', async () => {
    const domain = makeDomain(['sendText'])
    const original = domain.sendText as ReturnType<typeof vi.fn>

    patchMessageDomain(domain, () => '张三')
    await (domain.sendText as (...a: unknown[]) => Promise<unknown>)('cvs', 'groupChat', 'hi', {
      isSticker: true,
      em_at_list: ['u2'],
    })

    const extArg = original.mock.calls[0][3]
    expect(extArg.isSticker).toBe(true)
    expect(extArg.em_at_list).toEqual(['u2'])
  })

  it('重复调用 patchMessageDomain 幂等，不二次包装', async () => {
    const domain = makeDomain(['sendText'])
    const original = domain.sendText as ReturnType<typeof vi.fn>

    patchMessageDomain(domain, () => '张三')
    patchMessageDomain(domain, () => '李四')
    await (domain.sendText as (...a: unknown[]) => Promise<unknown>)('cvs', 'groupChat', 'hi')

    expect(original).toHaveBeenCalledTimes(1)
    const extArg = original.mock.calls[0][3]
    expect(extArg[PUSH_TEMPLATE_KEY].title_args).toEqual(['张三'])
  })

  it('不存在的方法被安全跳过', () => {
    const domain = makeDomain(['sendText'])
    expect(() => patchMessageDomain(domain, () => '张三')).not.toThrow()
    expect(domain.sendImage).toBeUndefined()
  })
})

describe('useMessagePushExt（登录后安装）', () => {
  it('currentUser 为空时不包装，登录后包装 message domain', async () => {
    currentUser.value = ''
    messageDomain = makeDomain(['sendText'])
    const original = messageDomain.sendText as ReturnType<typeof vi.fn>

    useMessagePushExt()
    await nextTick()
    await (messageDomain.sendText as (...a: unknown[]) => Promise<unknown>)(
      'cvs',
      'groupChat',
      'before',
    )
    expect(original.mock.calls[0][3]).toBeUndefined()

    // 登录成功：userStore 昵称作为推送标题
    currentUser.value = 'u1'
    await nextTick()
    await (messageDomain.sendText as (...a: unknown[]) => Promise<unknown>)(
      'cvs',
      'groupChat',
      'after',
    )
    const extArg = original.mock.calls[1][3]
    expect(extArg[PUSH_TEMPLATE_KEY].title_args).toEqual(['张三'])
  })

  it('昵称缺失时回退到 userId', async () => {
    currentUser.value = 'u1'
    messageDomain = makeDomain(['sendText'])
    const original = messageDomain.sendText as ReturnType<typeof vi.fn>

    useMessagePushExt()
    await nextTick()
    await (messageDomain.sendText as (...a: unknown[]) => Promise<unknown>)(
      'cvs',
      'groupChat',
      'hi',
    )
    expect(original.mock.calls[0][3][PUSH_TEMPLATE_KEY].title_args).toEqual(['张三'])
  })
})
