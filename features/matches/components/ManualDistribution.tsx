'use client'
import { useState, useEffect } from 'react'
import { Player, TempTeam, teamTitleColors } from '../types'

interface Props {
  players: Player[]
  numTeams: number
  teams: TempTeam[]
  setTeams: (teams: TempTeam[]) => void
  onComplete: (teams: TempTeam[]) => void
  onBack: () => void
}

export default function ManualDistribution({ players, numTeams, teams, setTeams, onComplete, onBack }: Props) {
  const [currentTeam, setCurrentTeam] = useState(0)

  // Инициализация при первом рендере
  useEffect(() => {
    if (!teams || teams.length === 0) {
      const actualNumTeams = Math.min(numTeams, players.length || 1)
      const newTeams: TempTeam[] = []
      for (let i = 0; i < actualNumTeams; i++) {
        newTeams.push({
          id: `temp-${i}`,
          name: `Команда ${i + 1}`,
          players: [],
          color: teamTitleColors[i % teamTitleColors.length]
        })
      }
      setTeams(newTeams)
      setCurrentTeam(0)
    }
  }, [])

  const togglePlayerInTeam = (playerId: string) => {
    if (!teams || teams.length === 0) return
    
    const newTeams = [...teams]
    
    // Проверяем, есть ли игрок уже в какой-то команде
    for (let i = 0; i < newTeams.length; i++) {
      const playerIndex = newTeams[i].players.findIndex(p => p.id === playerId)
      if (playerIndex !== -1) {
        // Если игрок уже в команде - удаляем его
        newTeams[i].players.splice(playerIndex, 1)
        setTeams(newTeams)
        return
      }
    }
    
    // Если игрока нет ни в одной команде - добавляем в текущую
    const player = players.find(p => p.id === playerId)
    if (player && currentTeam < newTeams.length) {
      newTeams[currentTeam].players.push(player)
      setTeams(newTeams)
    }
  }

  const finalizeManual = () => {
    if (!teams || teams.length === 0) return
    
    const hasPlayers = teams.some(team => team.players.length > 0)
    if (!hasPlayers) {
      alert('Добавьте игроков в команды')
      return
    }
    
    const nonEmptyTeams = teams.filter(team => team.players.length > 0)
    onComplete(nonEmptyTeams)
  }

  // Добавляем функцию в глобальный объект для доступа из PlayerList
  useEffect(() => {
    // @ts-ignore
    window.togglePlayerInTeam = togglePlayerInTeam
  }, [teams, currentTeam])

  // Защита от undefined
  if (!teams || teams.length === 0) {
    return (
      <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
      <div className="mb-8">
        <p className="text-[10px] text-gray-400 tracking-[0.2em] mb-2">Ручное распределение</p>
        <h3 className="text-3xl text-blue-600">Команда {currentTeam + 1}</h3>
        <p className="text-[9px] text-gray-300 mt-2">
          {teams[currentTeam]?.players.length || 0} игроков
        </p>
      </div>
      <p className="text-[9px] text-gray-300 mb-10 leading-relaxed">
        Выберите игроков слева для этой команды.<br/>
        Затем перейдите к следующей.
      </p>
      
      <div className="flex gap-3">
        {currentTeam > 0 && (
          <button onClick={() => setCurrentTeam(c => c - 1)} className="flex-1 bg-gray-100 py-5 rounded-[2rem] text-[10px] hover:bg-gray-200 transition-all">
            ← Назад
          </button>
        )}
        {currentTeam < teams.length - 1 ? (
          <button onClick={() => setCurrentTeam(c => c + 1)} className="flex-1 bg-black text-white py-5 rounded-[2rem] text-[10px] hover:bg-gray-900 transition-all">
            Далее →
          </button>
        ) : (
          <button onClick={finalizeManual} className="flex-1 bg-green-500 text-white py-5 rounded-[2rem] text-[10px] shadow-lg hover:bg-green-600 transition-all">
            Готово
          </button>
        )}
      </div>
      
      <div className="flex justify-center gap-2 mt-8">
        {Array.from({ length: teams.length }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === currentTeam ? 'w-6 bg-blue-600' : teams[i]?.players.length > 0 ? 'w-3 bg-green-400' : 'w-3 bg-gray-200'
          }`} />
        ))}
      </div>
    </div>
  )
}