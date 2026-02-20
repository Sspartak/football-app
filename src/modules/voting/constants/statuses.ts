export const VOTING_GOING_LIMIT = 10

export const VOTING_DESIRES = {
  GOING: 'going',
  RESERVE: 'reserve',
  NOT_GOING: 'not_going',
} as const

export type VotingDesire = (typeof VOTING_DESIRES)[keyof typeof VOTING_DESIRES]

// Legacy DB status values used across current app UI and team flows.
export const DB_VOTING_STATUSES = {
  GOING: 'go',
  RESERVE: 'reserve',
  NOT_GOING: 'not_go',
} as const

export type DbVotingStatus = (typeof DB_VOTING_STATUSES)[keyof typeof DB_VOTING_STATUSES]
