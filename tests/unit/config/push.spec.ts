import { describe, expect, it } from 'vitest'

import {
  PUSH_CONTENT_SUMMARY,
  PUSH_NAME_PREFIX,
  PUSH_TEMPLATE_KEY,
  buildPushTemplate,
  fixPushName,
} from '@/config/push'

describe('buildPushTemplate（推送模板构造，对齐 Dart fixPushName）', () => {
  it('群聊文本消息：name 为 groupmsg_text，仅含 title_args', () => {
    expect(buildPushTemplate('groupChat', '张三')).toEqual({
      name: 'groupmsg_text',
      title_args: ['张三'],
    })
  })

  it('单聊文本消息：name 为 privatemsg_text', () => {
    expect(buildPushTemplate('singleChat', '李四')).toEqual({
      name: 'privatemsg_text',
      title_args: ['李四'],
    })
  })

  it('群聊非文本消息：name 为 groupmsg，追加 content_args', () => {
    expect(buildPushTemplate('groupChat', '张三', '[图片]')).toEqual({
      name: PUSH_NAME_PREFIX.group,
      title_args: ['张三'],
      content_args: ['[图片]'],
    })
  })

  it('单聊非文本消息：name 为 privatemsg，追加 content_args', () => {
    expect(buildPushTemplate('singleChat', '李四', '[文件]')).toEqual({
      name: PUSH_NAME_PREFIX.single,
      title_args: ['李四'],
      content_args: ['[文件]'],
    })
  })

  it('未知会话类型按单聊处理', () => {
    expect(buildPushTemplate('' as 'singleChat', '王五').name).toBe('privatemsg_text')
  })
})

describe('fixPushName（把推送模板封装进消息 ext）', () => {
  it('ext 为空时新建字段', () => {
    expect(fixPushName(undefined, 'groupChat', '张三')).toEqual({
      [PUSH_TEMPLATE_KEY]: { name: 'groupmsg_text', title_args: ['张三'] },
    })
  })

  it('合并且不覆盖已有业务字段（isSticker / em_at_list / msgQuote）', () => {
    const merged = fixPushName(
      { isSticker: true, stickerCode: 'huanxin.biubiu', em_at_list: ['u1'], msgQuote: { id: 1 } },
      'groupChat',
      '张三',
      '[图片]',
    )

    expect(merged.isSticker).toBe(true)
    expect(merged.stickerCode).toBe('huanxin.biubiu')
    expect(merged.em_at_list).toEqual(['u1'])
    expect(merged.msgQuote).toEqual({ id: 1 })
    expect(merged[PUSH_TEMPLATE_KEY]).toEqual({
      name: 'groupmsg',
      title_args: ['张三'],
      content_args: ['[图片]'],
    })
  })

  it('不修改传入的原 ext 对象（不可变），避免污染 UIKit 原消息', () => {
    const original = { foo: 'bar' }
    const merged = fixPushName(original, 'singleChat', '李四')
    expect(original).toEqual({ foo: 'bar' })
    expect(merged).not.toBe(original)
  })

  it('已有 em_push_template 时以本次生成为准', () => {
    const merged = fixPushName(
      { [PUSH_TEMPLATE_KEY]: { name: 'old', title_args: ['旧'] } },
      'groupChat',
      '新',
    )
    expect(merged[PUSH_TEMPLATE_KEY]).toEqual({ name: 'groupmsg_text', title_args: ['新'] })
  })
})

describe('PUSH_CONTENT_SUMMARY（各消息类型内容摘要）', () => {
  it('文本消息摘要为 null（不带 content_args）', () => {
    expect(PUSH_CONTENT_SUMMARY.text).toBeNull()
  })

  it('图片 / 视频 / 语音 / 文件 / 位置使用协议占位文案', () => {
    expect(PUSH_CONTENT_SUMMARY.image).toBe('[图片]')
    expect(PUSH_CONTENT_SUMMARY.video).toBe('[视频]')
    expect(PUSH_CONTENT_SUMMARY.voice).toBe('[语音]')
    expect(PUSH_CONTENT_SUMMARY.file).toBe('[文件]')
    expect(PUSH_CONTENT_SUMMARY.location).toBe('[位置]')
  })
})
