/**
 * 自有服务端收藏接口（迁移自 Flutter `lib/api/collection_api.dart` 的 CollectionApi2）。
 *
 * - GET  /api/collections/recent?page&page_size                     最近使用
 * - GET  /api/collections?type&page&page_size&keyword               按分类查询（type 可为逗号分隔多类型）
 * - GET  /api/collection/{id}                                       收藏详情
 * - DELETE /api/collection/{id}                                     删除收藏
 *
 * 请求头：X-Sign / X-Timestamp / Authorization / platform / version（见 requestSign.ts）；
 * GET 的 query 参数参与签名（key 字典序拼接），与 Flutter NetClient 一致。
 * 成功判断由 request.ts 统一处理（code !== 0 抛错）；本模块只负责发请求与字段解析。
 *
 * 注意：App 的收藏 `content` 是 JSON 字符串，各类型结构由 utils/collectionContent.ts 解析。
 */
import { http } from '@/api/request'
import { createRequestSignHeaders } from '@/utils/requestSign'

/** 生产 baseURL 是域名（需带 /api）；dev baseURL 是 /api（代理保留前缀，不再重复拼） */
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

function apiPath(path: string): string {
  return `${BASE_HAS_API_PREFIX ? '' : '/api'}${path}`
}

/** 收藏类型（对齐 Flutter CollectionCategory 中可落到 content 的具体 type） */
export type CollectionType = 'text' | 'link' | 'image' | 'video' | 'file' | 'location' | 'note'

/** 页面顶部分类（对齐 Flutter CollectionCategory.displayTypes） */
export type CollectionCategory = 'recent' | 'note' | 'chat' | 'media' | 'file' | 'location'

/**
 * 分类 -> 服务端 type 参数。
 * 对齐 App：`chat` 查 `text,link`，`media` 查 `image,video`（逗号分隔多类型），`recent` 走独立接口。
 */
export const CATEGORY_TYPES: Record<CollectionCategory, string> = {
  recent: '',
  note: 'note',
  chat: 'text,link',
  media: 'image,video',
  file: 'file',
  location: 'location',
}

/** 收藏项（对齐 Flutter Collection.fromJson） */
export interface CollectionItem {
  id: number
  title: string
  content: string
  type: CollectionType
  sourceType: string
  sourceId: string
  lastUsedAt: string
  createdAt: string
}

export interface CollectionPage {
  list: CollectionItem[]
  total: number
}

type RawRecord = Record<string, unknown>

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return 0
}

function parseItem(raw: RawRecord): CollectionItem {
  return {
    id: toNumber(raw.id),
    title: toStr(raw.title),
    content: toStr(raw.content),
    type: toStr(raw.type) as CollectionType,
    sourceType: toStr(raw.source_type),
    sourceId: toStr(raw.source_id),
    lastUsedAt: toStr(raw.last_used_at),
    createdAt: toStr(raw.created_at),
  }
}

/** 兼容 { list: [...] } 与直接数组两种返回（与 friend.ts 的分页解析保持一致） */
function parsePage(data: unknown): CollectionPage {
  const raw = ((data ?? {}) as RawRecord) ?? {}
  const list = Array.isArray(raw.list)
    ? raw.list
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  return {
    list: list
      .filter((item): item is RawRecord => !!item && typeof item === 'object')
      .map(parseItem),
    total: toNumber(raw.total),
  }
}

/** 最近使用：GET /api/collections/recent */
export async function getRecentCollections(page: number, pageSize = 20): Promise<CollectionPage> {
  const params = { page, page_size: pageSize }
  const data = await http.get<unknown>(apiPath('/collections/recent'), {
    params,
    headers: createRequestSignHeaders(params),
  })
  return parsePage(data)
}

/** 按分类查询：GET /api/collections（keyword 非空才参与请求与签名） */
export async function getCollections(
  category: CollectionCategory,
  page: number,
  keyword = '',
  pageSize = 20,
): Promise<CollectionPage> {
  const params: Record<string, string | number> = {
    type: CATEGORY_TYPES[category],
    page,
    page_size: pageSize,
  }
  if (keyword.trim()) params.keyword = keyword.trim()

  const data = await http.get<unknown>(apiPath('/collections'), {
    params,
    headers: createRequestSignHeaders(params),
  })
  return parsePage(data)
}

/** 收藏详情：GET /api/collection/{id} */
export async function getCollection(id: number): Promise<CollectionItem | null> {
  if (!id || !Number.isFinite(id)) return null
  const data = await http.get<unknown>(apiPath(`/collection/${id}`), {
    headers: createRequestSignHeaders(),
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return parseItem(data as RawRecord)
}

/** 删除收藏：DELETE /api/collection/{id}（对齐 Flutter CollectionApi2.deleteCollection） */
export async function deleteCollection(id: number): Promise<void> {
  if (!id || !Number.isFinite(id)) throw new Error('收藏 ID 无效')
  await http.delete<void>(apiPath(`/collection/${id}`), {
    headers: createRequestSignHeaders(),
  })
}
