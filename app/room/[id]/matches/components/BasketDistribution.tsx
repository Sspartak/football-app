'use client'
import { useState, useEffect } from 'react'
import { Player, TempTeam, teamTitleColors } from './types'

interface Props {
  players: Player[]
  numTeams: number
  baskets: string[][]
  setBaskets: (baskets: string[][]) => void
  onComplete: (teams: TempTeam[]) => void
  onBack: () => void
}

export default function BasketDistribution({ players, numTeams, baskets, setBaskets, onComplete, onBack }: Props) {
  const [currentBasket, setCurrentBasket] = useState(0)

  // Инициализация при первом рендере
  useEffect(() => {
    if (!baskets || baskets.length === 0) {
      const actualNumBaskets = Math.min(numTeams, players.length || 1)
      setBaskets(Array.from({ length: actualNumBaskets }, () => []))
      setCurrentBasket(0)
    }
  }, [])

  const togglePlayerInBasket = (playerId: string) => {
    if (!baskets || baskets.length === 0) return
    
    const newBaskets = [...baskets]
    
    // Проверяем, есть ли игрок уже в какой-то корзине
    for (let i = 0; i < newBaskets.length; i++) {
      if (newBaskets[i].includes(playerId)) {
        newBaskets[i] = newBaskets[i].filter(id => id !== playerId)
        setBaskets(newBaskets)
        return
      }
    }
    
    // Если игрока нет ни в одной корзине - добавляем в текущую
    if (currentBasket < newBaskets.length && !newBaskets[currentBasket].includes(playerId)) {
      newBaskets[currentBasket].push(playerId)
      setBaskets(newBaskets)
    }
  }

  const finalizeBaskets = () => {
    if (!baskets || baskets.length === 0) return
    
    const nonEmptyBaskets = baskets.filter(basket => basket.length > 0)
    if (nonEmptyBaskets.length === 0) {
      alert('Нет игроков в корзинах')
      return
    }
    
    const newTeams: TempTeam[] = []
    nonEmptyBaskets.forEach((basket, basketIndex) => {
      const shuffledBasket = [...basket].sort(() => Math.random() - 0.5)
      
      const team: TempTeam = {
        id: `temp-${basketIndex}`,
        name: `Команда ${basketIndex + 1}`,
        players: [],
        color: teamTitleColors[basketIndex % teamTitleColors.length]
      }
      
      shuffledBasket.forEach(playerId => {
        const player = players.find(p => p.id === playerId)
        if (player) team.players.push(player)
      })
      
      newTeams.push(team)
    })
    
    onComplete(newTeams)
  }

  // Добавляем функцию в глобальный объект для доступа из PlayerList
  useEffect(() => {
    // @ts-ignore
    window.togglePlayerInBasket = togglePlayerInBasket
  }, [baskets, currentBasket])

  // Защита от undefined
  if (!baskets || baskets.length === 0) {
    return (
      <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
      <div className="mb-8">
        <p className="text-[10px] text-gray-400 tracking-[0.2em] mb-2">Наполнение корзин</p>
        <h3 className="text-3xl text-blue-600">Корзина {currentBasket + 1}</h3>
        <p className="text-[9px] text-gray-300 mt-2">
          {baskets[currentBasket]?.length || 0} игроков
        </p>
      </div>
      <p className="text-[9px] text-gray-300 mb-10 leading-relaxed">
        Выберите игроков слева для этой корзины.<br/>
        Затем перейдите к следующей.
      </p>
      
      <div className="flex gap-3">
        {currentBasket > 0 && (
          <button onClick={() => setCurrentBasket(c => c - 1)} className="flex-1 bg-gray-100 py-5 rounded-[2rem] text-[10px] hover:bg-gray-200 transition-all">
            ← Назад
          </button>
        )}
        {currentBasket < baskets.length - 1 ? (
          <button onClick={() => setCurrentBasket(c => c + 1)} className="flex-1 bg-black text-white py-5 rounded-[2rem] text-[10px] hover:bg-gray-900 transition-all">
            Далее →
          </button>
        ) : (
          <button onClick={finalizeBaskets} className="flex-1 bg-green-500 text-white py-5 rounded-[2rem] text-[10px] shadow-lg hover:bg-green-600 transition-all">
            Готово
          </button>
        )}
      </div>
      
      <div className="flex justify-center gap-2 mt-8">
        {Array.from({ length: baskets.length }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === currentBasket ? 'w-6 bg-blue-600' : baskets[i]?.length > 0 ? 'w-3 bg-green-400' : 'w-3 bg-gray-200'
          }`} />
        ))}
      </div>
    </div>
  )
}