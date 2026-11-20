/**
 * 用户信息来源（对齐 Flutter UserSourceType）。
 *
 * Flutter 提交好友申请时传 `source`（不是 `value`），且不同入口的 value/source 可能不同：
 * 例如 contact/chat/card/circle/friendRequest/groupRequest 都传 "card"。
 * 搜索结果由服务端返回 source 值，Web 端原样透传；页面展示用 name（i18n key）。
 */
export interface FriendSource {
  value: string
  /** 中文名对应的 i18n key */
  labelKey: string
  /** 提交给服务端的 source 值 */
  source: string
}

const FRIEND_SOURCES: FriendSource[] = [
  { value: 'unknown', labelKey: 'contacts.source.unknown', source: '' },
  { value: 'contact', labelKey: 'contacts.source.contact', source: 'card' },
  { value: 'qrcode', labelKey: 'contacts.source.qrcode', source: 'qrcode' },
  { value: 'search_chat_id', labelKey: 'contacts.source.searchChatId', source: 'search_chat_id' },
  { value: 'search_mobile', labelKey: 'contacts.source.searchMobile', source: 'search_mobile' },
  { value: 'chat', labelKey: 'contacts.source.chat', source: 'card' },
  { value: 'group', labelKey: 'contacts.source.group', source: 'group' },
  { value: 'card', labelKey: 'contacts.source.card', source: 'card' },
  { value: 'circle', labelKey: 'contacts.source.circle', source: 'card' },
  { value: 'friend_request', labelKey: 'contacts.source.friendRequest', source: 'card' },
  { value: 'group_request', labelKey: 'contacts.source.groupRequest', source: 'card' },
]

/** 按 value 或 source 查找来源；未知值回退 unknown（对齐 Dart firstWhere orElse） */
export function resolveFriendSource(value?: string): FriendSource {
  if (!value) return FRIEND_SOURCES[0]
  return FRIEND_SOURCES.find((item) => item.value === value || item.source === value) ?? FRIEND_SOURCES[0]
}

/** 已知来源的 value 列表，用于路由 query 校验 */
export const FRIEND_SOURCE_VALUES = FRIEND_SOURCES.map((item) => item.value)
