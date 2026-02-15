'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'
import { Player, TempTeam } from './components/types'
import PlayerList from './components/PlayerList'
import MenuSelector from './components/MenuSelector'
import AutoDistribution from './components/AutoDistribution'
import BasketDistribution from './components/BasketDistribution'
import ManualDistribution from './components/ManualDistribution'
import TeamEdit from './components/TeamEdit'

export default function MatchAdminPage() {
  const { id: roomId } = useParams()
  const router = useRouter()
  
  const [match, setMatch] = useState<any>(null)
  const [goPlayers, setGoPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [numTeams, setNumTeams] = useState(2)
  const [mode, setMode] = useState<'menu' | 'auto' | 'baskets' | 'manual' | 'edit'>('menu')
  const [teams, setTeams] = useState<TempTeam[]>([])
  const [baskets, setBaskets] = useState<string[][]>([])

  useEffect(() => {
    fetchMatchData()
  }, [roomId])

  const fetchMatchData = async () => {
    const { data: matchData } = await supabase.from('matches').select('*').eq('room_id', roomId).maybeSingle()
    if (matchData) {
      setMatch(matchData)
      const { data: slots } = await supabase
        .from('match_slots')
        .select('*')
        .eq('match_id', matchData.id)
        .eq('status', 'go')
      setGoPlayers(slots || [])
    }
    setLoading(false)
  }

  const saveTeams = async () => {
    if (!match) return
    
    try {
      await supabase.from('match_teams').delete().eq('match_id', match.id)
      
      for (let i = 0; i < teams.length; i++) {
        if (teams[i].players.length === 0) continue
        
        const { data: team } = await supabase
          .from('match_teams')
          .insert({
            match_id: match.id,
            name: teams[i].name,
            color_json: teams[i].color
          })
          .select()
          .single()
        
        if (team) {
          for (const player of teams[i].players) {
            await supabase
              .from('match_slots')
              .update({ team_id: team.id })
              .eq('id', player.id)
          }
        }
      }
      
      await supabase
        .from('matches')
        .update({ status: 'teams_distributed' })
        .eq('id', match.id)
      
      alert('Команды успешно сохранены!')
      setTimeout(() => router.push(`/room/${roomId}`), 500)
      
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
      alert('Произошла ошибка при сохранении')
    }
  }

  // Функции для обработки кликов по игрокам в разных режимах
  const handlePlayerClick = (playerId: string) => {
    if (mode === 'baskets') {
      // Логика для корзин будет передана через пропсы в BasketDistribution
      // Этот колбэк будет переопределен
    } else if (mode === 'manual') {
      // Логика для ручного режима будет передана через пропсы в ManualDistribution
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-white text-xs font-black uppercase">Загрузка...</div>

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans italic uppercase font-black overflow-hidden">
      <header className="px-8 py-5 bg-white border-b flex justify-between items-center shrink-0">
        <button onClick={() => router.back()} className="text-[10px] bg-gray-100 px-6 py-2 rounded-full hover:bg-black hover:text-white transition-all">← Назад</button>
        <h1 className="text-xl text-blue-600 tracking-tighter">Распределение составов</h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Всегда показываем список игроков */}
        <PlayerList 
          players={goPlayers} 
          mode={mode}
          baskets={baskets}
          teams={teams}
          onPlayerClick={handlePlayerClick}
        />

        <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
          {mode === 'menu' && (
            <MenuSelector
              numTeams={numTeams}
              setNumTeams={setNumTeams}
              onAuto={() => setMode('auto')}
              onBaskets={() => setMode('baskets')}
              onManual={() => setMode('manual')}
            />
          )}

          {mode === 'auto' && (
            <AutoDistribution
              players={goPlayers}
              numTeams={numTeams}
              onComplete={(newTeams) => {
                setTeams(newTeams)
                setMode('edit')
              }}
              onBack={() => setMode('menu')}
            />
          )}

          {mode === 'baskets' && (
            <BasketDistribution
              players={goPlayers}
              numTeams={numTeams}
              baskets={baskets}
              setBaskets={setBaskets}
              onComplete={(newTeams) => {
                setTeams(newTeams)
                setMode('edit')
              }}
              onBack={() => setMode('menu')}
            />
          )}

          {mode === 'manual' && (
            <ManualDistribution
              players={goPlayers}
              numTeams={numTeams}
              teams={teams}
              setTeams={setTeams}
              onComplete={(newTeams) => {
                setTeams(newTeams)
                setMode('edit')
              }}
              onBack={() => setMode('menu')}
            />
          )}

          {mode === 'edit' && (
            <TeamEdit
              teams={teams}
              allPlayers={goPlayers}
              onSave={saveTeams}
              onBack={() => setMode('menu')}
              onTeamsChange={setTeams}
            />
          )}
        </div>
      </main>
    </div>
  )
}