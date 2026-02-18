'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Member, Slot, Team } from './types'
import { TEAM_TITLE_COLORS, TeamTitleColor } from './teamColors'

interface Props {
    matchId: string
    teams: Team[]
    slots: Slot[]
    members: Member[]
    userId: string | null
    canVote: boolean
    canManageRoom: boolean
    gameFormat: number
    onRefresh: () => Promise<void>
}

const DEFAULT_TEAM_COLOR: TeamTitleColor = { text: 'text-black', bg: 'bg-white', label: 'Белый' }
const ALREADY_IN_TEAM_TEXT = 'Вы уже состоите в команде, чтобы записать новую, выйдете из текущей команды'
const EXIT_TEAM_FIRST_TEXT = 'Сначала выйдете из текущей команды'

export default function TeamSignupPanel({
    matchId,
    teams,
    slots,
    members,
    userId,
    canVote,
    canManageRoom,
    gameFormat,
    onRefresh
}: Props) {
    const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
    const [isCreatingTeam, setIsCreatingTeam] = useState(false)
    const [draftUserIds, setDraftUserIds] = useState<string[]>([])
    const [draftManualNames, setDraftManualNames] = useState<string[]>([])
    const [manualName, setManualName] = useState('')
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
    const [tempTeamName, setTempTeamName] = useState('')
    const [tempTeamColor, setTempTeamColor] = useState<TeamTitleColor>(DEFAULT_TEAM_COLOR)

    const sortedTeams = useMemo(
        () => [...teams].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
        [teams]
    )

    const currentMember = members.find(m => m.user_id === userId)
    const teamEligibleMembers = members.filter(m => m.role === 'owner' || m.role === 'admin' || m.role === 'player')
    const slotsInTeams = slots.filter(s => s.status === 'go' && !!s.team_id)
    const unassignedSlots = slots.filter(s => s.user_id && !s.team_id && s.status === 'reserve')
    const activeTeam = sortedTeams.find(t => t.id === activeTeamId) || null

    const getTeamSlots = (teamId: string) =>
        slotsInTeams
            .filter(s => s.team_id === teamId)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const getUserTeamId = (targetUserId: string | null) => {
        if (!targetUserId) return null
        return slotsInTeams.find(s => s.user_id === targetUserId)?.team_id || null
    }

    const getAvailablePlayersForTeam = (teamId: string | null, extraExcludedUserIds: string[] = []) => {
        const currentTeamUserIds = new Set((teamId ? getTeamSlots(teamId) : []).map(s => s.user_id).filter(Boolean))
        const excluded = new Set(extraExcludedUserIds)

        return teamEligibleMembers.filter((member) => {
            if (excluded.has(member.user_id)) return false
            if (currentTeamUserIds.has(member.user_id)) return false
            const assignedTeamId = getUserTeamId(member.user_id)
            return !assignedTeamId
        })
    }

    const canEditTeam = (team: Team) => {
        if (canManageRoom) return true
        if (!userId) return false
        return getTeamSlots(team.id).some(s => s.user_id === userId)
    }

    const canRemoveSlot = (slot: Slot) => {
        if (canManageRoom) return true
        if (!userId) return false
        const isSelf = slot.user_id === userId
        const isManualAddedByMe = !slot.user_id && slot.added_by_user_id === userId
        return isSelf || isManualAddedByMe
    }

    const resetDraft = () => {
        setDraftUserIds([])
        setDraftManualNames([])
        setManualName('')
        setIsCreatingTeam(false)
    }

    const closeTeamModal = () => {
        setIsTeamModalOpen(false)
        setActiveTeamId(null)
        resetDraft()
    }

    const startTeamRegistration = () => {
        if (!canVote) return

        const myTeamId = getUserTeamId(userId)
        if (myTeamId) {
            alert(ALREADY_IN_TEAM_TEXT)
            return
        }

        const freeTeam = sortedTeams.find(team => getTeamSlots(team.id).length === 0)
        if (!freeTeam) {
            alert('Достигнут лимит команд')
            return
        }

        setActiveTeamId(freeTeam.id)
        setIsCreatingTeam(true)
        setDraftUserIds([])
        setDraftManualNames([])
        setManualName('')
        setIsTeamModalOpen(true)
    }

    const openTeamModal = (teamId: string) => {
        setActiveTeamId(teamId)
        setIsCreatingTeam(false)
        setDraftUserIds([])
        setDraftManualNames([])
        setManualName('')
        setIsTeamModalOpen(true)
    }

    const addPlayerToTeam = async (targetUserId: string) => {
        if (!activeTeam || !canVote || !userId) return

        const assignedTeamId = getUserTeamId(targetUserId)
        if (assignedTeamId && assignedTeamId !== activeTeam.id) {
            alert(ALREADY_IN_TEAM_TEXT)
            return
        }

        const member = members.find(m => m.user_id === targetUserId)
        if (!member || member.role === 'pending') {
            alert('Можно добавить только подтвержденных участников')
            return
        }

        if (isCreatingTeam) {
            if (draftUserIds.includes(targetUserId)) return
            setDraftUserIds(prev => [...prev, targetUserId])
            return
        }

        if (!canEditTeam(activeTeam) && !canManageRoom) return

        const actorNick = currentMember?.nickname || 'Участник'
        const existingUnassigned = unassignedSlots.find(s => s.user_id === targetUserId)

        if (existingUnassigned) {
            await supabase
                .from('match_slots')
                .update({
                    team_id: activeTeam.id,
                    status: 'go',
                    added_by_user_id: userId,
                    added_by_nickname: actorNick
                })
                .eq('id', existingUnassigned.id)
        } else if (!assignedTeamId) {
            await supabase.from('match_slots').insert({
                match_id: matchId,
                user_id: targetUserId,
                nickname: member.nickname,
                status: 'go',
                team_id: activeTeam.id,
                added_by_user_id: userId,
                added_by_nickname: actorNick,
                created_at: new Date().toISOString()
            })
        }

        await onRefresh()
    }

    const addManualToTeam = async () => {
        if (!activeTeam || !manualName.trim() || !canVote || !userId) return

        if (isCreatingTeam) {
            setDraftManualNames(prev => [...prev, manualName.trim()])
            setManualName('')
            return
        }

        if (!canEditTeam(activeTeam) && !canManageRoom) return

        const actorNick = currentMember?.nickname || 'Участник'
        const finalNickname = `${manualName.trim()} /от ${actorNick}/`

        await supabase.from('match_slots').insert({
            match_id: matchId,
            nickname: finalNickname,
            status: 'go',
            team_id: activeTeam.id,
            added_by_user_id: userId,
            added_by_nickname: actorNick,
            created_at: new Date().toISOString()
        })

        setManualName('')
        await onRefresh()
    }

    const removeTeamSlot = async (slot: Slot) => {
        if (!slot.team_id) return
        if (!canRemoveSlot(slot)) {
            alert('Недостаточно прав для удаления')
            return
        }

        await supabase.from('match_slots').delete().eq('id', slot.id)

        await onRefresh()
    }

    const submitCreateTeam = async () => {
        if (!activeTeam || !userId) return
        const actorNick = currentMember?.nickname || 'Участник'

        for (const targetUserId of draftUserIds) {
            const assignedTeamId = getUserTeamId(targetUserId)
            if (assignedTeamId && assignedTeamId !== activeTeam.id) {
                alert(ALREADY_IN_TEAM_TEXT)
                return
            }

            const member = members.find(m => m.user_id === targetUserId)
            if (!member || member.role === 'pending') continue

            const existingUnassigned = unassignedSlots.find(s => s.user_id === targetUserId)
            if (existingUnassigned) {
                await supabase
                    .from('match_slots')
                    .update({
                        team_id: activeTeam.id,
                        status: 'go',
                        added_by_user_id: userId,
                        added_by_nickname: actorNick
                    })
                    .eq('id', existingUnassigned.id)
            } else {
                await supabase.from('match_slots').insert({
                    match_id: matchId,
                    user_id: targetUserId,
                    nickname: member.nickname,
                    status: 'go',
                    team_id: activeTeam.id,
                    added_by_user_id: userId,
                    added_by_nickname: actorNick,
                    created_at: new Date().toISOString()
                })
            }
        }

        for (const rawName of draftManualNames) {
            const finalNickname = `${rawName} /от ${actorNick}/`
            await supabase.from('match_slots').insert({
                match_id: matchId,
                nickname: finalNickname,
                status: 'go',
                team_id: activeTeam.id,
                added_by_user_id: userId,
                added_by_nickname: actorNick,
                created_at: new Date().toISOString()
            })
        }

        await onRefresh()
        closeTeamModal()
    }

    const deleteTeamCompletely = async (team: Team) => {
        if (!canManageRoom) return
        if (!window.confirm('Удалить команду полностью?')) return

        await supabase.from('match_slots').delete().eq('match_id', matchId).eq('team_id', team.id)
        await supabase
            .from('match_teams')
            .update({
                name: `Команда ${team.display_order || 1}`,
                color_json: DEFAULT_TEAM_COLOR
            })
            .eq('id', team.id)
        await onRefresh()
    }

    const joinWithoutTeam = async () => {
        if (!userId || !canVote) return
        if (getUserTeamId(userId)) {
            alert(EXIT_TEAM_FIRST_TEXT)
            return
        }

        const alreadyWaiting = unassignedSlots.some(s => s.user_id === userId)
        if (alreadyWaiting) return

        await supabase.from('match_slots').insert({
            match_id: matchId,
            user_id: userId,
            nickname: currentMember?.nickname || 'Участник',
            status: 'reserve',
            team_id: null,
            created_at: new Date().toISOString()
        })

        await onRefresh()
    }

    const removeWithoutTeam = async (slot: Slot) => {
        if (!slot.user_id) return
        if (!canManageRoom && slot.user_id !== userId) return
        await supabase.from('match_slots').delete().eq('id', slot.id)
        await onRefresh()
    }

    const startEditingTeam = (team: Team) => {
        if (!canManageRoom) return
        setEditingTeamId(team.id)
        setTempTeamName(team.name)
        setTempTeamColor((team.color_json as TeamTitleColor) || DEFAULT_TEAM_COLOR)
    }

    const saveTeamMeta = async () => {
        if (!editingTeamId || !canManageRoom) return
        await supabase
            .from('match_teams')
            .update({
                name: tempTeamName.trim() || 'Команда',
                color_json: tempTeamColor
            })
            .eq('id', editingTeamId)
        setEditingTeamId(null)
        await onRefresh()
    }

    const activeTeams = sortedTeams.filter(team => getTeamSlots(team.id).length > 0)
    const myUnassigned = unassignedSlots.some(s => s.user_id === userId)

    const draftMembers = draftUserIds
        .map(id => members.find(m => m.user_id === id))
        .filter((m): m is Member => !!m)

    if (sortedTeams.length === 0) {
        return <p className="text-center text-gray-400 py-8">Команды еще не созданы</p>
    }

    return (
        <>
            <div className="grid grid-cols-[1.5fr_1fr] gap-4">
                <div className="space-y-3">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-center">
                        <button
                            onClick={startTeamRegistration}
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                        >
                            Записать команду
                        </button>
                    </div>

                    {activeTeams.map((team) => {
                        const teamPlayers = getTeamSlots(team.id)
                        const mainCount = Math.min(gameFormat, teamPlayers.length)
                        const reserveCount = Math.max(0, teamPlayers.length - gameFormat)
                        const teamColor = (team.color_json as TeamTitleColor) || DEFAULT_TEAM_COLOR

                        return (
                            <div key={team.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    {editingTeamId === team.id ? (
                                        <div className="flex-1">
                                            <input
                                                value={tempTeamName}
                                                onChange={e => setTempTeamName(e.target.value)}
                                                className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-black uppercase outline-none"
                                            />
                                            <div className="flex gap-1 mt-2 flex-wrap">
                                                {TEAM_TITLE_COLORS.map(color => (
                                                    <button
                                                        key={`${color.bg}-${color.text}`}
                                                        onClick={() => setTempTeamColor(color)}
                                                        className={`w-6 h-6 rounded-full ${color.bg} border ${
                                                            tempTeamColor.bg === color.bg && tempTeamColor.text === color.text ? 'border-black' : 'border-transparent'
                                                        }`}
                                                        title={color.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => startEditingTeam(team)}
                                            className={`text-left text-sm font-black uppercase px-2 py-1 rounded-lg ${teamColor.bg} ${teamColor.text}`}
                                        >
                                            {team.name}
                                        </button>
                                    )}

                                    <div className="flex gap-2 items-center">
                                        {editingTeamId === team.id ? (
                                            <button
                                                onClick={saveTeamMeta}
                                                className="bg-black text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase"
                                            >
                                                Ок
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openTeamModal(team.id)}
                                                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase"
                                            >
                                                Редактировать состав
                                            </button>
                                        )}

                                        {canManageRoom && (
                                            <button
                                                onClick={() => deleteTeamCompletely(team)}
                                                className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-[9px] font-black uppercase"
                                            >
                                                Удалить
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-500 mb-2">
                                    Участников: {mainCount} + {reserveCount} на замену
                                </p>

                                <div className="space-y-1">
                                    {teamPlayers.map((slot) => (
                                        <div key={slot.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
                                            <span className="text-[11px] font-bold truncate pr-2">{slot.nickname}</span>
                                            {canRemoveSlot(slot) && (
                                                <button onClick={() => removeTeamSlot(slot)} className="text-red-500 font-black">
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 h-fit flex flex-col">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-3">Игроки без команды</p>
                    <div className="space-y-1">
                        {unassignedSlots.map((slot) => (
                            <div key={slot.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
                                <span className="text-[11px] font-bold truncate pr-2">{slot.nickname}</span>
                                {(canManageRoom || slot.user_id === userId) && (
                                    <button onClick={() => removeWithoutTeam(slot)} className="text-red-500 font-black">
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        {unassignedSlots.length === 0 && (
                            <p className="text-[10px] text-gray-400 italic">Пока пусто</p>
                        )}
                    </div>
                    <button
                        onClick={joinWithoutTeam}
                        disabled={!canVote || myUnassigned || !!getUserTeamId(userId)}
                        className="mt-3 bg-black text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase disabled:opacity-40"
                    >
                        Нет команды
                    </button>
                </div>
            </div>

            {isTeamModalOpen && activeTeam && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-6 max-h-[88vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black uppercase">{activeTeam.name}</h3>
                            <div className="flex gap-2">
                                {isCreatingTeam && (
                                    <button
                                        onClick={closeTeamModal}
                                        className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                                    >
                                        Отменить
                                    </button>
                                )}
                                <button
                                    onClick={isCreatingTeam ? submitCreateTeam : closeTeamModal}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                                >
                                    {isCreatingTeam ? 'Создать команду' : 'Ок'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Участники группы</p>
                                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                                    {getAvailablePlayersForTeam(activeTeam.id, isCreatingTeam ? draftUserIds : []).map((member) => (
                                        <button
                                            key={member.user_id}
                                            onClick={() => addPlayerToTeam(member.user_id)}
                                            disabled={!isCreatingTeam && !canEditTeam(activeTeam) && !canManageRoom}
                                            className="w-full text-left bg-gray-50 hover:bg-blue-50 px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-40"
                                        >
                                            {member.nickname}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Состав команды</p>
                                <div className="space-y-1 max-h-[240px] overflow-y-auto mb-3">
                                    {isCreatingTeam ? (
                                        <>
                                            {draftMembers.map((member) => (
                                                <div key={member.user_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
                                                    <span className="text-[11px] font-bold truncate pr-2">{member.nickname}</span>
                                                    <button
                                                        onClick={() => setDraftUserIds(prev => prev.filter(id => id !== member.user_id))}
                                                        className="text-red-500 font-black"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {draftManualNames.map((name, index) => (
                                                <div key={`${name}-${index}`} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
                                                    <span className="text-[11px] font-bold truncate pr-2">{name}</span>
                                                    <button
                                                        onClick={() => setDraftManualNames(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-red-500 font-black"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        getTeamSlots(activeTeam.id).map((slot) => (
                                            <div key={slot.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
                                                <span className="text-[11px] font-bold truncate pr-2">{slot.nickname}</span>
                                                {canRemoveSlot(slot) && (
                                                    <button onClick={() => removeTeamSlot(slot)} className="text-red-500 font-black">
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <input
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder="Вписать вручную..."
                                    className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold outline-none mb-2"
                                />
                                <button
                                    onClick={addManualToTeam}
                                    disabled={!manualName.trim() || (!isCreatingTeam && !canEditTeam(activeTeam) && !canManageRoom)}
                                    className="w-full bg-black text-white py-3 rounded-xl text-[10px] font-black uppercase disabled:opacity-40"
                                >
                                    Добавить вручную
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
