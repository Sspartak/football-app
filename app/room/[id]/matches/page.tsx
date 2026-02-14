'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

// Типы для игроков и команд
interface Player {
  id: string
  nickname: string
  status: string
  team_id?: string | null
}

interface Team {
  id: string
  name: string
  players: Player[]
}

interface TempTeam {
  id: string
  name: string
  players: Player[]
  color?: { text: string, bg: string, label: string } // Обновляем тип цвета
}

export default function MatchAdminPage() {
  const { id: roomId } = useParams()
  const router = useRouter()
  
  const [match, setMatch] = useState<any>(null)
  const [goPlayers, setGoPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  
  // Состояния для логики распределения
  const [numTeams, setNumTeams] = useState(2)
  const [mode, setMode] = useState<'menu' | 'auto' | 'baskets' | 'edit'>('menu')
  const [currentBasket, setCurrentBasket] = useState<number>(0)
  const [baskets, setBaskets] = useState<string[][]>([])
  const [teams, setTeams] = useState<TempTeam[]>([])
  // Массив цветов для корзин
  const basketColors = [
    'bg-blue-600',   // Корзина 1
    'bg-green-600',  // Корзина 2
    'bg-purple-600', // Корзина 3
    'bg-orange-600', // Корзина 4
    'bg-pink-600',   // Корзина 5
    'bg-indigo-600'  // Корзина 6
  ]
  
  // Массив цветов для названий команд с фоновыми подложками
  const teamTitleColors = [
    { text: 'text-white', bg: 'bg-gray-800', label: 'Белый' },      // Белый на темном фоне
    { text: 'text-red-600', bg: 'bg-red-50', label: 'Красный' },    // Красный
    { text: 'text-blue-600', bg: 'bg-blue-50', label: 'Синий' },     // Синий
    { text: 'text-green-600', bg: 'bg-green-50', label: 'Зеленый' }, // Зеленый
    { text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Желтый' },// Желтый
    { text: 'text-black', bg: 'bg-gray-100', label: 'Черный' },      // Черный
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
  
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null)
  const [tempTeamName, setTempTeamName] = useState('')
  const [tempTeamColor, setTempTeamColor] = useState<{ text: string, bg: string, label: string } | null>(null)

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

  // --- АВТОМАТИЧЕСКОЕ РАСПРЕДЕЛЕНИЕ ---
  const distributeAuto = async () => {
    if (!match || goPlayers.length === 0) return
    
    // Перемешиваем игроков
    const shuffled = [...goPlayers].sort(() => Math.random() - 0.5)
    
    // Определяем реальное количество команд (не больше чем игроков)
    const actualNumTeams = Math.min(numTeams, goPlayers.length)
    
    // Создаем команды
    const newTeams: TempTeam[] = []
    for (let i = 0; i < actualNumTeams; i++) {
      newTeams.push({
        id: `temp-${i}`,
        name: `Команда ${i + 1}`,
        players: [],
        color: teamTitleColors[i % teamTitleColors.length]
      })
    }
    
    // Распределяем игроков по командам по очереди
    shuffled.forEach((player, index) => {
      const teamIndex = index % actualNumTeams
      newTeams[teamIndex].players.push(player)
    })
    
    setTeams(newTeams)
    setMode('edit')
  }

  // --- ЛОГИКА КОРЗИН ---
  const startBaskets = () => {
    // Создаем корзины по количеству команд, но не больше чем игроков
    const actualNumBaskets = Math.min(numTeams, goPlayers.length)
    setBaskets(Array.from({ length: actualNumBaskets }, () => []))
    setCurrentBasket(0)
    setMode('baskets')
  }

  const togglePlayerInBasket = (playerId: string) => {
    const newBaskets = [...baskets]
    // Проверяем, есть ли игрок уже в какой-то корзине
    for (let i = 0; i < newBaskets.length; i++) {
      if (newBaskets[i].includes(playerId)) {
        // Если игрок уже в корзине - удаляем его
        newBaskets[i] = newBaskets[i].filter(id => id !== playerId)
        setBaskets(newBaskets)
        return
      }
    }
    
    // Если игрока нет ни в одной корзине - добавляем в текущую
    if (!newBaskets[currentBasket].includes(playerId)) {
      newBaskets[currentBasket].push(playerId)
      setBaskets(newBaskets)
    }
  }

  const finalizeBaskets = () => {
    // Создаем команды только для корзин, в которых есть игроки
    const nonEmptyBaskets = baskets.filter(basket => basket.length > 0)
    
    if (nonEmptyBaskets.length === 0) {
      alert('Нет игроков в корзинах')
      return
    }
    
    const newTeams: TempTeam[] = []
    
    // Для каждой непустой корзины создаем команду
    nonEmptyBaskets.forEach((basket, basketIndex) => {
      const shuffledBasket = [...basket].sort(() => Math.random() - 0.5)
      
      // Создаем команду для этой корзины
      const team: TempTeam = {
        id: `temp-${basketIndex}`,
        name: `Команда ${basketIndex + 1}`,
        players: [],
        color: teamTitleColors[basketIndex % teamTitleColors.length]
      }
      
      // Добавляем всех игроков из корзины в эту команду
      shuffledBasket.forEach(playerId => {
        const player = goPlayers.find(p => p.id === playerId)
        if (player) {
          team.players.push(player)
        }
      })
      
      newTeams.push(team)
    })
    
    setTeams(newTeams)
    setMode('edit')
  }

  // --- РЕДАКТИРОВАНИЕ КОМАНД ---
  const movePlayerToTeam = (playerId: string, fromTeamIndex: number | null, toTeamIndex: number) => {
    const newTeams = [...teams]
    const player = goPlayers.find(p => p.id === playerId)
    
    if (!player) return
    
    // Удаляем игрока из исходной команды
    if (fromTeamIndex !== null) {
      newTeams[fromTeamIndex].players = newTeams[fromTeamIndex].players.filter((p: Player) => p.id !== playerId)
    }
    
    // Добавляем в целевую команду
    newTeams[toTeamIndex].players.push(player)
    
    // Удаляем пустые команды
    const nonEmptyTeams = newTeams.filter(team => team.players.length > 0)
    
    setTeams(nonEmptyTeams)
  }

  const removePlayerFromTeam = (playerId: string, teamIndex: number) => {
    const newTeams = [...teams]
    newTeams[teamIndex].players = newTeams[teamIndex].players.filter((p: Player) => p.id !== playerId)
    
    // Удаляем пустые команды
    const nonEmptyTeams = newTeams.filter(team => team.players.length > 0)
    
    setTeams(nonEmptyTeams)
  }

  const updateTeamName = (index: number, newName: string, newColor?: { text: string, bg: string, label: string }) => {
    const newTeams = [...teams]
    newTeams[index].name = newName
    if (newColor) {
      newTeams[index].color = newColor
    }
    setTeams(newTeams)
    setEditingTeamIndex(null)
  }

  const startEditingTeam = (index: number) => {
    setTempTeamName(teams[index].name)
    setTempTeamColor(teams[index].color || teamTitleColors[0])
    setEditingTeamIndex(index)
  }

  // --- СОХРАНЕНИЕ В БАЗУ ---
const saveTeams = async () => {
  if (!match) return
  
  console.log('=== НАЧАЛО СОХРАНЕНИЯ ===');
  console.log('Все команды перед сохранением:', teams);
  
  // Проверим каждую команду
  teams.forEach((team, index) => {
    console.log(`Команда ${index}:`, {
      name: team.name,
      color: team.color,
      playersCount: team.players.length
    });
  });
  
  try {
    // Удаляем старые команды
    await supabase.from('match_teams').delete().eq('match_id', match.id)
    
    // Создаем новые команды
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].players.length === 0) continue
      
      console.log(`Сохраняем команду ${i} с цветом:`, teams[i].color);
      
      const insertData = {
        match_id: match.id,
        name: teams[i].name,
        color_json: teams[i].color
      };
      console.log('Данные для вставки:', insertData);
      
      const { data: team, error } = await supabase
        .from('match_teams')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        console.error('Ошибка при вставке команды:', error);
      }
      
      if (team) {
        console.log('Команда сохранена, полученные данные:', team);
        
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
    
    setTimeout(() => {
      router.push(`/room/${roomId}`)
    }, 500)
    
  } catch (error) {
    console.error('Ошибка при сохранении:', error)
    alert('Произошла ошибка при сохранении')
  }
}

  if (loading) return <div className="h-screen flex items-center justify-center bg-white text-xs font-black uppercase">Загрузка...</div>

  // Режим редактирования команд
  if (mode === 'edit') {
    return (
      <div className="h-screen bg-gray-50 flex flex-col font-sans italic uppercase font-black overflow-hidden">
        <header className="px-8 py-5 bg-white border-b flex justify-between items-center shrink-0">
          <button onClick={() => setMode('menu')} className="text-[10px] bg-gray-100 px-6 py-2 rounded-full hover:bg-black hover:text-white transition-all">← Назад</button>
          <h1 className="text-xl text-blue-600 tracking-tighter">Редактирование составов</h1>
          <button 
            onClick={saveTeams}
            className="text-[10px] bg-green-500 text-white px-8 py-2 rounded-full hover:bg-green-600 transition-all shadow-lg"
          >
            Готово →
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
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
                    <div 
                      key={player.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl group"
                    >
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

                {/* Кнопки для добавления игроков из пула */}
                {goPlayers.filter(p => !teams.some(t => t.players.some((tp: Player) => tp.id === p.id))).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed">
                    <p className="text-[8px] text-gray-400 mb-2 tracking-widest">Добавить игрока:</p>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto">
                      {goPlayers
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
        </main>
      </div>
    )
  }

  // Меню выбора режима или корзины
  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans italic uppercase font-black overflow-hidden">
      <header className="px-8 py-5 bg-white border-b flex justify-between items-center shrink-0">
        <button onClick={() => router.back()} className="text-[10px] bg-gray-100 px-6 py-2 rounded-full hover:bg-black hover:text-white transition-all">← Назад</button>
        <h1 className="text-xl text-blue-600 tracking-tighter">Распределение составов</h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Список игроков */}
        <div className="w-1/3 bg-white p-8 border-r overflow-y-auto custom-scroll">
          <h2 className="text-[10px] text-gray-400 mb-6 tracking-widest">Игроки "ИДУ" ({goPlayers.length})</h2>
          <div className="space-y-2">
            {goPlayers.map(p => {
              const basketIndex = baskets.findIndex(b => b.includes(p.id))
              return (
                <div 
                  key={p.id} 
                  onClick={() => mode === 'baskets' && togglePlayerInBasket(p.id)}
                  className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer flex justify-between items-center ${
                    basketIndex !== -1 
                      ? `${basketColors[basketIndex % basketColors.length]} text-white border-transparent` 
                      : 'bg-gray-50 border-gray-100 hover:border-blue-200'
                  }`}
                >
                  <span className="text-[11px] truncate">{p.nickname}</span>
                  {basketIndex !== -1 && (
                    <span className="text-[8px] opacity-60">Корзина {basketIndex + 1}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Управление */}
        <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
          {mode === 'menu' && (
            <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-xl space-y-8">
              <div>
                <label className="text-[10px] text-gray-400 block mb-4 text-center tracking-widest">Количество команд</label>
                <div className="flex items-center justify-center gap-6">
                  <button 
                    onClick={() => setNumTeams(Math.max(2, numTeams - 1))} 
                    className="text-2xl w-12 h-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                  >
                    -
                  </button>
                  <span className="text-6xl text-blue-600 w-20 text-center">{numTeams}</span>
                  <button 
                    onClick={() => setNumTeams(Math.min(99, numTeams + 1))} 
                    className="text-2xl w-12 h-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[8px] text-gray-400 text-center mt-2">макс. 99 команд</p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={distributeAuto} 
                  className="w-full bg-blue-600 text-white py-5 rounded-[2rem] text-[10px] shadow-lg active:scale-95 transition-all"
                >
                  Авто-рандом
                </button>
                <button 
                  onClick={startBaskets} 
                  className="w-full border-2 border-blue-600 text-blue-600 py-5 rounded-[2rem] text-[10px] active:scale-95 transition-all hover:bg-blue-50"
                >
                  По корзинам
                </button>
              </div>
            </div>
          )}

          {mode === 'baskets' && (
            <div className="w-full max-w-md bg-white p-12 rounded-[3.5rem] shadow-xl text-center">
              <div className="mb-8">
                <p className="text-[10px] text-gray-400 tracking-[0.2em] mb-2">Наполнение</p>
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
                  <button 
                    onClick={() => setCurrentBasket(c => c - 1)} 
                    className="flex-1 bg-gray-100 py-5 rounded-[2rem] text-[10px] hover:bg-gray-200 transition-all"
                  >
                    ← Назад
                  </button>
                )}
                {currentBasket < baskets.length - 1 ? (
                  <button 
                    onClick={() => setCurrentBasket(c => c + 1)} 
                    className="flex-1 bg-black text-white py-5 rounded-[2rem] text-[10px] hover:bg-gray-900 transition-all"
                  >
                    Далее →
                  </button>
                ) : (
                  <button 
                    onClick={finalizeBaskets} 
                    className="flex-1 bg-green-500 text-white py-5 rounded-[2rem] text-[10px] shadow-lg hover:bg-green-600 transition-all"
                  >
                    Готово
                  </button>
                )}
              </div>
              
              {/* Индикатор прогресса */}
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: baskets.length }).map((_, i) => (
                  <div 
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentBasket 
                        ? 'w-6 bg-blue-600' 
                        : baskets[i]?.length > 0 
                          ? 'w-3 bg-green-400' 
                          : 'w-3 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}