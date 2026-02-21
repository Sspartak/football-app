import {
  DB_VOTING_STATUSES,
  VOTING_DESIRES,
  VOTING_GOING_LIMIT,
  VotingDesire,
} from '../constants/statuses'
import { VotingSlotRecord } from '../models/voting.models'
import { votingRepository } from '../repositories/voting.repository'
import { assertRequiredId } from '../validators/voting.validators'

const normalizeDesire = (slot: VotingSlotRecord): VotingDesire => {
  if (slot.desire) return slot.desire
  if (slot.status === DB_VOTING_STATUSES.GOING) return VOTING_DESIRES.GOING
  if (slot.status === DB_VOTING_STATUSES.RESERVE) return VOTING_DESIRES.RESERVE
  return VOTING_DESIRES.NOT_GOING
}

const sortByCreatedAt = (a: VotingSlotRecord, b: VotingSlotRecord) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

const hasReservePosition = (slot: VotingSlotRecord) => typeof slot.reserve_position === 'number'
const sameNullable = <T,>(a: T | null | undefined, b: T | null | undefined) =>
  (a ?? null) === (b ?? null)

const shouldForcePromotionAfterGoVacancy = (params: {
  slots: VotingSlotRecord[]
  maxPlayers?: number | null
  affectedSlotStatus?: VotingSlotRecord['status'] | null
}) => {
  if (params.affectedSlotStatus !== DB_VOTING_STATUSES.GOING) return false
  const goingLimit = Math.max(1, params.maxPlayers || VOTING_GOING_LIMIT)
  const goingCount = params.slots.filter((slot) => slot.status === DB_VOTING_STATUSES.GOING).length
  const reserveCount = params.slots.filter((slot) => slot.status === DB_VOTING_STATUSES.RESERVE).length
  // Full list before action and reserve exists -> after vacancy we must auto-promote first reserve.
  return goingCount >= goingLimit && reserveCount > 0
}

export const reconcileLists = async (
  matchId: string,
  options?: { allowReservePromotion?: boolean; forceReservePromotion?: boolean }
) => {
  assertRequiredId(matchId, 'matchId')
  const allowReservePromotion = options?.allowReservePromotion ?? true
  const forceReservePromotion = options?.forceReservePromotion ?? false

  const [matchState, slots] = await Promise.all([
    votingRepository.getMatchState(matchId),
    votingRepository.getSlots(matchId),
  ])
  const goingLimit = Math.max(1, matchState.max_players || VOTING_GOING_LIMIT)

  const userSlots = slots.filter((slot) => !!slot.user_id)
  const manualReserveSlots = slots.filter(
    (slot) => !slot.user_id && slot.status === DB_VOTING_STATUSES.RESERVE
  )
  const manualGoingCount = slots.filter(
    (slot) => !slot.user_id && slot.status === DB_VOTING_STATUSES.GOING
  ).length
  const availableGoingForUsers = Math.max(0, goingLimit - manualGoingCount)

  const desiredGoing = userSlots
    .filter((slot) => normalizeDesire(slot) === VOTING_DESIRES.GOING)
    .sort(sortByCreatedAt)

  const going = desiredGoing.slice(0, availableGoingForUsers)
  const overflowToReserve = desiredGoing.slice(availableGoingForUsers)

  // Unified reserve queue: registered users + manually added players.
  // Existing reserve_position is kept; newcomers are appended by created_at.
  const reserveCandidates = userSlots
    .filter((slot) => normalizeDesire(slot) === VOTING_DESIRES.RESERVE)
    .concat(overflowToReserve)
    .concat(manualReserveSlots)
    .filter((slot, idx, arr) => arr.findIndex((x) => x.id === slot.id) === idx)
    .sort((a, b) => {
      const aHasPos = hasReservePosition(a)
      const bHasPos = hasReservePosition(b)
      if (aHasPos && bHasPos) return (a.reserve_position || 0) - (b.reserve_position || 0)
      if (aHasPos) return -1
      if (bHasPos) return 1
      return sortByCreatedAt(a, b)
    })

  let nextGoingCount = going.length
  let nextReserve = [...reserveCandidates]
  let fullLimitAchieved = !!matchState.voting_full_limit_achieved
  let promotedReserve: VotingSlotRecord | null = null

  if (manualGoingCount + nextGoingCount >= goingLimit) {
    fullLimitAchieved = true
  }

  // Auto-promotion from reserve is allowed only after historical full limit and only for
  // one newly opened last slot (limit-1 -> limit).
  const canPromoteByHistoricalRule =
    fullLimitAchieved && manualGoingCount + nextGoingCount === goingLimit - 1
  const canPromoteByForcedVacancyRule =
    forceReservePromotion && manualGoingCount + nextGoingCount < goingLimit

  if (
    allowReservePromotion &&
    (canPromoteByHistoricalRule || canPromoteByForcedVacancyRule) &&
    nextReserve.length > 0
  ) {
    // nextReserve is already sorted by queue rules.
    const firstReserve = nextReserve[0]
    promotedReserve = firstReserve
    nextGoingCount += 1
    nextReserve = nextReserve.filter((slot) => slot.id !== firstReserve.id)
    if (firstReserve.user_id) {
      going.push(firstReserve)
    }
  }

  // Reset historical flag only when currently not full and reserve is empty.
  if (manualGoingCount + nextGoingCount < goingLimit && nextReserve.length === 0) {
    fullLimitAchieved = false
  }

  const finalReserveQueue = [...nextReserve].sort((a, b) => {
    const aHasPos = hasReservePosition(a)
    const bHasPos = hasReservePosition(b)
    if (aHasPos && bHasPos) return (a.reserve_position || 0) - (b.reserve_position || 0)
    if (aHasPos) return -1
    if (bHasPos) return 1
    return sortByCreatedAt(a, b)
  })

  const goingIds = new Set(going.map((slot) => slot.id))
  const reserveIds = new Set(nextReserve.map((slot) => slot.id))
  const reservePositionById = new Map(finalReserveQueue.map((slot, index) => [slot.id, index + 1]))

  // Phase 1: demote everyone who is not in final "going".
  for (const slot of userSlots) {
    if (goingIds.has(slot.id)) continue

    if (reserveIds.has(slot.id)) {
      const nextReservePos = reservePositionById.get(slot.id) || null
      if (
        slot.status === DB_VOTING_STATUSES.RESERVE &&
        slot.desire === VOTING_DESIRES.RESERVE &&
        sameNullable(slot.reserve_position, nextReservePos)
      ) {
        continue
      }

      const reservePatch: Partial<
        Pick<VotingSlotRecord, 'status' | 'desire' | 'reserve_position' | 'created_at'>
      > = {
        desire: VOTING_DESIRES.RESERVE,
        reserve_position: nextReservePos,
      }
      if (slot.status !== DB_VOTING_STATUSES.RESERVE) {
        reservePatch.status = DB_VOTING_STATUSES.RESERVE
      }
      await votingRepository.updateSlotState(slot.id, reservePatch)
      continue
    }

    if (
      slot.status === DB_VOTING_STATUSES.NOT_GOING &&
      slot.desire === VOTING_DESIRES.NOT_GOING &&
      sameNullable(slot.reserve_position, null)
    ) {
      continue
    }

    const notGoingPatch: Partial<
      Pick<VotingSlotRecord, 'status' | 'desire' | 'reserve_position' | 'created_at'>
    > = {
      desire: VOTING_DESIRES.NOT_GOING,
      reserve_position: null,
    }
    if (slot.status !== DB_VOTING_STATUSES.NOT_GOING) {
      notGoingPatch.status = DB_VOTING_STATUSES.NOT_GOING
    }
    await votingRepository.updateSlotState(slot.id, notGoingPatch)
  }

  // Phase 2: only after demotions, assign final "going" set.
  for (const slot of userSlots) {
    if (!goingIds.has(slot.id)) continue
    if (
      slot.status === DB_VOTING_STATUSES.GOING &&
      slot.desire === VOTING_DESIRES.GOING &&
      sameNullable(slot.reserve_position, null)
    ) {
      continue
    }

    const goingPatch: Partial<
      Pick<VotingSlotRecord, 'status' | 'desire' | 'reserve_position' | 'created_at'>
    > = {
      desire: VOTING_DESIRES.GOING,
      reserve_position: null,
    }
    if (slot.status !== DB_VOTING_STATUSES.GOING) {
      goingPatch.status = DB_VOTING_STATUSES.GOING
    }
    await votingRepository.updateSlotState(slot.id, goingPatch)
  }

  // Keep manual reserve queue positions coherent with the same queue.
  for (const manualSlot of manualReserveSlots) {
    if (promotedReserve?.id === manualSlot.id) {
      if (
        manualSlot.status !== DB_VOTING_STATUSES.GOING ||
        !sameNullable(manualSlot.reserve_position, null)
      ) {
        await votingRepository.updateSlotState(manualSlot.id, {
          status: DB_VOTING_STATUSES.GOING,
          reserve_position: null,
        })
      }
      continue
    }

    const nextReservePos = reservePositionById.get(manualSlot.id) || null
    if (
      manualSlot.status === DB_VOTING_STATUSES.RESERVE &&
      sameNullable(manualSlot.reserve_position, nextReservePos)
    ) {
      continue
    }
    await votingRepository.updateSlotState(manualSlot.id, {
      status: DB_VOTING_STATUSES.RESERVE,
      reserve_position: nextReservePos,
    })
  }

  await votingRepository.updateFullLimitAchieved(matchId, fullLimitAchieved)
}

export const pressGoing = async (params: { matchId: string; userId: string; nickname: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const current = await votingRepository.getUserSlot(params.matchId, params.userId)
  if (current?.status === DB_VOTING_STATUSES.GOING) return

  const [matchState, slots] = await Promise.all([
    votingRepository.getMatchState(params.matchId),
    votingRepository.getSlots(params.matchId),
  ])
  const goingLimit = Math.max(1, matchState.max_players || VOTING_GOING_LIMIT)
  const goingCount = slots.filter((slot) => slot.status === DB_VOTING_STATUSES.GOING).length
  const now = new Date().toISOString()

  // When limit is full:
  // - reserve user keeps place (no change)
  // - not_going/new user goes to reserve tail
  if (goingCount >= goingLimit) {
    if (current?.status === DB_VOTING_STATUSES.RESERVE) return
    if (current) {
      await votingRepository.updateSlotState(current.id, {
        status: DB_VOTING_STATUSES.RESERVE,
        desire: VOTING_DESIRES.RESERVE,
        reserve_position: null,
        created_at: now,
      })
    } else {
      await votingRepository.upsertUserDesire({
        matchId: params.matchId,
        userId: params.userId,
        nickname: params.nickname,
        desire: VOTING_DESIRES.RESERVE,
        initialStatus: DB_VOTING_STATUSES.RESERVE,
      })
    }
    await reconcileLists(params.matchId, { allowReservePromotion: false })
    return
  }

  if (current) {
    await votingRepository.updateSlotState(current.id, {
      status: DB_VOTING_STATUSES.GOING,
      desire: VOTING_DESIRES.GOING,
      reserve_position: null,
      created_at: now,
    })
    await reconcileLists(params.matchId, { allowReservePromotion: false })
    return
  }

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.GOING,
    initialStatus: DB_VOTING_STATUSES.GOING,
  })
  await reconcileLists(params.matchId, { allowReservePromotion: false })
}

export const pressReserve = async (params: { matchId: string; userId: string; nickname: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const [current, matchState, slots] = await Promise.all([
    votingRepository.getUserSlot(params.matchId, params.userId),
    votingRepository.getMatchState(params.matchId),
    votingRepository.getSlots(params.matchId),
  ])
  if (current?.status === DB_VOTING_STATUSES.RESERVE) return
  const now = new Date().toISOString()
  const forceReservePromotion = shouldForcePromotionAfterGoVacancy({
    slots,
    maxPlayers: matchState.max_players,
    affectedSlotStatus: current?.status,
  })

  if (current) {
    // Moving to reserve from any status should send user to the tail.
    await votingRepository.updateSlotState(current.id, {
      status: DB_VOTING_STATUSES.RESERVE,
      desire: VOTING_DESIRES.RESERVE,
      reserve_position: null,
      created_at: now,
    })
    await reconcileLists(params.matchId, { forceReservePromotion })
    return
  }

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.RESERVE,
    initialStatus: DB_VOTING_STATUSES.RESERVE,
  })
  await reconcileLists(params.matchId, { forceReservePromotion })
}

export const pressNotGoing = async (params: { matchId: string; userId: string; nickname: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const [current, matchState, slots] = await Promise.all([
    votingRepository.getUserSlot(params.matchId, params.userId),
    votingRepository.getMatchState(params.matchId),
    votingRepository.getSlots(params.matchId),
  ])
  const lostReservePosition =
    current?.status === DB_VOTING_STATUSES.RESERVE && hasReservePosition(current)
  const forceReservePromotion = shouldForcePromotionAfterGoVacancy({
    slots,
    maxPlayers: matchState.max_players,
    affectedSlotStatus: current?.status,
  })

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.NOT_GOING,
  })
  await reconcileLists(params.matchId, { forceReservePromotion })
  return { lostReservePosition: !!lostReservePosition }
}

export const removeVotingUser = async (params: { matchId: string; userId: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const current = await votingRepository.getUserSlot(params.matchId, params.userId)
  if (!current) return { lostReservePosition: false }
  const lostReservePosition =
    current?.status === DB_VOTING_STATUSES.RESERVE && hasReservePosition(current)

  const [matchState, slots] = await Promise.all([
    votingRepository.getMatchState(params.matchId),
    votingRepository.getSlots(params.matchId),
  ])
  const shouldForceReservePromotion = shouldForcePromotionAfterGoVacancy({
    slots,
    maxPlayers: matchState.max_players,
    affectedSlotStatus: current.status,
  })

  await votingRepository.removeUserSlot(params.matchId, params.userId)
  await reconcileLists(params.matchId, { forceReservePromotion: shouldForceReservePromotion })
  return { lostReservePosition: !!lostReservePosition }
}

export const removeVotingSlot = async (params: { slotId: string }) => {
  assertRequiredId(params.slotId, 'slotId')

  const slot = await votingRepository.getSlotById(params.slotId)
  if (!slot) return { lostReservePosition: false }

  const lostReservePosition =
    slot.status === DB_VOTING_STATUSES.RESERVE && hasReservePosition(slot)

  const [matchState, slots] = await Promise.all([
    votingRepository.getMatchState(slot.match_id),
    votingRepository.getSlots(slot.match_id),
  ])
  const shouldForceReservePromotion = shouldForcePromotionAfterGoVacancy({
    slots,
    maxPlayers: matchState.max_players,
    affectedSlotStatus: slot.status,
  })

  await votingRepository.removeSlotById(params.slotId)
  await reconcileLists(slot.match_id, { forceReservePromotion: shouldForceReservePromotion })
  return { lostReservePosition: !!lostReservePosition }
}
