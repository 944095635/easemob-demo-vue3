/**
 * 笔记/收藏消息（note）解析工具。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：CUSTOM 消息按 event === 'note' 识别；
 *   createNoteV2Msg 发送时 params = { id, title, images: json.encode([...]) }。
 * - lib/model/message.dart NoteMsg.format()：
 *     id = int.tryParse(params["id"] ?? "0")
 *     title = params["title"] ?? ""
 *     images = json.decode(params["images"] ?? "{}") as List<String>
 *     title 非空（isNotNullOrEmpty）即视为 V2（内容自包含）；只有 id 是 V1（需服务端拉取）。
 *
 * 本模块只做纯解析，不做 URL 改写：缩略图 <img src> 由全局 avatarSrcRewrite 统一走
 * /oss-cdn 代理（含点击后的全屏预览），与 EMOJI/BIDIRECTIONAL 解析工具职责一致。
 */
import type { UiMessage } from '@easemob-community/uikit-im'

import { getCustomEvent } from './customMessage'

/** 笔记/收藏消息的 event 标识（对齐 Flutter case "note" / MsgType.note.name） */
export const NOTE_EVENT = 'note'

/** 是否为笔记/收藏消息：custom 类型且 event === 'note' */
export function isNoteMessage(message: UiMessage): boolean {
  return getCustomEvent(message) === NOTE_EVENT
}

export interface NoteView {
  /** 笔记 ID（对齐 Dart int.tryParse，解析失败为 0） */
  id: number
  /** 笔记标题 */
  title: string
  /** 缩略图 URL 列表（params.images 为 JSON 数组字符串） */
  images: string[]
  /** V2：标题非空、内容自包含；V1：只有 id，需服务端拉取（Web 端无接口，降级展示） */
  isV2: boolean
}

/** 对齐 Dart int.tryParse：仅纯整数字符串可解析，否则 0 */
function tryParseInt(value: string | undefined): number {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return 0
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? 0 : n
}

/** 解析 params.images：JSON 数组字符串 → 仅保留非空字符串，解析失败返回空数组 */
function parseImages(raw: string | undefined): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

/**
 * 解析笔记消息内容。
 * UIKit 的 CustomMessageBody.params 为 Record<string, string>，
 * 与 Flutter 按字符串读取 params 一致（images 在发送端已 json.encode）。
 */
export function getNoteView(message: UiMessage): NoteView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
  const title = typeof params.title === 'string' ? params.title : ''
  return {
    id: tryParseInt(params.id),
    title,
    images: parseImages(params.images),
    // 对齐 Dart title.isNotNullOrEmpty：非空字符串即 V2
    isV2: title.length > 0,
  }
}
