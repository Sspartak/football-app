import { DbVotingStatus, VotingDesire } from '../constants/statuses'

export interface VotingSlotRecord {
  id: string
  match_id: string
  user_id: string | null
  nickname: string
  status: DbVotingStatus
  desire?: VotingDesire | null
  reserve_position?: number | null
  created_at: string
}

export interface VotingMatchState {
  id: string
  max_players?: number | null
  voting_full_limit_achieved?: boolean | null
}
