'use client'
import { useState } from 'react'
import { Player, TempTeam, teamTitleColors } from './types'

interface Props {
  players: Player[]
  numTeams: number
  onComplete: (teams: TempTeam[]) => void
  onBack: () => void
}

export default function AutoDistribution({ players, numTeams, onComplete, onBack }: Props) {
  const handleDistribute = () => {
    if (players.length === 0) return
    
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const actualNumTeams = Math.min(numTeams, players.length)
    
    const newTeams: TempTeam[] = []
    for (let i = 0; i < actualNumTeams; i++) {
      newTeams.push({
        id: `temp-${i}`,
        name: `Команда ${i + 1}`,
        players: [],
        color: teamTitleColors[i % teamTitleColors.length]
      })
    }
    
    shuffled.forEach((player, index) => {
      const teamIndex = index % actualNumTeams
      newTeams[teamIndex].players.push(player)
    })
    
    onComplete(newTeams)
  }

  return (
    <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
      <h3 className="text-3xl text-blue-600 mb-8">Авто-рандом</h3>
      <p className="text-[9px] text-gray-300 mb-10">
        Игроки будут случайным образом распределены по {numTeams} командам.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-gray-100 py-5 rounded-[2rem] text-[10px] hover:bg-gray-200 transition-all">
          ← Назад
        </button>
        <button onClick={handleDistribute} className="flex-1 bg-green-500 text-white py-5 rounded-[2rem] text-[10px] shadow-lg hover:bg-green-600 transition-all">
          Распределить
        </button>
      </div>
    </div>
  )
}