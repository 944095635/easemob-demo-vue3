import { describe, expect, it } from 'vitest'

import { getGroupAnnouncementText, parseGroupNotice } from '@/api/group'

describe('group notice parsing', () => {
  it('extracts title / text / image from Flutter notice JSON string', () => {
    const raw = JSON.stringify([
      { type: 'title', content: '周末活动通知' },
      { type: 'text', content: '本周六晚 8 点开始' },
      { type: 'image', imagePath: 'https://cdn.example.com/notice.png' },
    ])

    expect(parseGroupNotice(raw)).toEqual({
      title: '周末活动通知',
      content: '本周六晚 8 点开始',
      image: 'https://cdn.example.com/notice.png',
    })
    // 聊天页横幅与 Flutter ChatNotice 一致：只显示 title
    expect(getGroupAnnouncementText({ notice: raw })).toBe('周末活动通知')
  })

  it('falls back to text content when title is missing', () => {
    const raw = JSON.stringify([{ type: 'text', content: '仅有正文的公告' }])
    expect(getGroupAnnouncementText({ notice: raw })).toBe('仅有正文的公告')
  })

  it('treats plain text and empty notice safely', () => {
    expect(getGroupAnnouncementText({ notice: '纯文本公告' })).toBe('纯文本公告')
    expect(getGroupAnnouncementText({ notice: null })).toBe('')
    expect(getGroupAnnouncementText(null)).toBe('')
  })
})
