'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'
import { Room, Member, Match, Slot, Team, Message } from './components/types'
import RoomHeader from './components/RoomHeader'
import MatchCard from './components/MatchCard'
import VotingPanel from './components/VotingPanel'
import TeamsDisplay from './components/TeamsDisplay'
import ActionButtons from './components/ActionButtons'
import Chat from './components/Chat'
import MembersModal from './components/MembersModal'
import PendingModal from './components/PendingModal'
import MatchFormModal from './components/MatchFormModal'

export default function RoomPage() {
    const { id: roomId } = useParams()
    const router = useRouter()
    const scrollRef = useRef<HTMLDivElement>(null)
    
    // Состояния
    const [room, setRoom] = useState<Room | null>(null)
    const [members, setMembers] = useState<Member[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [teams, setTeams] = useState<Team[]>([])
    const [match, setMatch] = useState<Match | null>(null)
    const [slots, setSlots] = useState<Slot[]>([])
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

    // Загрузка данных
    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            const [roomRes, membersRes, usersRes, matchesRes, messagesRes] = await Promise.all([
                supabase.from('rooms').select('*').eq('id', roomId).single(),
                supabase.from('room_members').select('*').eq('room_id', roomId),
                supabase.from('users').select('id, first_name, last_name'),
                supabase.from('matches').select('*').eq('room_id', roomId),
                supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true })
            ])

            console.log('fetchData - matchesRes:', matchesRes)

            if (roomRes.data) setRoom(roomRes.data)
            if (roomRes.data) setTempRoomName(roomRes.data.name)

            if (membersRes.data && usersRes.data) {
                const enriched = membersRes.data.map(m => ({
                    ...m,
                    first_name: usersRes.data.find(u => u.id === m.user_id)?.first_name || '—',
                    last_name: usersRes.data.find(u => u.id === m.user_id)?.last_name || '—'
                }))
                setMembers(enriched)
            }

            if (matchesRes.data && matchesRes.data.length > 0) {
                const latestMatch = matchesRes.data[matchesRes.data.length - 1]
                setMatch(latestMatch)
                
                const { data: slotsData } = await supabase
                    .from('match_slots')
                    .select('*')
                    .eq('match_id', latestMatch.id)
                    .order('created_at', { ascending: true })
                setSlots(slotsData || [])
                
                setMatchFormData({
                    address: latestMatch.address || '',
                    date: latestMatch.match_date || '',
                    start: latestMatch.start_time || '',
                    end: latestMatch.end_time || '',
                    max: latestMatch.max_players || 10
                })

                if (latestMatch.status === 'teams_distributed') {
                    const { data: teamsData } = await supabase
                        .from('match_teams')
                        .select('*, color_json')
                        .eq('match_id', latestMatch.id)

                    if (teamsData) {
                        const teamsWithPlayers = await Promise.all(teamsData.map(async (team) => {
                            const { data: players } = await supabase
                                .from('match_slots')
                                .select('*')
                                .eq('team_id', team.id)
                                .eq('status', 'go')
                            return { ...team, players: players || [], color: team.color_json }
                        }))
                        setTeams(teamsWithPlayers)
                    }
                }
            } else {
                setMatch(null)
                setSlots([])
                setTeams([])
            }

            if (messagesRes.data) setMessages(messagesRes.data)
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'match_slots' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMessage = payload.new as Message
                    setMessages(prev => [...prev, newMessage].sort((a, b) => 
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    ))
                } else {
                    fetchData()
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'match_teams' }, () => fetchData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [roomId])

    // Проверки ролей
    const currentMember = members.find(m => m.user_id === userId)
    const currentUserRole = currentMember?.role
    const canManageRoom = currentUserRole === 'owner' || currentUserRole === 'admin'
    const canVote = currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'player'
    const isApproved = currentUserRole !== 'pending'

    // Фильтры
    const approvedMembers = members.filter(m => m.role !== 'pending')
    const pendingMembers = members.filter(m => m.role === 'pending')
    const goPlayers = slots.filter(s => s.status === 'go')
    const reservePlayers = slots.filter(s => s.status === 'reserve')
    const notGoPlayers = slots.filter(s => s.status === 'not_go')

    // --- Обработчики ---
    const handleVote = async (status: 'go' | 'reserve' | 'not_go') => {
        if (!match || !userId || !canVote) return

        const mySlot = slots.find(s => s.user_id === userId)
        const myNick = members.find(m => m.user_id === userId)?.nickname || 'Игрок'
        
        const { data: currentSlots } = await supabase
            .from('match_slots')
            .select('*')
            .eq('match_id', match.id)
            .eq('status', 'go')
        
        const currentGoCount = currentSlots?.length || 0
        let finalStatus = status

        if (status === 'go') {
            if (mySlot?.status === 'go') {
                finalStatus = 'go'
            } else if (currentGoCount >= match.max_players) {
                finalStatus = 'reserve'
            }
        }

        if (mySlot?.status === 'reserve' && status === 'go' && currentGoCount >= match.max_players) return
        if (mySlot?.status === 'reserve' && status === 'reserve') return
        if (mySlot?.status === 'not_go' && status === 'not_go') return

        const now = new Date().toISOString()

        try {
            if (mySlot) {
                await supabase
                    .from('match_slots')
                    .update({ status: finalStatus, created_at: now })
                    .eq('id', mySlot.id)
            } else {
                await supabase
                    .from('match_slots')
                    .insert({
                        match_id: match.id,
                        user_id: userId,
                        nickname: myNick,
                        status: finalStatus,
                        created_at: now
                    })
            }

            if (mySlot?.status === 'go' && finalStatus !== 'go') {
                const { data: freshSlots } = await supabase
                    .from('match_slots')
                    .select('*')
                    .eq('match_id', match.id)
                    .order('created_at', { ascending: true })

                if (freshSlots) {
                    const goCountAfter = freshSlots.filter(s => s.status === 'go').length
                    const freeSpots = match.max_players - goCountAfter

                    if (freeSpots > 0) {
                        const reservePlayers = freshSlots
                            .filter(s => s.status === 'reserve')
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

                        for (let i = 0; i < Math.min(freeSpots, reservePlayers.length); i++) {
                            await supabase
                                .from('match_slots')
                                .update({ status: 'go', created_at: new Date().toISOString() })
                                .eq('id', reservePlayers[i].id)
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при голосовании:', error)
        }
    }

    const deleteSlot = async (slotId: string) => {
        if (!canManageRoom) return
        if (!window.confirm('Удалить игрока из списка?')) return
        await supabase.from('match_slots').delete().eq('id', slotId)
    }

    const addManualPlayer = async () => {
        if (!manualName.trim() || !match || !canManageRoom) return

        const { data: currentGoSlots } = await supabase
            .from('match_slots')
            .select('*')
            .eq('match_id', match.id)
            .eq('status', 'go')

        const goCount = currentGoSlots?.length || 0
        const status = goCount >= match.max_players ? 'reserve' : 'go'

        await supabase.from('match_slots').insert({
            match_id: match.id,
            nickname: `// ${manualName.trim()} //`,
            status,
            created_at: new Date().toISOString()
        })
        setManualName('')
    }

    const handleApproveMember = async (memberId: string) => {
        if (!canManageRoom) return
        await supabase
            .from('room_members')
            .update({ approved: true, role: 'player' })
            .eq('id', memberId)
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!canManageRoom) return
        if (!window.confirm('Удалить участника из комнаты?')) return
        await supabase
            .from('room_members')
            .delete()
            .eq('id', memberId)
    }

    const handleMakeAdmin = async (memberUserId: string) => {
        if (!canManageRoom) return
        if (!window.confirm('Назначить этого участника администратором?')) return

        try {
            const { error } = await supabase
                .from('room_members')
                .update({ role: 'admin' })
                .eq('user_id', memberUserId)
                .eq('room_id', roomId)

            if (!error) await fetchData()
        } catch (err) {
            console.error('Ошибка:', err)
        }
    }

    const handleRemoveAdmin = async (memberUserId: string) => {
        if (!canManageRoom) return
        if (!window.confirm('Снять с участника права администратора?')) return

        try {
            const { error } = await supabase
                .from('room_members')
                .update({ role: 'player' })
                .eq('user_id', memberUserId)
                .eq('room_id', roomId)

            if (!error) await fetchData()
        } catch (err) {
            console.error('Ошибка:', err)
        }
    }

    const handleLeaveRoom = async () => {
    if (!window.confirm('Вы уверены, что хотите покинуть команду?')) return
    
    try {
        const { error } = await supabase
            .from('room_members')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', userId)
        
        if (error) {
            console.error('Ошибка при выходе из команды:', error)
            alert('Не удалось покинуть команду')
            return
        }
        
        router.push('/dashboard')
    } catch (err) {
        console.error('Непредвиденная ошибка:', err)
        alert('Произошла ошибка')
    }
}

    const handleOpenMatchForm = () => {
        if (match) {
            alert('Сначала завершите или удалите текущий матч')
            return
        }
        console.log('Opening match form')
        setShowMatchForm(true)
    }

    const saveMatch = async () => {
        console.log('=== НАЧАЛО saveMatch ===')
        console.log('canManageRoom:', canManageRoom)
        console.log('match существует?', match)
        console.log('formData:', matchFormData)
        
        if (!canManageRoom) {
            console.log('Нет прав для создания матча')
            return
        }

        if (match) {
            alert('Матч уже существует. Сначала удалите текущий матч.')
            return
        }

        if (!matchFormData.address || !matchFormData.date || !matchFormData.start) {
            console.log('Не заполнены обязательные поля')
            alert('Заполните место, дату и время начала')
            return
        }

        const payload = {
            room_id: roomId,
            address: matchFormData.address,
            match_date: matchFormData.date,
            start_time: matchFormData.start,
            end_time: matchFormData.end || null,
            max_players: matchFormData.max || 10,
            status: 'voting'
        }
        
        console.log('Payload для отправки:', payload)

        try {
            console.log('Создаем новый матч')
            const result = await supabase
                .from('matches')
                .insert([payload])
            
            console.log('Ответ от Supabase:', result)
            
            if (result.error) {
                console.error('Ошибка Supabase:', result.error)
                alert('Ошибка при сохранении: ' + result.error.message)
            } else {
                console.log('Матч успешно сохранен')
                setShowMatchForm(false)
                
                setTimeout(async () => {
                    await fetchData()
                }, 300)
            }
        } catch (error) {
            console.error('Непредвиденная ошибка:', error)
            alert('Произошла ошибка')
        }
    }

    const deleteMatch = async () => {
        if (!canManageRoom || !match) return
        if (!window.confirm('Удалить игру полностью?')) return
        await supabase.from('matches').delete().eq('id', match.id)
        setMatch(null)
        setSlots([])
        setTeams([])
    }

    const updateRoomName = async () => {
        if (!canManageRoom || !tempRoomName.trim()) return
        await supabase.from('rooms').update({ name: tempRoomName.trim() }).eq('id', roomId)
        setIsEditingName(false)
        await fetchData()
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
            <RoomHeader
                roomName={room?.name || ''}
                roomId={roomId as string}
                canManageRoom={canManageRoom}
                isEditingName={isEditingName}
                tempRoomName={tempRoomName}
                setIsEditingName={setIsEditingName}
                setTempRoomName={setTempRoomName}
                updateRoomName={updateRoomName}
                onBack={() => router.push('/dashboard')}
            />

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-100 p-4 gap-4">
                {/* Левая колонка */}
                <div className="md:w-[40%] flex flex-col gap-4 overflow-y-auto custom-scroll pr-1">
                    {/* Добавляем отступ сверху, чтобы кнопки не перекрывались шапкой */}
                    <div className="pt-2">
                        {/* Кнопки управления - СВЕРХУ */}
                        <ActionButtons
                            canManageRoom={canManageRoom}
                            currentUserRole={currentUserRole}
                            pendingCount={pendingMembers.length}
                            onShowMembers={() => setShowMembersList(true)}
                            onShowPending={() => setShowPendingList(true)}
                            onShowMatchForm={handleOpenMatchForm}
                        />
                    </div>
                    
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 flex flex-col min-h-fit">
                        {match && (
                            <>
                                <MatchCard
                                    address={match.address}
                                    matchDate={match.match_date}
                                    startTime={match.start_time}
                                    endTime={match.end_time}
                                    goCount={goPlayers.length}
                                    maxPlayers={match.max_players}
                                    canManageRoom={canManageRoom}
                                    onDelete={deleteMatch}
                                    onEdit={() => setShowMatchForm(true)}
                                />
                                
                                {/* Кнопка "Сформировать составы" между карточкой и панелью голосования */}
                                {canManageRoom && match && match.status !== 'teams_distributed' && (
                                    <button
                                        onClick={() => router.push(`/room/${roomId}/matches`)}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all my-4 w-full"
                                    >
                                        ⚽ Сформировать составы
                                    </button>
                                )}
                                
                                {/* Добавляем отступ перед панелью голосования */}
                                <div className="mt-2">
                                    {match.status === 'teams_distributed' ? (
                                        <TeamsDisplay teams={teams} />
                                    ) : (
                                        <VotingPanel
                                            matchId={match.id}
                                            goPlayers={goPlayers}
                                            reservePlayers={reservePlayers}
                                            notGoPlayers={notGoPlayers}
                                            canManageRoom={canManageRoom}
                                            canVote={canVote}
                                            maxPlayers={match.max_players}
                                            onVote={handleVote}
                                            onDeleteSlot={deleteSlot}
                                            onAddManualPlayer={addManualPlayer}
                                            manualName={manualName}
                                            setManualName={setManualName}
                                            showManualInput={canManageRoom}
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {!match && (
                            <div className="py-20 text-center flex flex-col items-center opacity-20 grayscale">
                                <div className="text-4xl mb-4">⚽</div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">На поле тишина</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Правая колонка - Чат */}
                <Chat
                    messages={messages}
                    userId={userId}
                    isApproved={isApproved}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    onSendMessage={sendMessage}
                    scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
                />
            </main>

            {/* Модалки */}
            <MembersModal
                isOpen={showMembersList}
                onClose={() => setShowMembersList(false)}
                members={members}
                approvedCount={approvedMembers.length}
                canManageRoom={canManageRoom}
                currentUserRole={currentUserRole}
                userId={userId}
                onApprove={handleApproveMember}
                onMakeAdmin={handleMakeAdmin}
                onRemoveAdmin={handleRemoveAdmin}
                onRemove={handleRemoveMember}
                onLeave={handleLeaveRoom}
            />

            <PendingModal
                isOpen={showPendingList}
                onClose={() => setShowPendingList(false)}
                pendingMembers={pendingMembers}
                onApprove={handleApproveMember}
                onRemove={handleRemoveMember}
            />

            <MatchFormModal
                isOpen={showMatchForm}
                onClose={() => setShowMatchForm(false)}
                formData={matchFormData}
                setFormData={setMatchFormData}
                onSave={saveMatch}
            />
        </div>
    )
}