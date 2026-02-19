import { RoomRole } from './roles'
import { canManageRoom } from './clubPermissions'

export const canManageGames = (role?: RoomRole | null) => canManageRoom(role)
