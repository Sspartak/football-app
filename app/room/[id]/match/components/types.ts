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
export const teamTitleColors = [
  { text: 'text-white', bg: 'bg-gray-800', label: 'Белый' },
  { text: 'text-red-600', bg: 'bg-red-50', label: 'Красный' },
  { text: 'text-blue-600', bg: 'bg-blue-50', label: 'Синий' },
  { text: 'text-green-600', bg: 'bg-green-50', label: 'Зеленый' },
  { text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Желтый' },
  { text: 'text-black', bg: 'bg-gray-100', label: 'Черный' },
  { text: 'text-purple-600', bg: 'bg-purple-50', label: 'Фиолетовый' },
  { text: 'text-pink-600', bg: 'bg-pink-50', label: 'Розовый' },
  { text: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Индиго' },
  { text: 'text-orange-600', bg: 'bg-orange-50', label: 'Оранжевый' },
  { text: 'text-teal-600', bg: 'bg-teal-50', label: 'Бирюзовый' },
  { text: 'text-amber-600', bg: 'bg-amber-50', label: 'Янтарный' },
  { text: 'text-lime-600', bg: 'bg-lime-50', label: 'Лаймовый' },
  { text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Изумрудный' },
  { text: 'text-cyan-600', bg: 'bg-cyan-50', label: 'Голубой' },
  { text: 'text-violet-600', bg: 'bg-violet-50', label: 'Фиолетовый' },
  { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', label: 'Фуксия' },
  { text: 'text-rose-600', bg: 'bg-rose-50', label: 'Розовый' },
  { text: 'text-sky-600', bg: 'bg-sky-50', label: 'Небесный' },
  { text: 'text-stone-600', bg: 'bg-stone-50', label: 'Каменный' }
]