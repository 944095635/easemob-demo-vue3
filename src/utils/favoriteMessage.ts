/**
 * 聊天消息 → 收藏 payload（移植自 iron_chat：
 * - lib/page/chat/chat_page_logic.dart::onTapCollection 分派；
 * - lib/helper/message_helper.dart::collect{Text,Image,Video,File,Location,Note,Card}；
 * - lib/page/collection/model/collection.dart 各 *Collection.format）。
 *
 * 与 App 的差异：Web 端不下载、不上传文件到自有 OSS。图片 / 视频 / 文件直接把消息体里
 * 的远端原始 URL 写进 content（App 是从聊天消息拿到本地文件再上传，Web 没有本地文件概念）。
 * 因此本模块是纯同步转换，不依赖 uploader / downloader。
 *
 * App 规则（保留）：
 * - 可收藏类型：text / image / video / file / location / note / card / emoji；
 * - 不显示「收藏」菜单项：voice / card（message_item.dart:637-649）；
 *   实际分派里 emoji 走独立的 /emoji 接口，card 走 type=chat + title。
 * - text 若内容是 http/https URL → 收藏为 link（desc 固定「网址」），否则 text；
 * - 图片：原图 + 缩略图地址都写入 content；
 * - 视频：视频地址必填，缩略图缺省为空；duration 有值才写该 key；
 * - 文件：filename 用消息显示名，size 用消息体里的文件字节数；
 * - note：不传 content，服务端按 source_id fork；card：type=chat + title，无 content。
 */
import type { UiMessage } from '@easemob-community/uikit-im'

import type { CreateCollectionPayload } from '@/api/collection'
import { getCustomEvent } from './customMessage'
import { getNoteView } from './noteMessage'

/** 收藏结果：普通收藏返回 payload；emoji 走独立接口，返回 emojiUrl */
export interface CollectionFromMessage {
  kind: 'text' | 'link' | 'image' | 'video' | 'file' | 'location' | 'note' | 'card' | 'emoji'
  payload?: CreateCollectionPayload
  emojiUrl?: string
}

type BodyRecord = Record<string, unknown>

function bodyOf(message: UiMessage): BodyRecord {
  return (message.body && typeof message.body === 'object' ? message.body : {}) as BodyRecord
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return 0
}

/** 对齐 Dart Uri.parse(trim).isScheme('HTTP'/'HTTPS') */
function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 兼容 SDK 各版本的文件大小字段：body.size / body.fileSize / body.file_size / body.file.size */
function fileSizeOf(body: BodyRecord): number {
  const file = body.file && typeof body.file === 'object' ? (body.file as BodyRecord) : {}
  return num(body.size ?? body.fileSize ?? body.file_size ?? file.size)
}

/**
 * 是否对该消息展示「收藏」菜单项（对齐 App message_item.dart:637-649）。
 *
 * App 菜单条件只有一条：`message.type != .voice && message.type != .card`，
 * 即：语音、名片不显示收藏，其余类型（text/image/video/file/location/note/emoji 等）都显示。
 * Web 端没有 App 的 MsgType.card 原生名片类型，名片以 custom 的 card/userCard event 表达
 * （cardMessage.ts），这里一并视作名片排除。bidirectional/groupInviteV1/notice 等自定义消息
 * 对应 App 的 bidirectional/groupInvite/system/tips——App 分派里无 collect 分支，点了无反应，
 * 故同样不展示收藏。
 */
export function canCollectMessage(message: UiMessage): boolean {
  const type = message.type as string
  // 语音、原生名片消息不显示（App: type != voice && type != card）
  if (type === 'voice' || type === 'card') return false
  if (type === 'text' || type === 'image' || type === 'video' || type === 'file' || type === 'location') {
    return true
  }
  if (type === 'custom') {
    const event = getCustomEvent(message)
    // 仅笔记 / 表情可收藏；名片(card/userCard)在 App 属 MsgType.card 被菜单排除，
    // 群邀请/系统提示/双向消息在 App 分派里无 collect 分支，均不显示收藏。
    return event === 'note' || event === 'emoji'
  }
  return false
}

/** 把消息转成收藏。全部为同步转换；不支持的消息返回 null（UI 不会显示菜单项）。 */
export function buildCollectionFromMessage(message: UiMessage): CollectionFromMessage | null {
  const body = bodyOf(message)
  const type = message.type as string

  // 文本：URL → link（desc 固定「网址」），否则 text
  if (type === 'text') {
    const text = str(body.content)
    if (isHttpUrl(text)) {
      return {
        kind: 'link',
        payload: { type: 'link', content: JSON.stringify({ url: text, desc: '网址' }) },
      }
    }
    return { kind: 'text', payload: { type: 'text', content: JSON.stringify({ text }) } }
  }

  // 位置：对齐 LocationCollection.format
  if (type === 'location') {
    return {
      kind: 'location',
      payload: {
        type: 'location',
        content: JSON.stringify({
          latitude: num(body.latitude),
          longitude: num(body.longitude),
          address: str(body.address),
          name: str(body.buildingName),
        }),
      },
    }
  }

  // 图片：原图 + 缩略图都用消息体里的原始地址（无上传）
  if (type === 'image') {
    const url = str(body.originalImageUrl || body.bigImageUrl || body.url || body.localUrl)
    if (!url) throw new Error('图片地址为空，无法收藏')
    const thumb = str(body.thumbnailUrl || body.bigImageUrl || url)
    const content: Record<string, unknown> = {
      url,
      thumb,
      width: num(body.width),
      height: num(body.height),
    }
    return { kind: 'image', payload: { type: 'image', content: JSON.stringify(content) } }
  }

  // 视频：视频本体地址必填，缩略图缺省为空；duration 有值才写该 key（无上传）
  if (type === 'video') {
    const url = str(body.url)
    if (!url) throw new Error('视频地址为空，无法收藏')

    const content: Record<string, unknown> = {
      url,
      thumb: str(body.thumbnailUrl),
      width: num(body.width),
      height: num(body.height),
    }
    const duration = num(body.duration)
    if (duration) content.duration = duration
    return { kind: 'video', payload: { type: 'video', content: JSON.stringify(content) } }
  }

  // 文件：直接用消息体里的原始地址，filename 用显示名、size 用消息体里的字节数（无上传）
  if (type === 'file') {
    const url = str(body.url)
    if (!url) throw new Error('文件地址为空，无法收藏')

    const file = body.file && typeof body.file === 'object' ? (body.file as BodyRecord) : {}
    const filename = str(body.filename || file.filename || file.name || file.displayName) || 'file'
    return {
      kind: 'file',
      payload: {
        type: 'file',
        content: JSON.stringify({ url, filename, size: fileSizeOf(body) }),
      },
    }
  }

  // 自定义消息：note 走服务端 fork；card/userCard 走 type=chat + title；emoji 走独立接口
  if (type === 'custom') {
    const event = getCustomEvent(message)
    if (event === 'note') {
      const note = getNoteView(message)
      return {
        kind: 'note',
        payload: {
          type: 'note',
          title: note.title,
          source_id: String(note.id),
          source_type: 'note',
        },
      }
    }
    if (event === 'emoji') {
      const params = (body.params ?? {}) as Record<string, string>
      return { kind: 'emoji', emojiUrl: str(params.url) }
    }
    if (event === 'card' || event === 'userCard') {
      const params = (body.params ?? {}) as Record<string, string>
      return { kind: 'card', payload: { type: 'chat', title: str(params.name) } }
    }
  }

  return null
}
