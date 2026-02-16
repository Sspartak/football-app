'use client'
import { Player } from './types'

interface Props {
  players: Player[]
  mode: 'menu' | 'auto' | 'baskets' | 'manual' | 'edit'
  baskets?: string[][]
  teams?: any[]
  onPlayerClick: (playerId: string) => void
}

export default function PlayerList({ players, mode, baskets, teams, onPlayerClick }: Props) {
  const basketColors = [
    'bg-blue-600', 'bg-green-600', 'bg-purple-600', 
    'bg-orange-600', 'bg-pink-600', 'bg-indigo-600'
  ]

  const handleClick = (playerId: string) => {
    if (mode === 'baskets' && (window as any).togglePlayerInBasket) {
      (window as any).togglePlayerInBasket(playerId)
    } else if (mode === 'manual' && (window as any).togglePlayerInTeam) {
      (window as any).togglePlayerInTeam(playerId)
    }
    onPlayerClick(playerId)
  }

  return (
    <div className="w-1/3 bg-white p-8 border-r overflow-y-auto custom-scroll">
      <h2 className="text-[10px] text-gray-400 mb-6 tracking-widest">Игроки "ИДУ" ({players.length})</h2>
      <div className="space-y-2">
        {players.map(p => {
          const basketIndex = baskets?.findIndex(b => b.includes(p.id)) ?? -1
          const teamIndex = teams?.findIndex(t => t.players.some((tp: Player) => tp.id === p.id)) ?? -1
          
          return (
            <div 
              key={p.id} 
              onClick={() => handleClick(p.id)}
              className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer flex justify-between items-center ${
                mode === 'baskets' && basketIndex !== -1 
                  ? `${basketColors[basketIndex % basketColors.length]} text-white border-transparent`
                  : mode === 'manual' && teamIndex !== -1
                    ? `${basketColors[teamIndex % basketColors.length]} text-white border-transparent`
                    : 'bg-gray-50 border-gray-100 hover:border-blue-200'
              }`}
            >
              <span className="text-[11px] truncate">{p.nickname}</span>
              {basketIndex !== -1 && mode === 'baskets' && (
                <span className="text-[8px] opacity-60">Корзина {basketIndex + 1}</span>
              )}
              {mode === 'manual' && teamIndex !== -1 && (
                <span className="text-[8px] opacity-60">Команда {teamIndex + 1}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}