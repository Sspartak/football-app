import { isAdminRole, isOwnerRole, isPendingRole, RoomRole } from './roles'

export const canManageRoom = (role?: RoomRole | null) => isOwnerRole(role) || isAdminRole(role)

export const canInteractAsPlayer = (role?: RoomRole | null) =>
  isOwnerRole(role) || isAdminRole(role) || role === 'player'

export const isApprovedMember = (role?: RoomRole | null) => !!role && !isPendingRole(role)

export const canApprovePendingMember = (role?: RoomRole | null) => canManageRoom(role)

export const canPromoteToAdmin = (role?: RoomRole | null, targetRole?: RoomRole | null) =>
  canManageRoom(role) && targetRole === 'player'

export const canDemoteAdmin = (role?: RoomRole | null, targetRole?: RoomRole | null) =>
  canManageRoom(role) && targetRole === 'admin'

export const canDeleteMember = (
  role?: RoomRole | null,
  targetRole?: RoomRole | null,
  isSelf = false
) => canManageRoom(role) && !isSelf && targetRole !== 'owner'

export const canLeaveRoom = (role?: RoomRole | null) => role !== 'owner'
