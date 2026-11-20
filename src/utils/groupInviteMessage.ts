/**
 * 群邀请消息（event === 'groupInviteV1'）解析工具。
 *
 * 移植自 iron_chat：
 * - lib/helper/message_helper.dart：CUSTOM 消息按 event === 'groupInviteV1' 识别为 GroupInviteMsg；
 * - lib/model/message.dart GroupInviteMsg.format()/parseExtension() 从 params 读取：
 *     groupName = params["groupName"]        // 群名称（卡片/详情展示）
 *     groupAvatar = params["groupAvatar"]    // 群头像 URL
 *     memberCount = params["memberCount"]    // 群人数（字符串）
 *     inviterId = int.tryParse(params["inviteId"] ?? "")  // 群邀请业务 ID（处理接口用）
 *     inviterNickname = params["inviterNickname"]         // 邀请人昵称
 * - lib/page/chat/message/render/message_groupinvite_render.dart：卡片显示
 *     "邀请你加入群聊" / "邀请你加入群聊《{群名}》" + 44px 圆角群头像；
 * - lib/page/chat/chat_page.dart 点击 → GroupInvitePage.toByMessage → 群邀请详情页，
 *   同意/拒绝调 POST group-invite/handle { invite_id, action: accept|reject }。
 *
 * 本模块只做纯解析；头像 <img src> 由全局 avatarSrcRewrite 统一走 /oss-cdn 代理。
 */
import { getCustomEvent } from './customMessage'
import type { UiMessage } from '@easemob-community/uikit-im'

/** 群邀请 event（对齐 Flutter case "groupInviteV1"） */
export const GROUP_INVITE_EVENT = 'groupInviteV1'

/** 是否为群邀请消息 */
export function isGroupInviteMessage(message: UiMessage): boolean {
  return getCustomEvent(message) === GROUP_INVITE_EVENT
}

/** 对齐 Dart int.tryParse：仅纯整数字符串可解析，否则 0 */
function tryParseInt(value: string | undefined): number {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return 0
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? 0 : n
}

function str(value: string | undefined): string {
  return typeof value === 'string' ? value : ''
}

export interface GroupInviteView {
  /** 群名称 */
  groupName: string
  /** 群头像 URL，缺失为空串 */
  groupAvatar: string
  /** 群人数（原样字符串） */
  memberCount: string
  /** 邀请业务 ID（对齐 inviterId = int.tryParse(params["inviteId"])），无效为 0 */
  inviteId: number
  /** 邀请人昵称 */
  inviterNickname: string
  /** 邀请是否已失效（inviteId <= 0，无法调用处理接口） */
  expired: boolean
}

/** 解析群邀请消息内容（params 为 Record<string, string>） */
export function getGroupInviteView(message: UiMessage): GroupInviteView {
  const params =
    (message.body as { params?: Record<string, string> } | undefined)?.params ?? {}
  const inviteId = tryParseInt(params.inviteId)
  return {
    groupName: str(params.groupName),
    groupAvatar: str(params.groupAvatar),
    memberCount: str(params.memberCount),
    inviteId,
    inviterNickname: str(params.inviterNickname),
    expired: inviteId <= 0,
  }
}
