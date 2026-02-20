import { VotingDesire, VOTING_DESIRES } from '../constants/statuses'

export const assertRequiredId = (value: string | null | undefined, fieldName: string) => {
  if (!value) {
    throw new Error(`${fieldName} is required`)
  }
}

export const isVotingDesire = (value: string): value is VotingDesire =>
  value === VOTING_DESIRES.GOING ||
  value === VOTING_DESIRES.RESERVE ||
  value === VOTING_DESIRES.NOT_GOING
