export interface Room {
    id: string
    name: string
    admin_id: string
    created_at: string
}

export interface Member {
    id: string
    room_id: string
    user_id: string
    nickname: string
    first_name?: string
    last_name?: string
    approved: boolean
    role: 'owner' | 'admin' | 'player' | 'pending'
    created_at: string
}

export interface Match {
    id: string
    room_id: string
    address: string
    match_date: string
    start_time: string
    end_time: string | null
    max_players: number
    team_limit?: number | null
    game_format?: number | null
    match_type?: 'match' | 'teams'
    cost?: number | null
    cost_payer?: 'player' | 'team' | null
    status: 'voting' | 'teams_distributed' | string
    created_at: string
}

export interface Slot {
    id: string
    match_id: string
    user_id: string | null
    nickname: string
    status: 'go' | 'reserve' | 'not_go'
    desire?: 'going' | 'reserve' | 'not_going' | null
    reserve_position?: number | null
    team_id?: string | null
    added_by_user_id?: string | null
    added_by_nickname?: string | null
    created_at: string
}

export interface Team {
    id: string
    match_id?: string
    name: string
    players: Slot[]
    display_order?: number
    created_by_user_id?: string | null
    captain_user_id?: string | null
    color_json?: {
        text: string
        bg: string
        label: string
    }
}

export interface Message {
    id: string
    room_id: string
    user_id: string
    nickname: string
    content: string
    created_at: string
}
