import { describe, expect, it } from 'vitest'

import { MESSAGE_TYPE } from '@easemob-community/uikit-im'
import type { UiMessage } from '@easemob-community/uikit-im'

import { NOTE_EVENT, getNoteView, isNoteMessage } from '@/utils/noteMessage'

/** 构造一条 custom 笔记消息；params / event 可覆盖 */
function noteMsg(
  params: Record<string, string> = {},
  event: string = NOTE_EVENT,
): UiMessage {
  return {
    type: MESSAGE_TYPE.CUSTOM,
    body: { event, params },
  } as unknown as UiMessage
}

describe('isNoteMessage', () => {
  it('custom 且 event 为 note 时命中', () => {
    expect(isNoteMessage(noteMsg({ id: '1', title: '标题' }))).toBe(true)
  })

  it('其它 event 或非 custom 类型不命中', () => {
    expect(isNoteMessage(noteMsg({}, 'gift'))).toBe(false)
    expect(isNoteMessage(noteMsg({}, 'emoji'))).toBe(false)
    expect(
      isNoteMessage({
        type: MESSAGE_TYPE.TEXT,
        body: { event: NOTE_EVENT },
      } as unknown as UiMessage),
    ).toBe(false)
  })
})

describe('getNoteView', () => {
  it('解析 V2：id / title / images（对齐 Flutter createNoteV2Msg）', () => {
    const images = ['https://cdn/a.jpg', 'https://cdn/b.jpg']
    expect(
      getNoteView(
        noteMsg({ id: '42', title: '旅行笔记', images: JSON.stringify(images) }),
      ),
    ).toEqual({ id: 42, title: '旅行笔记', images, isV2: true })
  })

  it('id 非纯整数时降级为 0（对齐 Dart int.tryParse）', () => {
    expect(getNoteView(noteMsg({ id: 'abc', title: 't' })).id).toBe(0)
    expect(getNoteView(noteMsg({ id: '12x', title: 't' })).id).toBe(0)
    expect(getNoteView(noteMsg({ id: '-3', title: 't' })).id).toBe(-3)
    expect(getNoteView(noteMsg({ id: ' 7 ', title: 't' })).id).toBe(7)
  })

  it('title 非空即 V2；只有 id 为 V1（对齐 isNotNullOrEmpty）', () => {
    expect(getNoteView(noteMsg({ id: '1' })).isV2).toBe(false)
    expect(getNoteView(noteMsg({ id: '1', title: '' })).isV2).toBe(false)
    expect(getNoteView(noteMsg({ id: '1', title: 'x' })).isV2).toBe(true)
  })

  it('images 解析失败或非数组时返回空数组，并过滤非字符串项', () => {
    expect(getNoteView(noteMsg({ title: 't', images: 'not-json' })).images).toEqual([])
    expect(getNoteView(noteMsg({ title: 't', images: '{}' })).images).toEqual([])
    expect(getNoteView(noteMsg({ title: 't', images: '[1,"a",null,""]' })).images).toEqual([
      'a',
    ])
    expect(getNoteView(noteMsg({ title: 't' })).images).toEqual([])
  })

  it('title/images 非字符串时安全降级', () => {
    expect(
      getNoteView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: NOTE_EVENT, params: { title: 123, images: 456 } },
      } as unknown as UiMessage),
    ).toEqual({ id: 0, title: '', images: [], isV2: false })
  })

  it('params 缺失时不抛错', () => {
    expect(
      getNoteView({
        type: MESSAGE_TYPE.CUSTOM,
        body: { event: NOTE_EVENT },
      } as unknown as UiMessage),
    ).toEqual({ id: 0, title: '', images: [], isV2: false })
  })
})
