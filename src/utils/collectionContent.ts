/**
 * 收藏内容解析工具（移植自 iron_chat 的 TextCollection / LinkCollection / FileCollection /
 * LocationCollection / MediaCollection / NoteCollection）。
 *
 * 服务端存的 `content` 是 JSON 字符串，各类型结构固定；本模块统一解析为扁平对象供 UI 渲染。
 * 不改写图片 URL —— <img src> 由全局 avatarSrcRewrite 统一走 /oss-cdn 代理。
 */
import type { CollectionItem } from '@/api/collection'

export interface CollectionContent {
  /** 文本 / 笔记正文摘要 */
  text: string
  url: string
  desc: string
  filename: string
  size: number
  /** 位置 */
  name: string
  address: string
  latitude: number
  longitude: number
  /** 图片 / 视频 */
  thumb: string
  width: number
  height: number
  duration: number
  /** 笔记内的图片 / 视频封面 */
  images: string[]
}

function emptyContent(): CollectionContent {
  return {
    text: '',
    url: '',
    desc: '',
    filename: '',
    size: 0,
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    thumb: '',
    width: 0,
    height: 0,
    duration: 0,
    images: [],
  }
}

type JsonRecord = Record<string, unknown>

function parseJson(raw: string): JsonRecord {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {}
  } catch {
    return {}
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return 0
}

/** 是否为可访问的图片地址（笔记 delta 里可能直接是 URL 或已编码的 JSON 字符串） */
function isImageUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith('data:image/')
}

/**
 * 解析笔记 Quill Delta 中的图片 / 视频封面。
 * 对齐 Flutter NoteCollection._parseImages：`{"insert":{"image":"<json>","video":"<json>"}}`
 * 中取 `image.thumbnail` / `video.image`。
 */
function parseNoteImages(raw: string): string[] {
  const ops = (parseJson(raw).ops ?? []) as unknown
  if (!Array.isArray(ops)) return []

  const images: string[] = []
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue
    const insert = (op as JsonRecord).insert
    if (!insert || typeof insert !== 'object') continue
    const item = insert as JsonRecord

    if (typeof item.image === 'string' && item.image) {
      const parsed = parseJson(item.image)
      const thumb = str(parsed.thumbnail || parsed.url || parsed.src)
      const url = isImageUrl(thumb) ? thumb : isImageUrl(item.image) ? item.image : ''
      if (url) images.push(url)
    }
    if (typeof item.video === 'string' && item.video) {
      const parsed = parseJson(item.video)
      const poster = str(parsed.image || parsed.thumb || parsed.thumbnail)
      if (isImageUrl(poster)) images.push(poster)
    }
  }
  return images
}

/** 生成笔记摘要：拼接 delta 中的文字，图片/视频/文件/地图追加占位符，最多 64 字（对齐 App） */
function parseNoteText(raw: string): string {
  const ops = (parseJson(raw).ops ?? []) as unknown
  if (!Array.isArray(ops)) return ''

  let text = ''
  for (const op of ops) {
    if (text.length >= 64) break
    if (!op || typeof op !== 'object') continue
    const insert = (op as JsonRecord).insert
    if (typeof insert === 'string') {
      text += insert
      continue
    }
    if (!insert || typeof insert !== 'object') continue
    const item = insert as JsonRecord
    if (item.image) text += '[图片]'
    else if (item.video) text += '[视频]'
    else if (item.file) text += '[文件]'
    else if (item.map) text += '[地图]'
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 64)
}

/** 解析收藏项的 content JSON 为渲染友好结构 */
export function parseCollectionContent(item: CollectionItem): CollectionContent {
  const result = emptyContent()
  const json = parseJson(item.content)

  switch (item.type) {
    case 'text':
      result.text = str(json.text)
      break
    case 'link':
      result.url = str(json.url)
      result.desc = str(json.desc)
      break
    case 'file':
      result.url = str(json.url)
      result.filename = str(json.filename)
      result.size = num(json.size)
      break
    case 'location':
      result.latitude = num(json.latitude)
      result.longitude = num(json.longitude)
      result.address = str(json.address)
      result.name = str(json.name)
      break
    case 'image':
    case 'video':
      result.url = str(json.url)
      result.thumb = str(json.thumb)
      result.width = num(json.width)
      result.height = num(json.height)
      result.duration = num(json.duration)
      break
    case 'note':
      result.text = parseNoteText(item.content)
      result.images = parseNoteImages(item.content)
      break
    default:
      break
  }
  return result
}

/** 兼容 "YYYY-MM-DD HH:mm:ss" / ISO / 秒级或毫秒级时间戳字符串 */
function parseDate(input: string): Date | null {
  if (!input) return null
  if (/^-?\d+$/.test(input.trim())) {
    const n = Number(input.trim())
    const ms = Math.abs(n) < 1e12 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(input.trim())
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
      Number(match[6] ?? 0),
    )
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 列表时间展示（对齐 Flutter TimeUtils.formatDisplayByStr2）：
 * 当天 HH:mm、昨天「昨天 HH:mm」、更早 MM-dd HH:mm。
 */
export function formatCollectionTime(createdAt: string, now = new Date()): string {
  const d = parseDate(createdAt)
  if (!d) return ''
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (days === 0) return hm
  if (days === 1) return `昨天 ${hm}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

/** 文件大小（对齐 Flutter FileUtils.convertBytesToString，保留 2 位小数） */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`
}
