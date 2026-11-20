import type { UiMessage } from '@easemob-community/uikit-im'
import { describe, expect, it } from 'vitest'

import { buildCollectionFromMessage, canCollectMessage } from '@/utils/favoriteMessage'

/** 造一条消息；body 支持自定义事件 params */
function msg(type: string, body: Record<string, unknown> = {}, extra: Partial<UiMessage> = {}): UiMessage {
  return { type, body, ...extra } as unknown as UiMessage
}

function customMsg(event: string, params: Record<string, string> = {}): UiMessage {
  return msg('custom', { event, params })
}

describe('消息是否显示收藏菜单（对齐 App message_item.dart）', () => {
  it('文本/图片/视频/文件/位置可收藏', () => {
    for (const type of ['text', 'image', 'video', 'file', 'location']) {
      expect(canCollectMessage(msg(type))).toBe(true)
    }
  })

  it('语音与名片不显示收藏', () => {
    expect(canCollectMessage(msg('voice'))).toBe(false)
    expect(canCollectMessage(msg('card'))).toBe(false)
  })

  it('note/emoji/card 自定义消息可收藏，其它自定义事件不可', () => {
    expect(canCollectMessage(customMsg('note'))).toBe(true)
    expect(canCollectMessage(customMsg('emoji'))).toBe(true)
    expect(canCollectMessage(customMsg('card'))).toBe(true)
    expect(canCollectMessage(customMsg('groupInviteV1'))).toBe(false)
    expect(canCollectMessage(customMsg('notice'))).toBe(false)
  })
})

describe('消息转收藏 payload（Web 端直接用原始地址，不下载/上传）', () => {
  it('文本 → type=text，content 为 {"text":...}', () => {
    const result = buildCollectionFromMessage(msg('text', { content: '你好' }))
    expect(result?.kind).toBe('text')
    expect(result?.payload?.type).toBe('text')
    expect(JSON.parse(result!.payload!.content!)).toEqual({ text: '你好' })
  })

  it('http/https 文本 → type=link，desc 固定「网址」', () => {
    const result = buildCollectionFromMessage(msg('text', { content: 'https://example.com/a' }))
    expect(result?.kind).toBe('link')
    expect(JSON.parse(result!.payload!.content!)).toEqual({
      url: 'https://example.com/a',
      desc: '网址',
    })
  })

  it('位置 → type=location，字段对齐 LocationCollection.format', () => {
    const result = buildCollectionFromMessage(
      msg('location', { latitude: 30.5, longitude: 104.2, address: '成都', buildingName: '广场' }),
    )
    expect(result?.payload?.type).toBe('location')
    expect(JSON.parse(result!.payload!.content!)).toEqual({
      latitude: 30.5,
      longitude: 104.2,
      address: '成都',
      name: '广场',
    })
  })

  it('图片 → 原图与缩略图均为消息体原始地址，无 duration', () => {
    const result = buildCollectionFromMessage(
      msg('image', {
        originalImageUrl: 'https://x.com/big.jpg',
        thumbnailUrl: 'https://x.com/thumb.jpg',
        width: 1170,
        height: 2532,
      }),
    )
    expect(result?.payload?.type).toBe('image')
    const content = JSON.parse(result!.payload!.content!)
    expect(content.url).toBe('https://x.com/big.jpg')
    expect(content.thumb).toBe('https://x.com/thumb.jpg')
    expect(content.width).toBe(1170)
    expect(content.height).toBe(2532)
    expect(content).not.toHaveProperty('duration')
  })

  it('图片缺缩略图时用原图兜底 thumb', () => {
    const result = buildCollectionFromMessage(msg('image', { url: 'https://x.com/only.jpg' }))
    const content = JSON.parse(result!.payload!.content!)
    expect(content.url).toBe('https://x.com/only.jpg')
    expect(content.thumb).toBe('https://x.com/only.jpg')
  })

  it('视频 → 用原始地址，缩略图缺省为空；duration 有值才写入', () => {
    const result = buildCollectionFromMessage(
      msg('video', { url: 'https://x.com/v.mp4', duration: 15, thumbnailUrl: 'https://x.com/t.jpg' }),
    )
    expect(result?.payload?.type).toBe('video')
    const content = JSON.parse(result!.payload!.content!)
    expect(content.url).toBe('https://x.com/v.mp4')
    expect(content.thumb).toBe('https://x.com/t.jpg')
    expect(content.duration).toBe(15)

    const noThumb = buildCollectionFromMessage(msg('video', { url: 'https://x.com/v2.mp4' }))
    const c2 = JSON.parse(noThumb!.payload!.content!)
    expect(c2.thumb).toBe('')
    expect(c2).not.toHaveProperty('duration')
  })

  it('文件 → 用原始地址，filename/size 取自消息体（兼容 body.file.size）', () => {
    const result = buildCollectionFromMessage(
      msg('file', { url: 'https://x.com/f.pdf', filename: '合同.pdf', size: 2048 }),
    )
    expect(result?.payload?.type).toBe('file')
    const content = JSON.parse(result!.payload!.content!)
    expect(content).toEqual({ url: 'https://x.com/f.pdf', filename: '合同.pdf', size: 2048 })

    const nested = buildCollectionFromMessage(
      msg('file', { url: 'https://x.com/g.docx', file: { name: '报告.docx', size: 4096 } }),
    )
    expect(JSON.parse(nested!.payload!.content!)).toEqual({
      url: 'https://x.com/g.docx',
      filename: '报告.docx',
      size: 4096,
    })
  })

  it('图片/视频/文件缺地址时抛出明确错误（ UI 提示）', () => {
    expect(() => buildCollectionFromMessage(msg('image', {}))).toThrow('图片地址为空')
    expect(() => buildCollectionFromMessage(msg('video', {}))).toThrow('视频地址为空')
    expect(() => buildCollectionFromMessage(msg('file', {}))).toThrow('文件地址为空')
  })

  it('笔记 → 不传 content，source_id/source_type=note', () => {
    const result = buildCollectionFromMessage(customMsg('note', { id: '123', title: '我的笔记' }))
    expect(result?.payload?.type).toBe('note')
    expect(result?.payload?.title).toBe('我的笔记')
    expect(result?.payload?.source_id).toBe('123')
    expect(result?.payload?.source_type).toBe('note')
    expect(result?.payload?.content).toBeUndefined()
  })

  it('表情 → 走独立 emojiUrl，无 payload', () => {
    const result = buildCollectionFromMessage(customMsg('emoji', { id: '1', url: 'https://x.com/e.gif' }))
    expect(result?.kind).toBe('emoji')
    expect(result?.emojiUrl).toBe('https://x.com/e.gif')
    expect(result?.payload).toBeUndefined()
  })

  it('名片 → type=chat + title，无 content', () => {
    const result = buildCollectionFromMessage(customMsg('card', { name: '张三' }))
    expect(result?.kind).toBe('card')
    expect(result?.payload?.type).toBe('chat')
    expect(result?.payload?.title).toBe('张三')
    expect(result?.payload?.content).toBeUndefined()
  })

  it('不支持的消息返回 null', () => {
    expect(buildCollectionFromMessage(msg('voice', { url: 'x' }))).toBeNull()
    expect(buildCollectionFromMessage(customMsg('notice'))).toBeNull()
  })
})
