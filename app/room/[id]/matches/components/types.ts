import { TEAM_TITLE_COLORS } from '../../components/teamColors'

// Типы для игроков и команд
export interface Player {
  id: string
  nickname: string
  status: string
  team_id?: string | null
}

export interface Team {
  id: string
  name: string
  players: Player[]
}

export interface TempTeam {
  id: string
  name: string
  players: Player[]
  color?: { text: string, bg: string, label: string }
}

// Массив цветов для корзин и команд
export const basketColors = [
  'bg-blue-600',   // Команда/Корзина 1
  'bg-green-600',  // Команда/Корзина 2
  'bg-purple-600', // Команда/Корзина 3
  'bg-orange-600', // Команда/Корзина 4
  'bg-pink-600',   // Команда/Корзина 5
  'bg-indigo-600'  // Команда/Корзина 6
]

// Массив цветов для названий команд
export const teamTitleColors = TEAM_TITLE_COLORS
