'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

export default function RoomPage() {
    const { id: roomId } = useParams()
    const router = useRouter()
    const scrollRef = useRef<HTMLDivElement>(null)
    const [room, setRoom] = useState<any>(null)
    const [members, setMembers] = useState<any[]>([])
    const [messages, setMessages] = useState<any[]>([])
    const [teams, setTeams] = useState<any[]>([])
    const [match, setMatch] = useState<any>(null)
    const [slots, setSlots] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [showMatchForm, setShowMatchForm] = useState(false)
    const [manualName, setManualName] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)
    const [tempRoomName, setTempRoomName] = useState('')
    const [showMembersList, setShowMembersList] = useState(false)
    const [showPendingList, setShowPendingList] = useState(false)
    const [matchFormData, setMatchFormData] = useState({
        address: '',
        date: '',
        start: '',
        end: '',
        max: 10
    })

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            const { data: roomData } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .single()

            const { data: membersData } = await supabase
                .from('room_members')
                .select('*')
                .eq('room_id', roomId)

            const { data: usersData } = await supabase
                .from('users')
                .select('id, first_name, last_name')

            const enrichedMembers = membersData?.map(m => {
                const u = usersData?.find(user => user.id === m.user_id)
                return {
                    ...m,
                    first_name: u?.first_name || '—',
                    last_name: u?.last_name || '—',
                    role: m.role
                }
            }) || []

            const { data: matchData } = await supabase
                .from('matches')
                .select('*')
                .eq('room_id', roomId)
                .maybeSingle()

            if (matchData) {
                const { data: slotsData } = await supabase
                    .from('match_slots')
                    .select('*')
                    .eq('match_id', matchData.id)
                    .order('created_at', { ascending: true })

                setMatch(matchData)
                setSlots(slotsData || [])
                setMatchFormData({
                    address: matchData.address || '',
                    date: matchData.match_date || '',
                    start: matchData.start_time || '',
                    end: matchData.end_time || '',
                    max: matchData.max_players || 10
                })

                // Загружаем команды, если матч в статусе распределения
                if (matchData.status === 'teams_distributed') {
                    console.log('Статус teams_distributed, загружаем команды')

                    const { data: teamsData } = await supabase
                        .from('match_teams')
                        .select('*, color_json')
                        .eq('match_id', matchData.id)

                    console.log('Найденные команды:', teamsData)

                    if (teamsData && teamsData.length > 0) {
                        // Для каждой команды загружаем её игроков
                        const teamsWithPlayers = await Promise.all(teamsData.map(async (team) => {
                            const { data: players } = await supabase
                                .from('match_slots')
                                .select('*')
                                .eq('team_id', team.id)
                                .eq('status', 'go')

                            console.log(`Игроки команды ${team.name}:`, players)

                            return {
                                ...team,
                                players: players || [],
                                color: team.color_json
                            }
                        }))
                        console.log('КОМАНДЫ С ЦВЕТАМИ:', teamsWithPlayers)

                        setTeams(teamsWithPlayers)
                    } else {
                        setTeams([])
                    }
                } else {
                    setTeams([])
                }
            } else {
                setMatch(null)
                setSlots([])
                setTeams([])
            }

            const { data: messagesData } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })

            if (roomData) {
                setRoom(roomData)
                setTempRoomName(roomData.name)
                setMembers(enrichedMembers)
                setMessages(messagesData || [])
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        const channel = supabase
            .channel(`room_realtime_${roomId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'match_slots' },
                () => fetchData()
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new
                        setMessages(prev => {
                            if (prev.some(m => m.id === newMessage.id)) return prev
                            return [...prev, newMessage].sort((a, b) =>
                                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            )
                        })
                    } else {
                        fetchData()
                    }
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'matches' },
                () => fetchData()
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'room_members' },
                () => fetchData()
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'match_teams' },
                () => fetchData()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [roomId])

    // --- ПРОВЕРКИ РОЛЕЙ ---
    const currentMember = members.find(m => m.user_id === userId);
    const currentUserRole = currentMember?.role;

    const canManageRoom = currentUserRole === 'owner' || currentUserRole === 'admin';
    const canVote = currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'player';
    const isApproved = currentUserRole !== 'pending';

    // Фильтры для списков
    const approvedMembers = members.filter(m => m.role !== 'pending');
    const pendingMembers = members.filter(m => m.role === 'pending');
    const goPlayers = slots.filter(s => s.status === 'go')
    const reservePlayers = slots.filter(s => s.status === 'reserve')
    const notGoPlayers = slots.filter(s => s.status === 'not_go')

    // --- УПРАВЛЕНИЕ УЧАСТНИКАМИ ---
    const handleApproveMember = async (memberId: string) => {
        if (!canManageRoom) return;
        await supabase
            .from('room_members')
            .update({ approved: true, role: 'player' })
            .eq('id', memberId)
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!canManageRoom) return;
        if (!window.confirm('Удалить участника из комнаты?')) return
        await supabase
            .from('room_members')
            .delete()
            .eq('id', memberId)
    }

    const handleMakeAdmin = async (memberUserId: string) => {
        if (!canManageRoom) {
            alert('У вас нет прав для этого действия');
            return;
        }
        if (!window.confirm('Назначить этого участника администратором?')) return;

        try {
            const { error: updateError } = await supabase
                .from('room_members')
                .update({ role: 'admin' })
                .eq('user_id', memberUserId)
                .eq('room_id', roomId);

            if (updateError) {
                console.error('Ошибка при назначении админа:', updateError);
                alert('Не удалось назначить администратора');
            } else {
                await fetchData();
            }
        } catch (err) {
            console.error('Непредвиденная ошибка:', err);
            alert('Произошла непредвиденная ошибка');
        }
    };

    const handleRemoveAdmin = async (memberUserId: string) => {
        if (!canManageRoom) {
            alert('У вас нет прав для этого действия');
            return;
        }
        if (!window.confirm('Снять с участника права администратора?')) return;

        try {
            const { error: updateError } = await supabase
                .from('room_members')
                .update({ role: 'player' })
                .eq('user_id', memberUserId)
                .eq('room_id', roomId);

            if (updateError) {
                console.error('Ошибка при снятии админа:', updateError);
                alert('Не удалось снять права администратора');
            } else {
                await fetchData();
            }
        } catch (err) {
            console.error('Непредвиденная ошибка:', err);
            alert('Произошла непредвиденная ошибка');
        }
    };

    // --- ЛОГИКА ГОЛОСОВАНИЯ ---
    const handleVote = async (status: 'go' | 'reserve' | 'not_go') => {
        if (!match || !userId || !canVote) return;

        const mySlot = slots.find(s => s.user_id === userId);
        const myNick = members.find(m => m.user_id === userId)?.nickname || 'Игрок';

        const { data: currentSlots } = await supabase
            .from('match_slots')
            .select('*')
            .eq('match_id', match.id)
            .eq('status', 'go');

        const currentGoCount = currentSlots?.length || 0;

        let finalStatus = status;

        if (status === 'go') {
            if (mySlot?.status === 'go') {
                finalStatus = 'go';
            } else if (currentGoCount >= match.max_players) {
                finalStatus = 'reserve';
            }
        }

        if (mySlot?.status === 'reserve' && status === 'go' && currentGoCount >= match.max_players) {
            return;
        }

        if (mySlot?.status === 'reserve' && status === 'reserve') {
            return;
        }

        if (mySlot?.status === 'not_go' && status === 'not_go') {
            return;
        }

        const now = new Date().toISOString();

        try {
            if (mySlot) {
                await supabase
                    .from('match_slots')
                    .update({ status: finalStatus, created_at: now })
                    .eq('id', mySlot.id);
            } else {
                await supabase
                    .from('match_slots')
                    .insert({
                        match_id: match.id,
                        user_id: userId,
                        nickname: myNick,
                        status: finalStatus,
                        created_at: now
                    });
            }

            if (mySlot?.status === 'go' && finalStatus !== 'go') {
                const { data: freshSlots } = await supabase
                    .from('match_slots')
                    .select('*')
                    .eq('match_id', match.id)
                    .order('created_at', { ascending: true });

                if (freshSlots) {
                    const goCountAfter = freshSlots.filter(s => s.status === 'go').length;
                    const freeSpots = match.max_players - goCountAfter;

                    if (freeSpots > 0) {
                        const reservePlayers = freshSlots
                            .filter(s => s.status === 'reserve')
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                        for (let i = 0; i < Math.min(freeSpots, reservePlayers.length); i++) {
                            await supabase
                                .from('match_slots')
                                .update({ status: 'go', created_at: new Date().toISOString() })
                                .eq('id', reservePlayers[i].id);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при голосовании:', error);
        }
    };

    const deleteSlot = async (slotId: string) => {
        if (!canManageRoom) return;
        if (!window.confirm('Удалить игрока из списка?')) return
        await supabase.from('match_slots').delete().eq('id', slotId)
    }

    const addManualPlayer = async () => {
        if (!manualName.trim() || !match || !canManageRoom) return

        const { data: currentGoSlots } = await supabase
            .from('match_slots')
            .select('*')
            .eq('match_id', match.id)
            .eq('status', 'go');

        const goCount = currentGoSlots?.length || 0;
        const status = goCount >= match.max_players ? 'reserve' : 'go'

        await supabase.from('match_slots').insert({
            match_id: match.id,
            nickname: `// ${manualName.trim()} //`,
            status,
            created_at: new Date().toISOString()
        })
        setManualName('')
    }

    const saveMatch = async () => {
    if (!canManageRoom) {
        console.log('Нет прав для создания матча');
        return;
    }
    
    console.log('Создаем матч с данными:', matchFormData);
    
    // Валидация
    if (!matchFormData.address || !matchFormData.date || !matchFormData.start) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    const payload = {
        room_id: roomId,
        address: matchFormData.address,
        match_date: matchFormData.date,
        start_time: matchFormData.start,
        end_time: matchFormData.end || null,
        max_players: matchFormData.max || 10,
        status: 'voting'
    };
    
    try {
        let result;
        if (match) {
            // Обновление существующего матча
            result = await supabase
                .from('matches')
                .update(payload)
                .eq('id', match.id);
        } else {
            // Создание нового матча
            result = await supabase
                .from('matches')
                .insert([payload]);
        }
        
        if (result.error) {
            console.error('Ошибка Supabase:', result.error);
            alert('Ошибка при сохранении: ' + result.error.message);
        } else {
            setShowMatchForm(false);
            await fetchData(); // Обновляем данные
        }
    } catch (error) {
        console.error('Ошибка при сохранении матча:', error);
        alert('Произошла ошибка');
    }
};

    const deleteMatch = async () => {
        if (!canManageRoom) return;
        if (!window.confirm('Удалить игру полностью?')) return
        await supabase.from('matches').delete().eq('id', match.id)
        setMatch(null)
        setSlots([])
    }

    const updateRoomName = async () => {
        if (!canManageRoom) return;
        if (!tempRoomName.trim()) return
        await supabase.from('rooms').update({ name: tempRoomName.trim() }).eq('id', roomId)
        setIsEditingName(false)
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !isApproved) return

        const myNick = members.find(m => m.user_id === userId)?.nickname || 'Пользователь'

        try {
            await supabase.from('messages').insert({
                room_id: roomId,
                user_id: userId,
                nickname: myNick,
                content: newMessage.trim(),
                created_at: new Date().toISOString()
            })
            setNewMessage('')
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error)
        }
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    if (loading) return <div className="h-screen flex items-center justify-center bg-white">...</div>

    return (
        <div className="h-screen bg-white text-black flex flex-col font-sans overflow-hidden leading-none italic">
            <header className="px-8 py-4 border-b flex justify-between items-center bg-white shrink-0 shadow-sm z-20">
                <div className="flex flex-col gap-1">
                    {isEditingName && canManageRoom ? (
                        <div className="flex gap-2 items-center">
                            <input
                                value={tempRoomName}
                                onChange={(e) => setTempRoomName(e.target.value)}
                                className="text-xl font-black uppercase text-blue-600 border-b-2 border-blue-600 outline-none w-48 bg-transparent"
                                autoFocus
                            />
                            <button onClick={updateRoomName} className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black">Ок</button>
                        </div>
                    ) : (
                        <h1
                            onClick={() => canManageRoom && setIsEditingName(true)}
                            className={`text-2xl font-black uppercase text-blue-600 tracking-tighter ${canManageRoom ? 'cursor-pointer hover:opacity-70' : ''}`}
                        >
                            {room?.name}
                        </h1>
                    )}
                    <div className="flex items-center gap-4">
                        {/* Полный ID команды - кликабельный */}
                        <button
                            onClick={() => { navigator.clipboard.writeText(roomId as string); alert('ID команды скопирован') }}
                            className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors font-mono"
                            title="Нажмите, чтобы скопировать"
                        >
                            🆔 {roomId}
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-[10px] font-black uppercase bg-gray-50 px-5 py-2 rounded-full hover:bg-black hover:text-white transition-all"
                >
                    ← Назад
                </button>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-100 p-4 gap-4">
                <div className="md:w-[40%] flex flex-col gap-4 overflow-y-auto custom-scroll pr-1">
                    {/* Карточка с составом на игру */}
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 flex flex-col min-h-fit">
                        <div className="flex justify-between items-center mb-6">
    <div className="flex gap-4">
        {/* Кнопка "Состав" - превращаем заголовок в кнопку */}
        <button
            onClick={() => setShowMembersList(true)}
            className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors"
        >
            ⚽ Состав
        </button>

        {/* Кнопка "Заявки" - для владельцев и админов */}
        {canManageRoom && (
            <button
                onClick={() => setShowPendingList(true)}
                className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors relative"
            >
                📩 Заявки
                {pendingMembers.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                        {pendingMembers.length}
                    </span>
                )}
            </button>
        )}

        {/* Кнопка "Выйти из состава" - для всех, кроме владельца */}
        {currentUserRole !== 'owner' && (
            <button
                onClick={async () => {
                    if (window.confirm('Вы уверены, что хотите покинуть команду?')) {
                        await supabase
                            .from('room_members')
                            .delete()
                            .eq('room_id', roomId)
                            .eq('user_id', userId);
                        router.push('/dashboard');
                    }
                }}
                className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
            >
                🚪 Выйти из состава
            </button>
        )}
    </div>

    {/* Кнопка "Создать игру" - переименованная и перенесенная справа */}
    {canManageRoom && (
    <button
        onClick={() => setShowMatchForm(true)}
        className="text-xs font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors"
    >
        ⚡ {match ? 'Редактировать игру' : 'Создать игру'}
    </button>
)}
</div>

                        {canManageRoom && match && (
                            <button
                                onClick={() => router.push(`/room/${roomId}/matches`)}
                                className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all mb-4"
                            >
                                ⚽ Сформировать составы
                            </button>
                        )}

                        {match ? (
                            <div className="flex flex-col gap-6">
                                <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden shrink-0">
                                    {/* Кнопка удаления игры - только для админов и владельцев */}
    {canManageRoom && (
        <button
            onClick={async () => {
                if (window.confirm('Удалить игру? Все голоса и составы будут потеряны.')) {
                    await supabase.from('matches').delete().eq('id', match.id);
                    setMatch(null);
                    setSlots([]);
                    setTeams([]);
                }
            }}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-[10px] font-black uppercase transition-colors"
        >
            ✕ Удалить игру
        </button>
    )}
                                    <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest truncate">{match.address}</p>
                                    <p className="text-xl font-black uppercase mb-4">{match.match_date ? new Date(match.match_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '—'}</p>
                                    <div className="flex gap-6 text-sm font-bold">
                                        <div><span className="opacity-60 text-[9px] block uppercase mb-1">Старт</span>{match.start_time?.slice(0, 5)}</div>
                                        <div><span className="opacity-60 text-[9px] block uppercase mb-1">Конец</span>{match.end_time?.slice(0, 5) || '—'}</div>
                                        <div className="ml-auto text-right text-blue-200">{goPlayers.length}/{match.max_players}</div>
                                    </div>
                                </div>

                                {match?.status === 'teams_distributed' ? (
                                    <div className="col-span-3">
                                        <h3 className="text-xs font-black uppercase text-gray-400 mb-4">Составы на игру</h3>
                                        {teams.length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {teams.map((team) => {
                                                    const teamColor = team.color_json || team.color;
                                                    return (
                                                        <div key={team.id} className="bg-white rounded-2xl p-4 shadow-sm border">
                                                            <h4
                                                                className={`text-sm font-black mb-3 border-b pb-2 px-2 py-1 rounded-lg inline-block ${teamColor?.bg || 'bg-transparent'
                                                                    }`}
                                                            >
                                                                <span className={teamColor?.text || 'text-blue-600'}>
                                                                    {team.name}
                                                                </span>
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {team.players && team.players.length > 0 ? (
                                                                    team.players.map((player: any) => (
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
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-center text-gray-400 py-8">Загрузка составов...</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3 items-start flex-1 shrink-0">
                                        <div className="flex flex-col gap-3">
                                            <div className="bg-green-50/50 border border-green-100 p-4 rounded-3xl min-h-[350px]">
                                                <p className="text-[8px] font-black uppercase text-green-600 mb-3 text-center tracking-tighter">
                                                    Идут ({goPlayers.length}/{match.max_players})
                                                </p>
                                                <div className="space-y-2">
                                                    {goPlayers.map((p) => (
                                                        <div key={p.id} className="text-[11px] font-bold flex flex-col border-b border-green-100 pb-1 relative not-italic">
                                                            <span className="truncate pr-4">{p.nickname}</span>
                                                            {canManageRoom && <button onClick={() => deleteSlot(p.id)} className="absolute right-0 top-0 text-red-500 font-black">×</button>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {canVote && (
                                                <button
                                                    onClick={() => handleVote('go')}
                                                    className="w-full bg-green-500 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
                                                >
                                                    Иду
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-3xl min-h-[350px]">
                                                <p className="text-[8px] font-black uppercase text-orange-600 mb-3 text-center tracking-tighter">Резерв ({reservePlayers.length})</p>
                                                <div className="space-y-2 text-orange-800">
                                                    {reservePlayers.map((p) => (
                                                        <div key={p.id} className="text-[11px] font-bold flex flex-col border-b border-orange-100 pb-1 relative not-italic">
                                                            <span className="truncate pr-4 text-orange-600 font-black">{p.nickname}</span>
                                                            {canManageRoom && <button onClick={() => deleteSlot(p.id)} className="absolute right-0 top-0 text-red-500 font-black">×</button>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {canVote && (
                                                <button
                                                    onClick={() => handleVote('reserve')}
                                                    className="w-full bg-orange-500 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
                                                >
                                                    В резерв
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-3xl min-h-[350px]">
                                                <p className="text-[8px] font-black uppercase text-gray-400 mb-3 text-center tracking-tighter">Не идут ({notGoPlayers.length})</p>
                                                <div className="space-y-2 italic text-gray-400">
                                                    {notGoPlayers.map((p) => (
                                                        <div key={p.id} className="text-[11px] font-medium flex flex-col border-b border-gray-100 pb-1 relative not-italic">
                                                            <span className="truncate pr-4 text-gray-400">{p.nickname}</span>
                                                            {canManageRoom && <button onClick={() => deleteSlot(p.id)} className="absolute right-0 top-0 text-gray-400 font-black">×</button>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {canVote && (
                                                <button
                                                    onClick={() => handleVote('not_go')}
                                                    className="w-full bg-white border-2 border-gray-200 text-gray-400 py-4 rounded-2xl text-[9px] font-black uppercase active:scale-95"
                                                >
                                                    Не иду
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {canManageRoom && (
                                    <div className="flex gap-2 pt-6 border-t border-dashed mt-2 shrink-0">
                                        <input
                                            value={manualName}
                                            onChange={e => setManualName(e.target.value)}
                                            placeholder="Вписать вручную..."
                                            className="flex-1 bg-gray-50 px-5 py-3 rounded-2xl text-xs font-bold outline-none border border-gray-100 italic"
                                        />
                                        <button onClick={addManualPlayer} className="bg-black text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase active:scale-95 shadow-md">Добавить</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-20 text-center flex flex-col items-center opacity-20 grayscale">
                                <div className="text-4xl mb-4">⚽</div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">На поле тишина</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ЧАТ */}
                <div className="md:w-[60%] bg-white rounded-[2.5rem] flex flex-col shadow-sm border border-gray-100 overflow-hidden h-full relative">
                    <div className="px-8 py-5 border-b shrink-0 flex justify-between items-center">
                        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">💬 Чат раздевалки</h2>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth bg-gray-50/20 custom-scroll">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.user_id === userId ? 'items-end' : 'items-start'}`}>
                                <div className="flex gap-2 items-center mb-1.5 px-1">
                                    <span className={`text-[9px] font-black uppercase ${msg.user_id === userId ? 'text-blue-500' : 'text-gray-400'}`}>{msg.nickname}</span>
                                    <span className="text-[7px] font-bold text-gray-300 uppercase">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className={`max-w-[85%] px-6 py-4 rounded-[1.8rem] text-[14px] font-semibold leading-tight shadow-sm transition-all not-italic ${msg.user_id === userId ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                    {isApproved ? (
                        <form onSubmit={sendMessage} className="p-6 bg-white border-t flex gap-3 shrink-0">
                            <input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Сообщение..."
                                className="flex-1 bg-gray-50 px-6 py-4 rounded-2xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-blue-100 shadow-inner"
                            />
                            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase active:scale-95 shadow-lg">Отправить</button>
                        </form>
                    ) : (
                        <div className="p-6 bg-white border-t text-center">
                            <p className="text-[10px] font-black uppercase text-gray-400">Чат после подтверждения</p>
                        </div>
                    )}
                </div>
            </main>

            {/* МОДАЛКА СПИСКА УЧАСТНИКОВ */}
            {showMembersList && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl scale-in not-italic">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-blue-600">Штат команды ({approvedMembers.length})</h2>
                            <button onClick={() => setShowMembersList(false)} className="text-gray-400 hover:text-black text-xl font-black">✕</button>
                        </div>
                        <div className="space-y-3">
                            {members.map((member) => (
                                <div key={member.id} className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-sm">{member.nickname || '—'}</p>
                                        <p className="text-xs text-gray-500">{member.first_name} {member.last_name}</p>
                                        <p className="text-[9px] font-black uppercase mt-1">
                                            {member.role === 'owner' && <span className="text-purple-600">Владелец</span>}
                                            {member.role === 'admin' && <span className="text-blue-600">Админ</span>}
                                            {member.role === 'player' && <span className="text-green-600">Игрок</span>}
                                            {member.role === 'pending' && <span className="text-yellow-500">На подтверждении</span>}
                                        </p>
                                    </div>
                                    {canManageRoom && member.user_id !== userId && (
                                        <div className="flex gap-2">
                                            {member.role === 'pending' && (
                                                <button
                                                    onClick={() => handleApproveMember(member.id)}
                                                    className="bg-green-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase"
                                                >
                                                    Подтвердить
                                                </button>
                                            )}

                                            {/* Админ может управлять админами, но не владельцем */}
                                            {canManageRoom && member.role !== 'owner' && (
                                                <>
                                                    {member.role === 'admin' ? (
                                                        <button
                                                            onClick={() => handleRemoveAdmin(member.user_id)}
                                                            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase"
                                                        >
                                                            Убрать админа
                                                        </button>
                                                    ) : member.role === 'player' && (
                                                        <button
                                                            onClick={() => handleMakeAdmin(member.user_id)}
                                                            className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase"
                                                        >
                                                            Сделать админом
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* Удалить можно всех, кроме владельца */}
                                            {member.role !== 'owner' && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase"
                                                >
                                                    Удалить
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКА ОЖИДАЮЩИХ ПОДТВЕРЖДЕНИЯ */}
            {showPendingList && canManageRoom && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl scale-in not-italic">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-yellow-500">Ожидают ({pendingMembers.length})</h2>
                            <button onClick={() => setShowPendingList(false)} className="text-gray-400 hover:text-black text-xl font-black">✕</button>
                        </div>
                        <div className="space-y-3">
                            {pendingMembers.map((member) => (
                                <div key={member.id} className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-sm">{member.nickname || '—'}</p>
                                        <p className="text-xs text-gray-500">{member.first_name} {member.last_name}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApproveMember(member.id)}
                                            className="bg-green-500 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase"
                                        >
                                            Подтвердить
                                        </button>
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            className="bg-red-500 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ МАТЧА */}
            {showMatchForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-md shadow-2xl scale-in not-italic">
                        <h2 className="text-3xl font-black uppercase tracking-tighter mb-8 text-blue-600">Матч</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">Место</label>
                                <input
                                    value={matchFormData.address}
                                    onChange={e => setMatchFormData({ ...matchFormData, address: e.target.value })}
                                    className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">Дата</label>
                                <input
                                    type="date"
                                    value={matchFormData.date}
                                    onChange={e => setMatchFormData({ ...matchFormData, date: e.target.value })}
                                    className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">Старт</label>
                                    <input
                                        type="time"
                                        value={matchFormData.start}
                                        onChange={e => setMatchFormData({ ...matchFormData, start: e.target.value })}
                                        className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">Конец</label>
                                    <input
                                        type="time"
                                        value={matchFormData.end}
                                        onChange={e => setMatchFormData({ ...matchFormData, end: e.target.value })}
                                        className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none shadow-inner"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">Лимит</label>
                                <input
                                    type="number"
                                    value={matchFormData.max}
                                    onChange={e => setMatchFormData({ ...matchFormData, max: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button onClick={saveMatch} className="flex-1 bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Ок</button>
                                <button onClick={() => setShowMatchForm(false)} className="flex-1 bg-gray-100 text-gray-400 py-5 rounded-[2rem] font-black uppercase text-xs">Назад</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}