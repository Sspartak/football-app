'use client'

import { Team } from './types'

interface Props {
    teams: Team[]
}

export default function TeamsDisplay({ teams }: Props) {
    if (teams.length === 0) {
        return <p className="text-center text-gray-400 py-8">Загрузка составов...</p>
    }

    return (
        <div className="col-span-3">
            <h3 className="text-xs font-black uppercase text-gray-400 mb-4">Составы на игру</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {teams.map((team) => {
                    const teamColor = team.color_json
                    return (
                        <div key={team.id} className="bg-white rounded-2xl p-4 shadow-sm border">
                            <h4
                                className={`text-sm font-black mb-3 border-b pb-2 px-2 py-1 rounded-lg inline-block ${
                                    teamColor?.bg || 'bg-transparent'
                                }`}
                            >
                                <span className={teamColor?.text || 'text-blue-600'}>
                                    {team.name}
                                </span>
                            </h4>
                            <div className="space-y-2">
                                {team.players && team.players.length > 0 ? (
                                    team.players.map((player) => (
                                        <div key={player.id} className="text-[10px] font-bold py-1 px-2 bg-gray-50 rounded-lg">
                                            {player.nickname}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[8px] text-gray-400 italic text-center py-4">Нет игроков</p>
                                )}
                            </div>
                            <div className="mt-3 text-[8px] text-gray-400 text-right">
                                {team.players?.length || 0} игроков
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}