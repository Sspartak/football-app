'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Room, Member, Match, Slot, Team, Message } from './types'
import RoomHeader from './components/RoomHeader'
import MatchCard from './components/MatchCard'
import VotingPanel from './components/VotingPanel'
import TeamsDisplay from './components/TeamsDisplay'
import ActionButtons from './components/ActionButtons'
import Chat from './components/Chat'
import MembersModal from './components/modals/MembersModal'
import PendingModal from './components/modals/PendingModal'
import MatchFormModal from './components/modals/MatchFormModal'
import TeamSignupPanel from './components/TeamSignupPanel'
import {
    canApprovePendingMember,
    canDeleteMember,
    canDeleteVotingSlot,
    canDemoteAdmin,
    canInteractAsPlayer,
    canManageGames,
    canManageRoom as canManageRoomByRole,
    canPromoteToAdmin,
    canSendChatMessage,
    isApprovedMember,
    isPendingRole,
} from '@/permissions'

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
    const [isEditingMatch, setIsEditingMatch] = useState(false)
    const [manualName, setManualName] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)
    const [tempRoomName, setTempRoomName] = useState('')
    const [showMembersList, setShowMembersList] = useState(false)
    const [showPendingList, setShowPendingList] = useState(false)
    type MatchFormData = {
        matchType: 'match' | 'teams'
        address: string
        date: string
        start: string
        end: string
        max: number
        teamLimit: number
        gameFormat: number
        cost?: number | ''
        costPayer?: 'player' | 'team'
    }

    const [matchFormData, setMatchFormData] = useState<MatchFormData>({
        matchType: 'match',
        address: '',
        date: '',
        start: '',
        end: '',
        max: 10,
        teamLimit: 2,
        gameFormat: 5,
        cost: '',
        costPayer: 'player'
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

                const isTeamsMatch = latestMatch.match_type === 'teams'
                let fetchedTeams: Team[] = []

                if (isTeamsMatch || latestMatch.status === 'teams_distributed') {
                    const { data: teamsData } = await supabase
                        .from('match_teams')
                        .select('*, color_json')
                        .eq('match_id', latestMatch.id)
                        .order('display_order', { ascending: true })

                    if (teamsData) {
                        const teamsWithPlayers = await Promise.all(teamsData.map(async (team) => {
                            const { data: players } = await supabase
                                .from('match_slots')
                                .select('*')
                                .eq('team_id', team.id)
                                .eq('status', 'go')
                            return { ...team, players: players || [], color: team.color_json }
                        }))
                        fetchedTeams = teamsWithPlayers
                        setTeams(teamsWithPlayers)
                    }
                } else {
                    setTeams([])
                }

                setMatchFormData({
                    matchType: isTeamsMatch ? 'teams' : 'match',
                    address: latestMatch.address || '',
                    date: latestMatch.match_date || '',
                    start: latestMatch.start_time || '',
                    end: latestMatch.end_time || '',
                    max: latestMatch.max_players || 10,
                    teamLimit: latestMatch.team_limit || Math.max(2, fetchedTeams.length || 2),
                    gameFormat: latestMatch.game_format || 5,
                    cost: latestMatch.cost ?? '',
                    costPayer: latestMatch.cost_payer || 'player'
                })
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
    const canManageRoom = canManageRoomByRole(currentUserRole)
    const canVote = canInteractAsPlayer(currentUserRole)
    const isApproved = isApprovedMember(currentUserRole)

    // Фильтры
    const approvedMembers = members.filter(m => !isPendingRole(m.role))
    const pendingMembers = members.filter(m => isPendingRole(m.role))
    const goPlayers = slots.filter(s => s.status === 'go')
    const reservePlayers = slots.filter(s => s.status === 'reserve')
    const notGoPlayers = slots.filter(s => s.status === 'not_go')
    const registeredTeamsCount = teams.filter(team => slots.some(s => s.status === 'go' && s.team_id === team.id)).length

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
        if (!window.confirm('Удалить игрока из списка?')) return
        
        // Получаем информацию о слоте
        const slot = slots.find(s => s.id === slotId)
        if (!slot) {
            alert('Игрок не найден')
            return
        }
        
        // Проверяем права:
        // - Owner/Admin могут удалять любых
        // - Player может удалять только тех, кого он добавил
        const canDelete = canDeleteVotingSlot({
            actorRole: currentUserRole,
            actorUserId: userId,
            slotUserId: slot.user_id,
            slotAddedByUserId: slot.added_by_user_id,
        })
        
        if (!canDelete) {
            alert('Вы можете удалить только игроков, которых добавили сами')
            return
        }
        
        try {
            const { error } = await supabase.from('match_slots').delete().eq('id', slotId)
            
            if (error) {
                console.error('Ошибка удаления:', error)
                alert('Ошибка при удалении: ' + error.message)
                return
            }
            
            // Обновляем данные после успешного удаления
            await fetchData()
        } catch (err) {
            console.error('Неожиданная ошибка:', err)
            alert('Произошла ошибка при удалении')
        }
    }

    const addManualPlayer = async () => {
        if (!manualName.trim() || !match) return
        
        // Может добавлять любой участник кроме pending
        if (!canVote) {
            alert('У вас нет прав на добавление игроков')
            return
        }

        const myNick = members.find(m => m.user_id === userId)?.nickname || 'Участник'
        const nickname = `${manualName.trim()} /от ${myNick}/`

        const { data: currentGoSlots } = await supabase
            .from('match_slots')
            .select('*')
            .eq('match_id', match.id)
            .eq('status', 'go')

        const goCount = currentGoSlots?.length || 0
        const status = goCount >= match.max_players ? 'reserve' : 'go'

        await supabase.from('match_slots').insert({
            match_id: match.id,
            nickname: nickname,
            status,
            added_by_user_id: userId,
            added_by_nickname: myNick,
            created_at: new Date().toISOString()
        })
        setManualName('')
    }

    const handleApproveMember = async (memberId: string) => {
        if (!canApprovePendingMember(currentUserRole)) return
        await supabase
            .from('room_members')
            .update({ approved: true, role: 'player' })
            .eq('id', memberId)
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!canDeleteMember(currentUserRole, members.find(m => m.id === memberId)?.role || null, members.find(m => m.id === memberId)?.user_id === userId)) return
        if (!window.confirm('Удалить участника из комнаты?')) return
        await supabase
            .from('room_members')
            .delete()
            .eq('id', memberId)
    }

    const handleMakeAdmin = async (memberUserId: string) => {
        if (!canPromoteToAdmin(currentUserRole, members.find(m => m.user_id === memberUserId)?.role || null)) return
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
        if (!canDemoteAdmin(currentUserRole, members.find(m => m.user_id === memberUserId)?.role || null)) return
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
        setMatchFormData({
            matchType: 'match',
            address: '',
            date: '',
            start: '',
            end: '',
            max: 10,
            teamLimit: 2,
            gameFormat: 5,
            cost: '',
            costPayer: 'player'
        })
        setIsEditingMatch(false)
        setShowMatchForm(true)
    }

    const handleEditMatch = () => {
        if (!match) return
        const isTeamsMatch = match.match_type === 'teams'
        setMatchFormData({
            matchType: isTeamsMatch ? 'teams' : 'match',
            address: match.address || '',
            date: match.match_date || '',
            start: match.start_time || '',
            end: match.end_time || '',
            max: match.max_players || 10,
            teamLimit: match.team_limit || Math.max(2, teams.length || 2),
            gameFormat: match.game_format || 5,
            cost: match.cost ?? '',
            costPayer: match.cost_payer || 'player'
        })
        setIsEditingMatch(true)
        setShowMatchForm(true)
    }

    const handleCloseMatchForm = () => {
        setShowMatchForm(false)
        setIsEditingMatch(false)
    }

    const saveMatch = async () => {
        console.log('=== НАЧАЛО saveMatch ===')
        console.log('canManageRoom:', canManageRoom)
        console.log('match существует?', match)
        console.log('formData:', matchFormData)
        
        if (!canManageGames(currentUserRole)) {
            console.log('Нет прав для создания матча')
            return
        }

        const editingExistingMatch = isEditingMatch && !!match

        if (!editingExistingMatch && match) {
            alert('Матч уже существует. Сначала удалите текущий матч.')
            return
        }

        if (!matchFormData.address || !matchFormData.date || !matchFormData.start) {
            console.log('Не заполнены обязательные поля')
            alert('Заполните место, дату и время начала')
            return
        }

        if (matchFormData.matchType === 'teams') {
            if (matchFormData.teamLimit < 2) {
                alert('Лимит команд должен быть не меньше 2')
                return
            }
            if (matchFormData.gameFormat < 1) {
                alert('Формат игры должен быть больше 0')
                return
            }
        }

        const payload = {
            address: matchFormData.address,
            match_date: matchFormData.date,
            start_time: matchFormData.start,
            end_time: matchFormData.end || null,
            max_players: matchFormData.max || 10,
            team_limit: matchFormData.matchType === 'teams' ? matchFormData.teamLimit : null,
            game_format: matchFormData.matchType === 'teams' ? matchFormData.gameFormat : null,
            match_type: matchFormData.matchType,
            cost: matchFormData.cost === '' || matchFormData.cost === undefined ? null : matchFormData.cost,
            cost_payer: matchFormData.costPayer || null
        }
        
        console.log('Payload для отправки:', payload)

        try {
            let targetMatchId = match?.id || null
            const result = editingExistingMatch
                ? await supabase
                    .from('matches')
                    .update(payload)
                    .eq('id', match!.id)
                    .select('id')
                    .single()
                : await supabase
                    .from('matches')
                    .insert([{
                        ...payload,
                        room_id: roomId,
                        status: 'voting'
                    }])
                    .select('id')
                    .single()
            
            console.log('Ответ от Supabase:', result)
            
            if (result.error) {
                console.error('Ошибка Supabase:', result.error)
                alert('Ошибка при сохранении: ' + result.error.message)
            } else {
                targetMatchId = result.data?.id || targetMatchId

                if (targetMatchId && matchFormData.matchType === 'teams') {
                    if (editingExistingMatch) {
                        await supabase.from('match_slots').delete().eq('match_id', targetMatchId)
                    }

                    const { error: deleteTeamsError } = await supabase
                        .from('match_teams')
                        .delete()
                        .eq('match_id', targetMatchId)

                    if (deleteTeamsError) {
                        alert('Ошибка при обновлении команд: ' + deleteTeamsError.message)
                        return
                    }

                    const teamsPayload = Array.from({ length: matchFormData.teamLimit }).map((_, index) => ({
                        match_id: targetMatchId,
                        name: `Команда ${index + 1}`,
                        display_order: index + 1,
                        color_json: { text: 'text-black', bg: 'bg-white', label: 'Белый' }
                    }))

                    const { error: insertTeamsError } = await supabase.from('match_teams').insert(teamsPayload)
                    if (insertTeamsError) {
                        alert('Ошибка при создании команд: ' + insertTeamsError.message)
                        return
                    }
                } else if (targetMatchId) {
                    await supabase.from('match_teams').delete().eq('match_id', targetMatchId)
                    await supabase
                        .from('match_slots')
                        .update({ team_id: null })
                        .eq('match_id', targetMatchId)
                }

                console.log('Матч успешно сохранен')
                setShowMatchForm(false)
                setIsEditingMatch(false)
                
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
        if (!canManageGames(currentUserRole) || !match) return
        if (!window.confirm('Удалить игру полностью?')) return
        await supabase.from('matches').delete().eq('id', match.id)
        setMatch(null)
        setSlots([])
        setTeams([])
    }

    const updateRoomName = async () => {
        if (!canManageRoomByRole(currentUserRole) || !tempRoomName.trim()) return
        await supabase.from('rooms').update({ name: tempRoomName.trim() }).eq('id', roomId)
        setIsEditingName(false)
        await fetchData()
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !canSendChatMessage(currentUserRole)) return

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
                                    goCount={match.match_type === 'teams' ? registeredTeamsCount : goPlayers.length}
                                    maxPlayers={match.max_players}
                                    teamLimit={match.team_limit}
                                    matchType={match.match_type}
                                    cost={match.cost}
                                    costPayer={match.cost_payer}
                                    canManageRoom={canManageRoom}
                                    onDelete={deleteMatch}
                                    onEdit={handleEditMatch}
                                />
                                
                                {/* Кнопка "Сформировать составы" между карточкой и панелью голосования */}
                                {canManageRoom && match && match.match_type !== 'teams' && match.status !== 'teams_distributed' && (
                                    <button
                                        onClick={() => router.push(`/room/${roomId}/matches`)}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all my-4 w-full"
                                    >
                                        ⚽ Сформировать составы
                                    </button>
                                )}
                                
                                {/* Добавляем отступ перед панелью голосования */}
                                <div className="mt-2">
                                    {match.match_type === 'teams' ? (
                                        <TeamSignupPanel
                                            matchId={match.id}
                                            teams={teams}
                                            slots={slots}
                                            members={members}
                                            userId={userId}
                                            canVote={canVote}
                                            canManageRoom={canManageRoom}
                                            gameFormat={match.game_format || 5}
                                            onRefresh={fetchData}
                                        />
                                    ) : match.status === 'teams_distributed' ? (
                                        <TeamsDisplay teams={teams} />
                                    ) : (
                                        <VotingPanel
                                            matchId={match.id}
                                            userId={userId}
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
                                            showManualInput={canVote}
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
                onClose={handleCloseMatchForm}
                formData={matchFormData}
                setFormData={setMatchFormData}
                onSave={saveMatch}
            />
        </div>
    )
}
