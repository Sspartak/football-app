import {
  pressGoing,
  pressNotGoing,
  pressReserve,
  removeVotingUser,
} from '../services/voting.service'

export const votingController = {
  pressGoing,
  pressReserve,
  pressNotGoing,
  removeUser: removeVotingUser,
}
