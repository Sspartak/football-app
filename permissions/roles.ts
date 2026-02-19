export const ROOM_ROLES = ['owner', 'admin', 'player', 'pending'] as const

export type RoomRole = (typeof ROOM_ROLES)[number]

export const isOwnerRole = (role?: string | null): role is 'owner' => role === 'owner'
export const isAdminRole = (role?: string | null): role is 'admin' => role === 'admin'
export const isPlayerRole = (role?: string | null): role is 'player' => role === 'player'
export const isPendingRole = (role?: string | null): role is 'pending' => role === 'pending'
