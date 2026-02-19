import { RoomRole } from './roles'
import { canManageRoom } from './clubPermissions'

interface DeleteVotingSlotParams {
  actorRole?: RoomRole | null
  actorUserId?: string | null
  slotUserId?: string | null
  slotAddedByUserId?: string | null
}

export const canDeleteVotingSlot = ({
  actorRole,
  actorUserId,
  slotUserId,
  slotAddedByUserId,
}: DeleteVotingSlotParams) => {
  if (canManageRoom(actorRole)) return true
  if (!actorUserId) return false
  return slotUserId === actorUserId || slotAddedByUserId === actorUserId
}
