import { supabase } from '@/lib/supabase/client'
import { VotingDesire } from '../constants/statuses'
import { VotingMatchState, VotingSlotRecord } from '../models/voting.models'

const getMatchState = async (matchId: string): Promise<VotingMatchState> => {
  const { data, error } = await supabase
    .from('matches')
    .select('id, max_players, voting_full_limit_achieved')
    .eq('id', matchId)
    .single()

  if (error) throw error
  return data as VotingMatchState
}

const getSlots = async (matchId: string): Promise<VotingSlotRecord[]> => {
  const { data, error } = await supabase
    .from('match_slots')
    .select('id, match_id, user_id, nickname, status, desire, reserve_position, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as VotingSlotRecord[]
}

const getUserSlot = async (matchId: string, userId: string) => {
  const { data, error } = await supabase
    .from('match_slots')
    .select('id, match_id, user_id, nickname, status, desire, reserve_position, created_at')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data || null) as VotingSlotRecord | null
}

const getSlotById = async (slotId: string) => {
  const { data, error } = await supabase
    .from('match_slots')
    .select('id, match_id, user_id, nickname, status, desire, reserve_position, created_at')
    .eq('id', slotId)
    .maybeSingle()

  if (error) throw error
  return (data || null) as VotingSlotRecord | null
}

const upsertUserDesire = async (params: {
  matchId: string
  userId: string
  nickname: string
  desire: VotingDesire
  initialStatus?: VotingSlotRecord['status']
}) => {
  const existing = await getUserSlot(params.matchId, params.userId)
  if (existing) {
    const { error } = await supabase
      .from('match_slots')
      .update({ desire: params.desire })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('match_slots').insert({
    match_id: params.matchId,
    user_id: params.userId,
    nickname: params.nickname,
    status:
      params.initialStatus ||
      (params.desire === 'not_going' ? 'not_go' : 'reserve'),
    desire: params.desire,
    reserve_position: null,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
}

const updateSlotState = async (
  slotId: string,
  patch: Partial<
    Pick<VotingSlotRecord, 'status' | 'desire' | 'reserve_position' | 'created_at'>
  >
) => {
  const { error } = await supabase.from('match_slots').update(patch).eq('id', slotId)
  if (error) throw error
}

const removeUserSlot = async (matchId: string, userId: string) => {
  const { error } = await supabase
    .from('match_slots')
    .delete()
    .eq('match_id', matchId)
    .eq('user_id', userId)
  if (error) throw error
}

const removeSlotById = async (slotId: string) => {
  const { error } = await supabase.from('match_slots').delete().eq('id', slotId)
  if (error) throw error
}

const updateFullLimitAchieved = async (matchId: string, value: boolean) => {
  const { error } = await supabase
    .from('matches')
    .update({ voting_full_limit_achieved: value })
    .eq('id', matchId)
  if (error) throw error
}

export const votingRepository = {
  getMatchState,
  getSlots,
  getUserSlot,
  getSlotById,
  upsertUserDesire,
  updateSlotState,
  removeUserSlot,
  removeSlotById,
  updateFullLimitAchieved,
}
