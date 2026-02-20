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

export const reconcileLists = async (matchId: string) => {
  assertRequiredId(matchId, 'matchId')

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

  // Preserve queue position for existing reserve users; append newcomers by created_at.
  const reserveCandidates = userSlots
    .filter((slot) => normalizeDesire(slot) === VOTING_DESIRES.RESERVE)
    .concat(overflowToReserve)
    .filter((slot, idx, arr) => arr.findIndex((x) => x.id === slot.id) === idx)
    .sort((a, b) => {
      const aHasPos = hasReservePosition(a)
      const bHasPos = hasReservePosition(b)
      if (aHasPos && bHasPos) return (a.reserve_position || 0) - (b.reserve_position || 0)
      if (aHasPos) return -1
      if (bHasPos) return 1
      return sortByCreatedAt(a, b)
    })

  const reserveWithExistingQueueBeforePromotion = reserveCandidates.filter(hasReservePosition)

  let nextGoingCount = going.length
  let nextReserve = [...reserveCandidates]
  let fullLimitAchieved = !!matchState.voting_full_limit_achieved

  if (manualGoingCount + nextGoingCount >= goingLimit) {
    fullLimitAchieved = true
  }

  // Auto-promotion from reserve is allowed only after historical full limit and only for
  // one newly opened last slot (limit-1 -> limit).
  if (
    fullLimitAchieved &&
    manualGoingCount + nextGoingCount === goingLimit - 1 &&
    reserveWithExistingQueueBeforePromotion.length > 0 &&
    nextReserve.length > 0
  ) {
    const firstReserve =
      nextReserve.find((slot) =>
        reserveWithExistingQueueBeforePromotion.some((queued) => queued.id === slot.id)
      ) || nextReserve[0]
    nextGoingCount += 1
    nextReserve = nextReserve.filter((slot) => slot.id !== firstReserve.id)
    going.push(firstReserve)
  }

  // Reset historical flag only when currently not full and reserve is empty.
  if (manualGoingCount + nextGoingCount < goingLimit && nextReserve.length === 0) {
    fullLimitAchieved = false
  }

  const finalReserveQueue = [...nextReserve, ...manualReserveSlots].sort((a, b) => {
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
      await votingRepository.updateSlotState(slot.id, {
        status: DB_VOTING_STATUSES.RESERVE,
        desire: VOTING_DESIRES.RESERVE,
        reserve_position: reservePositionById.get(slot.id) || null,
      })
      continue
    }

    await votingRepository.updateSlotState(slot.id, {
      status: DB_VOTING_STATUSES.NOT_GOING,
      desire: VOTING_DESIRES.NOT_GOING,
      reserve_position: null,
    })
  }

  // Phase 2: only after demotions, assign final "going" set.
  for (const slot of userSlots) {
    if (!goingIds.has(slot.id)) continue
    await votingRepository.updateSlotState(slot.id, {
      status: DB_VOTING_STATUSES.GOING,
      desire: VOTING_DESIRES.GOING,
      reserve_position: null,
    })
  }

  // Keep manual reserve queue positions coherent with user queue.
  for (const manualSlot of manualReserveSlots) {
    await votingRepository.updateSlotState(manualSlot.id, {
      reserve_position: reservePositionById.get(manualSlot.id) || null,
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
    await votingRepository.upsertUserDesire({
      matchId: params.matchId,
      userId: params.userId,
      nickname: params.nickname,
      desire: VOTING_DESIRES.RESERVE,
      initialStatus: DB_VOTING_STATUSES.RESERVE,
    })
    await reconcileLists(params.matchId)
    return
  }

  if (current) {
    await votingRepository.updateSlotState(current.id, {
      status: DB_VOTING_STATUSES.GOING,
      desire: VOTING_DESIRES.GOING,
      reserve_position: null,
      created_at: now,
    })
    await reconcileLists(params.matchId)
    return
  }

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.GOING,
    initialStatus: DB_VOTING_STATUSES.GOING,
  })
  await reconcileLists(params.matchId)
}

export const pressReserve = async (params: { matchId: string; userId: string; nickname: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const current = await votingRepository.getUserSlot(params.matchId, params.userId)
  if (current?.status === DB_VOTING_STATUSES.RESERVE) return
  const now = new Date().toISOString()

  if (current) {
    // Moving to reserve from any status should send user to the tail.
    await votingRepository.updateSlotState(current.id, {
      status: DB_VOTING_STATUSES.RESERVE,
      desire: VOTING_DESIRES.RESERVE,
      reserve_position: null,
      created_at: now,
    })
    await reconcileLists(params.matchId)
    return
  }

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.RESERVE,
    initialStatus: DB_VOTING_STATUSES.RESERVE,
  })
  await reconcileLists(params.matchId)
}

export const pressNotGoing = async (params: { matchId: string; userId: string; nickname: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const current = await votingRepository.getUserSlot(params.matchId, params.userId)
  const lostReservePosition =
    current?.status === DB_VOTING_STATUSES.RESERVE && hasReservePosition(current)

  await votingRepository.upsertUserDesire({
    matchId: params.matchId,
    userId: params.userId,
    nickname: params.nickname,
    desire: VOTING_DESIRES.NOT_GOING,
  })
  await reconcileLists(params.matchId)
  return { lostReservePosition: !!lostReservePosition }
}

export const removeVotingUser = async (params: { matchId: string; userId: string }) => {
  assertRequiredId(params.matchId, 'matchId')
  assertRequiredId(params.userId, 'userId')

  const current = await votingRepository.getUserSlot(params.matchId, params.userId)
  const lostReservePosition =
    current?.status === DB_VOTING_STATUSES.RESERVE && hasReservePosition(current)

  await votingRepository.removeUserSlot(params.matchId, params.userId)
  await reconcileLists(params.matchId)
  return { lostReservePosition: !!lostReservePosition }
}
