import {
  pressGoing,
  pressNotGoing,
  pressReserve,
  removeVotingSlot,
  removeVotingUser,
} from '../services/voting.service'

export const votingController = {
  pressGoing,
  pressReserve,
  pressNotGoing,
  removeUser: removeVotingUser,
  removeSlot: removeVotingSlot,
}
