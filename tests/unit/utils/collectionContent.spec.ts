import { describe, expect, it } from 'vitest'

import type { CollectionItem } from '@/api/collection'
import {
  formatCollectionTime,
  formatFileSize,
  parseCollectionContent,
} from '@/utils/collectionContent'

function item(type: string, content: unknown, extra: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: 1,
    title: '',
    content: typeof content === 'string' ? content : JSON.stringify(content),
    type: type as CollectionItem['type'],
    sourceType: '',
    sourceId: '',
    lastUsedAt: '',
    createdAt: '',
    ...extra,
  }
}

describe('收藏内容解析（对齐 App 各 *Collection.format / fromCollection）', () => {
  it('text：读取 content.text', () => {
    expect(parseCollectionContent(item('text', { text: '你好' })).text).toBe('你好')
  })

  it('link：读取 url 与 desc', () => {
    const parsed = parseCollectionContent(item('link', { url: 'https://a.com', desc: '网址' }))
    expect(parsed.url).toBe('https://a.com')
    expect(parsed.desc).toBe('网址')
  })

  it('file：读取 url / filename / size', () => {
    const parsed = parseCollectionContent(
      item('file', { url: 'https://a.com/f.pdf', filename: 'f.pdf', size: 2048 }),
    )
    expect(parsed.filename).toBe('f.pdf')
    expect(parsed.size).toBe(2048)
  })

  it('location：读取经纬度 / 地址 / 名称', () => {
    const parsed = parseCollectionContent(
      item('location', { latitude: 30.5, longitude: 104.2, address: '成都', name: '天府广场' }),
    )
    expect(parsed.name).toBe('天府广场')
    expect(parsed.address).toBe('成都')
    expect(parsed.latitude).toBe(30.5)
  })

  it('image/video：读取 url / thumb / duration', () => {
    const parsed = parseCollectionContent(
      item('video', { url: 'https://a.com/v.mp4', thumb: 'https://a.com/t.jpg', duration: 12 }),
    )
    expect(parsed.url).toBe('https://a.com/v.mp4')
    expect(parsed.thumb).toBe('https://a.com/t.jpg')
    expect(parsed.duration).toBe(12)
  })

  it('note：从 Quill delta 提取文字摘要与图片/视频封面', () => {
    const delta = {
      ops: [
        { insert: '今天的心情 ' },
        { insert: { image: JSON.stringify({ thumbnail: 'https://a.com/i.jpg' }) } },
        { insert: { video: JSON.stringify({ image: 'https://a.com/cover.jpg' }) } },
        { insert: '完成' },
      ],
    }
    const parsed = parseCollectionContent(item('note', delta))
    expect(parsed.text).toContain('今天的心情')
    expect(parsed.images).toEqual(['https://a.com/i.jpg', 'https://a.com/cover.jpg'])
  })

  it('非法 JSON 安全降级为空结构，不抛错', () => {
    expect(parseCollectionContent(item('text', 'not json')).text).toBe('')
  })
})

describe('收藏时间展示（对齐 App TimeUtils.formatDisplayByStr2）', () => {
  const now = new Date(2026, 10, 20, 15, 0, 0)

  it('当天显示 HH:mm', () => {
    expect(formatCollectionTime('2026-11-20 09:05:00', now)).toBe('09:05')
  })

  it('昨天显示「昨天 HH:mm」', () => {
    expect(formatCollectionTime('2026-11-19 23:30:00', now)).toBe('昨天 23:30')
  })

  it('更早显示 MM-dd HH:mm', () => {
    expect(formatCollectionTime('2026-11-01 08:01:00', now)).toBe('11-01 08:01')
  })

  it('秒级时间戳可解析', () => {
    const ts = Math.floor(new Date(2026, 10, 20, 10, 0, 0).getTime() / 1000)
    expect(formatCollectionTime(String(ts), now)).toBe('10:00')
  })
})

describe('文件大小展示（对齐 App FileUtils.convertBytesToString）', () => {
  it('按 B/KB/MB 换算并保留两位小数', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.00 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.00 MB')
  })
})
