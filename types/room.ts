export type RoomRole = 'owner' | 'admin' | 'player' | 'pending'

export interface RoomMemberPermissionContext {
  role: RoomRole
  userId: string
}
