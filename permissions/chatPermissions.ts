import { RoomRole } from './roles'
import { isApprovedMember } from './clubPermissions'

export const canSendChatMessage = (role?: RoomRole | null) => isApprovedMember(role)
