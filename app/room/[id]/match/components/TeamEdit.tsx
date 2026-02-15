'use client'
import { useState } from 'react'
import { Player, TempTeam, teamTitleColors } from './types'

interface Props {
  teams: TempTeam[]
  allPlayers: Player[]
  onSave: () => Promise<void>
  onBack: () => void
  onTeamsChange: (teams: TempTeam[]) => void // Добавляем колбэк для обновления команд
}

export default function TeamEdit({ teams, allPlayers, onSave, onBack, onTeamsChange }: Props) {
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null)
  const [tempTeamName, setTempTeamName] = useState('')
  const [tempTeamColor, setTempTeamColor] = useState<{ text: string, bg: string, label: string } | null>(null)

  const movePlayerToTeam = (playerId: string, fromTeamIndex: number | null, toTeamIndex: number) => {
    const newTeams = [...teams]
    const player = allPlayers.find(p => p.id === playerId)
    if (!player) return
    
    if (fromTeamIndex !== null) {
      newTeams[fromTeamIndex].players = newTeams[fromTeamIndex].players.filter((p: Player) => p.id !== playerId)
    }
    
    newTeams[toTeamIndex].players.push(player)
    
    // Удаляем пустые команды
    const nonEmptyTeams = newTeams.filter(team => team.players.length > 0)
    onTeamsChange(nonEmptyTeams)
  }

  const removePlayerFromTeam = (playerId: string, teamIndex: number) => {
    const newTeams = [...teams]
    newTeams[teamIndex].players = newTeams[teamIndex].players.filter((p: Player) => p.id !== playerId)
    
    const nonEmptyTeams = newTeams.filter(team => team.players.length > 0)
    onTeamsChange(nonEmptyTeams)
  }

  const updateTeamName = (index: number, newName: string, newColor?: { text: string, bg: string, label: string }) => {
    const newTeams = [...teams]
    newTeams[index].name = newName
    if (newColor) {
      newTeams[index].color = newColor
    }
    onTeamsChange(newTeams)
    setEditingTeamIndex(null)
  }

  const startEditingTeam = (index: number) => {
    setTempTeamName(teams[index].name)
    setTempTeamColor(teams[index].color || teamTitleColors[0])
    setEditingTeamIndex(index)
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-600">Редактирование составов</h2>
        <button 
          onClick={onSave}
          className="bg-green-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase hover:bg-green-600 transition-all shadow-lg"
        >
          Сохранить и выйти →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, teamIndex) => (
          <div key={team.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              {editingTeamIndex === teamIndex ? (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex gap-2 items-center">
                    <input
                      value={tempTeamName}
                      onChange={(e) => setTempTeamName(e.target.value)}
                      className="text-lg font-black uppercase border-b-2 border-blue-600 outline-none flex-1 bg-transparent"
                      style={{ color: tempTeamColor?.text || 'black' }}
                      autoFocus
                    />
                    <button 
                      onClick={() => updateTeamName(teamIndex, tempTeamName, tempTeamColor || undefined)}
                      className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black shrink-0"
                    >
                      Ок
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {teamTitleColors.map((color, colorIndex) => (
                      <button
                        key={colorIndex}
                        onClick={() => setTempTeamColor(color)}
                        className={`w-8 h-8 rounded-full border-2 ${color.bg} ${
                          tempTeamColor?.text === color.text ? 'border-black' : 'border-transparent'
                        }`}
                        title={color.label}
                      >
                        <div className={`w-full h-full rounded-full ${color.bg}`}></div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <h2 
                    className={`text-lg font-black uppercase cursor-pointer hover:opacity-70 px-2 py-1 rounded-lg inline-block ${team.color?.bg || 'bg-transparent'}`}
                    onClick={() => startEditingTeam(teamIndex)}
                  >
                    <span className={team.color?.text || 'text-blue-600'}>{team.name}</span>
                  </h2>
                  <span className="text-xs text-gray-400">{team.players.length}</span>
                </>
              )}
            </div>
            
            <div className="space-y-2 min-h-[200px]">
              {team.players.map((player: Player) => (
                <div key={player.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl group">
                  <span className="text-xs font-bold truncate">{player.nickname}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {teams.map((_, idx) => (
                      idx !== teamIndex && (
                        <button
                          key={idx}
                          onClick={() => movePlayerToTeam(player.id, teamIndex, idx)}
                          className="text-[8px] bg-blue-100 text-blue-600 px-2 py-1 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all"
                          title={`Переместить в ${teams[idx].name}`}
                        >
                          {idx + 1}
                        </button>
                      )
                    ))}
                    <button
                      onClick={() => removePlayerFromTeam(player.id, teamIndex)}
                      className="text-[8px] bg-red-100 text-red-600 px-2 py-1 rounded-lg font-black hover:bg-red-600 hover:text-white transition-all"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {allPlayers.filter(p => !teams.some(t => t.players.some((tp: Player) => tp.id === p.id))).length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed">
                <p className="text-[8px] text-gray-400 mb-2 tracking-widest">Добавить игрока:</p>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {allPlayers
                    .filter(p => !teams.some(t => t.players.some((tp: Player) => tp.id === p.id)))
                    .map(player => (
                      <button
                        key={player.id}
                        onClick={() => movePlayerToTeam(player.id, null, teamIndex)}
                        className="w-full text-left p-2 text-[10px] bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors truncate"
                      >
                        {player.nickname}
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}