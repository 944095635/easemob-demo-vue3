/**
 * 自有服务端收藏接口（迁移自 Flutter `lib/api/collection_api.dart` 的 CollectionApi2）。
 *
 * - GET  /api/collections/recent?page&page_size                     最近使用
 * - GET  /api/collections?type&page&page_size&keyword               按分类查询（type 可为逗号分隔多类型）
 * - GET  /api/collection/{id}                                       收藏详情
 * - POST /api/collection                                            新增收藏（消息→收藏）
 * - DELETE /api/collection/{id}                                     删除收藏
 * - GET  /api/common/oss-policy                                     OSS 上传凭证
 * - POST /api/emoji                                                 收藏自定义表情
 *
 * 请求头：X-Sign / X-Timestamp / Authorization / platform / version（见 requestSign.ts）；
 * GET 的 query 参数、POST 的 body 参数都参与签名（与 Flutter NetClient 一致）。
 * 成功判断由 request.ts 统一处理（code !== 0 抛错）；本模块只负责发请求与字段解析。
 *
 * 注意：App 的收藏 `content` 是 JSON 字符串，各类型结构由 utils/collectionContent.ts 解析、
 * utils/favoriteMessage.ts 组装。**Web 收藏不使用 OSS 上传**：图片/视频/文件直接存消息体里的
 * 原始地址（见下方 OSS 段落说明）。
 */
import { http } from '@/api/request'
import { DEFAULT_CDN_HOST, applyOssAccess } from '@/utils/ossAccess'
import { createRequestSignHeaders } from '@/utils/requestSign'

/** 生产 baseURL 是域名（需带 /api）；dev baseURL 是 /api（代理保留前缀，不再重复拼） */
const BASE_HAS_API_PREFIX = /(?:^|\/)api\/?$/.test(import.meta.env.VITE_API_BASE_URL || '')

function apiPath(path: string): string {
  return `${BASE_HAS_API_PREFIX ? '' : '/api'}${path}`
}

/**
 * 收藏类型（对齐 Flutter CollectionCategory 中可落到 content 的具体 type）。
 * `chat` 用于收藏名片（App collectCard 传 type=chat + title，无 content）。
 */
export type CollectionType = 'text' | 'link' | 'image' | 'video' | 'file' | 'location' | 'note' | 'chat'

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

/**
 * 新增收藏（对齐 Flutter CollectionApi2.addCollection）。
 * App 的 Dart null-aware entry 会在值为 null 时省略该 key，这里同样只发送有值的字段；
 * body 参数参与签名（key 字典序拼接）。
 */
export interface CreateCollectionPayload {
  type: CollectionType
  content?: string
  title?: string
  source_id?: string
  source_type?: string
}

export async function createCollection(payload: CreateCollectionPayload): Promise<void> {
  const body: Record<string, string> = { type: payload.type }
  if (payload.content !== undefined) body.content = payload.content
  if (payload.title !== undefined) body.title = payload.title
  if (payload.source_id !== undefined) body.source_id = payload.source_id
  if (payload.source_type !== undefined) body.source_type = payload.source_type
  await http.post<void>(apiPath('/collection'), body, {
    headers: createRequestSignHeaders(body),
  })
}

/** 收藏自定义表情：POST /api/emoji { url }（对齐 Flutter CollectionApi2.addCustomEmoji） */
export async function addCustomEmoji(url: string): Promise<void> {
  if (!url) throw new Error('表情地址为空')
  const body = { url }
  await http.post<void>(apiPath('/emoji'), body, {
    headers: createRequestSignHeaders(body),
  })
}

/* ===== 自有 OSS 上传（移植 Flutter UploadHelper：先取 policy 再直传 OSS） =====
 * 说明：Web 端「消息收藏」不再走上传（直接用消息原始地址），以下上传能力保留给其它需要
 * 把本地文件落到自有 OSS 的场景使用，收藏链路不调用。
 */

/** OSS 上传凭证（对齐 Flutter UploadOssData.fromJson） */
export interface OssPolicy {
  accessKeyId: string
  policy: string
  signature: string
  host: string
  expire: number
  paths: { collection: string; [key: string]: unknown }
  publicBase: string
  referer: string
}

let cachedOssPolicy: OssPolicy | null = null

function parseOssPolicy(raw: RawRecord): OssPolicy {
  const paths = (raw.paths && typeof raw.paths === 'object' ? raw.paths : {}) as RawRecord
  return {
    accessKeyId: toStr(raw.access_key_id),
    policy: toStr(raw.policy),
    signature: toStr(raw.signature),
    host: toStr(raw.host),
    expire: toNumber(raw.expire),
    paths: { ...paths, collection: toStr(paths.collection) },
    publicBase: toStr(raw.public_base),
    referer: toStr(raw.referer),
  }
}

/**
 * 获取 OSS PostObject 凭证：GET /api/common/oss-policy（对齐 Flutter SystemApi.getOssPolicy）。
 * 内存缓存并在到期前 30 秒失效（App 的 UploadHelper.getOssToken 同样做了缓存）。
 * 同时把 publicBase / referer 应用到读链路（applyOssAccess），让上传后的图片能正常显示。
 */
export async function getOssPolicy(): Promise<OssPolicy | null> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedOssPolicy && cachedOssPolicy.expire - 30 > now && cachedOssPolicy.host) {
    return cachedOssPolicy
  }

  const data = await http.get<unknown>(apiPath('/common/oss-policy'), {
    headers: createRequestSignHeaders(),
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  cachedOssPolicy = parseOssPolicy(data as RawRecord)
  applyOssAccess({ publicBase: cachedOssPolicy.publicBase, referer: cachedOssPolicy.referer })
  return cachedOssPolicy
}

/** 仅供测试隔离：清空凭证缓存 */
export function clearOssPolicyCache(): void {
  cachedOssPolicy = null
}

export interface OssUploadResult {
  /** OSS 相对路径（写进收藏 content 的 url/thumb） */
  filePath: string
  /** CDN 完整地址 */
  fileUrl: string
  fileName: string
}

/**
 * 直传文件到 OSS（对齐 Flutter UploadHelper.uploadFile + NetClient.uploadFile）：
 * - key = policy.paths.collection + fileName；
 * - multipart 字段：key / policy / success_action_status=200 / signature / OSSAccessKeyId / file；
 * - 成功判定只看 HTTP 200（OSS PostObject 成功响应 200），不解析响应体；
 * - filePath 是相对路径（key），fileUrl 是 publicBase + key。
 */
export async function uploadToOss(fileName: string, blob: Blob): Promise<OssUploadResult> {
  const policy = await getOssPolicy()
  if (!policy?.host || !policy.paths.collection) throw new Error('获取上传配置失败')

  const filePath = `${policy.paths.collection}${fileName}`
  const form = new FormData()
  form.append('key', filePath)
  form.append('policy', policy.policy)
  form.append('success_action_status', '200')
  form.append('signature', policy.signature)
  form.append('OSSAccessKeyId', policy.accessKeyId)
  form.append('file', blob, fileName)

  const response = await fetch(policy.host, { method: 'POST', body: form })
  if (response.status !== 200) throw new Error('文件上传失败')

  const base = (policy.publicBase || `https://${DEFAULT_CDN_HOST}`).replace(/\/+$/, '')
  return {
    filePath,
    fileUrl: `${base}/${filePath.replace(/^\/+/, '')}`,
    fileName,
  }
}
