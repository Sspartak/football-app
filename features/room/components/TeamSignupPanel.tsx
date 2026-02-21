'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Member, Slot, Team } from '../types'
import { TEAM_TITLE_COLORS, TeamTitleColor } from '@/lib/constants/teamColors'
import { isPendingRole } from '@/permissions'

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
    const [isSubmittingTeam, setIsSubmittingTeam] = useState(false)
    const [draftUserIds, setDraftUserIds] = useState<string[]>([])
    const [draftManualNames, setDraftManualNames] = useState<string[]>([])
    const [manualName, setManualName] = useState('')
    const [tempTeamName, setTempTeamName] = useState('')
    const [tempTeamColor, setTempTeamColor] = useState<TeamTitleColor>(DEFAULT_TEAM_COLOR)
    const [creatorRemovalCandidate, setCreatorRemovalCandidate] = useState<{ team: Team; slot: Slot } | null>(null)

    const sortedTeams = useMemo(
        () => [...teams].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
        [teams]
    )

    const currentMember = members.find(m => m.user_id === userId)
    const currentMemberRole = currentMember?.role
    const slotsInTeams = slots.filter(s => s.status === 'go' && !!s.team_id)
    const unassignedSlots = slots.filter(
        s => s.user_id && !s.team_id && (s.status === 'reserve' || s.status === 'go')
    )
    const activeTeam = sortedTeams.find(t => t.id === activeTeamId) || null

    const getTeamSlots = (teamId: string) =>
        slotsInTeams
            .filter(s => s.team_id === teamId)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const getUserTeamId = (targetUserId: string | null) => {
        if (!targetUserId) return null
        return slotsInTeams.find(s => s.user_id === targetUserId)?.team_id || null
    }

    const getTeamCreatorId = (team: Team) => {
        if (team.created_by_user_id) return team.created_by_user_id
        const firstTeamSlot = getTeamSlots(team.id).find(slot => !!slot.added_by_user_id)
        return firstTeamSlot?.added_by_user_id || null
    }

    const canEditTeam = (team: Team) => {
        if (canManageRoom) return true
        if (!userId) return false
        const creatorId = getTeamCreatorId(team)
        if (creatorId) return creatorId === userId
        if (currentMemberRole !== 'player') return false
        return getTeamSlots(team.id).some(slot => slot.user_id === userId)
    }

    const canDeleteTeam = (team: Team) => {
        if (canManageRoom) return true
        if (!userId) return false
        return getTeamCreatorId(team) === userId
    }

    const canRemoveSlot = (slot: Slot) => {
        if (!slot.team_id || !userId) return false
        if (canManageRoom) return true

        const team = sortedTeams.find(t => t.id === slot.team_id)
        const isCreator = !!team && getTeamCreatorId(team) === userId

        if (slot.user_id === userId && isCreator) {
            return false
        }

        if (slot.user_id === userId) {
            return true
        }

        return isCreator
    }

    const resetDraft = () => {
        setDraftUserIds([])
        setDraftManualNames([])
        setManualName('')
        setIsCreatingTeam(false)
        setIsSubmittingTeam(false)
    }

    const closeTeamModal = () => {
        setIsTeamModalOpen(false)
        setActiveTeamId(null)
        resetDraft()
    }

    const getAvailablePlayersForTeam = (teamId: string | null, extraExcludedUserIds: string[] = []) => {
        const currentTeamUserIds = new Set((teamId ? getTeamSlots(teamId) : []).map(s => s.user_id).filter(Boolean))
        const excluded = new Set(extraExcludedUserIds)

        return members.filter((member) => {
            if (isPendingRole(member.role)) return false
            if (!canManageRoom && member.role !== 'player') return false
            if (excluded.has(member.user_id)) return false
            if (currentTeamUserIds.has(member.user_id)) return false
            const assignedTeamId = getUserTeamId(member.user_id)
            return !assignedTeamId
        })
    }

    const startTeamRegistration = () => {
        if (!canVote || !userId) return

        const myTeamId = getUserTeamId(userId)
        if (myTeamId && !canManageRoom) {
            alert(ALREADY_IN_TEAM_TEXT)
            return
        }

        const freeTeam = sortedTeams.find(team => getTeamSlots(team.id).length === 0)
        if (!freeTeam) {
            alert('Все места на игру заняты')
            return
        }

        const initialDraft: string[] = []
        if (currentMemberRole === 'player' && !myTeamId) {
            initialDraft.push(userId)
        }

        const initialColor = (freeTeam.color_json as TeamTitleColor | null) || DEFAULT_TEAM_COLOR

        setActiveTeamId(freeTeam.id)
        setIsCreatingTeam(true)
        setDraftUserIds(initialDraft)
        setDraftManualNames([])
        setManualName('')
        setTempTeamName(freeTeam.name)
        setTempTeamColor(initialColor)
        setIsTeamModalOpen(true)
    }

    const openTeamModal = (teamId: string) => {
        const team = sortedTeams.find(item => item.id === teamId)
        if (!team) return

        setActiveTeamId(teamId)
        setIsCreatingTeam(false)
        setDraftUserIds([])
        setDraftManualNames([])
        setManualName('')
        setTempTeamName(team.name)
        setTempTeamColor((team.color_json as TeamTitleColor | null) || DEFAULT_TEAM_COLOR)
        setIsTeamModalOpen(true)
    }

    const assignUserToTeam = async (teamId: string, targetUserId: string) => {
        if (!userId) return false

        const assignedTeamId = getUserTeamId(targetUserId)
        if (assignedTeamId && assignedTeamId !== teamId) {
            alert(ALREADY_IN_TEAM_TEXT)
            return false
        }

        const member = members.find(m => m.user_id === targetUserId)
        if (!member || isPendingRole(member.role)) {
            alert('Можно добавить только подтвержденных участников')
            return false
        }

        const actorNick = currentMember?.nickname || 'Участник'
        const existingUnassigned = unassignedSlots.find(s => s.user_id === targetUserId)

        if (existingUnassigned) {
            const { error: updateError } = await supabase
                .from('match_slots')
                .update({
                    team_id: teamId,
                    status: 'go',
                    added_by_user_id: userId,
                    added_by_nickname: actorNick
                })
                .eq('id', existingUnassigned.id)
            if (updateError) {
                alert('Ошибка переноса игрока в команду: ' + updateError.message)
                return false
            }
        } else if (!assignedTeamId) {
            const { error: insertError } = await supabase.from('match_slots').insert({
                match_id: matchId,
                user_id: targetUserId,
                nickname: member.nickname,
                status: 'go',
                team_id: teamId,
                added_by_user_id: userId,
                added_by_nickname: actorNick,
                created_at: new Date().toISOString()
            })
            if (insertError) {
                alert('Ошибка добавления игрока в команду: ' + insertError.message)
                return false
            }
        }

        return true
    }

    const addPlayerToTeam = async (targetUserId: string) => {
        if (!activeTeam || !canVote || !userId) return

        if (isCreatingTeam) {
            if (draftUserIds.includes(targetUserId)) return
            setDraftUserIds(prev => [...prev, targetUserId])
            return
        }

        if (!canEditTeam(activeTeam)) return

        const success = await assignUserToTeam(activeTeam.id, targetUserId)
        if (!success) return
        await onRefresh()
    }

    const addManualToTeam = async () => {
        if (!activeTeam || !manualName.trim() || !canVote || !userId) return

        if (!isCreatingTeam && !canEditTeam(activeTeam)) return

        if (isCreatingTeam) {
            setDraftManualNames(prev => [...prev, manualName.trim()])
            setManualName('')
            return
        }

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

        const team = sortedTeams.find(item => item.id === slot.team_id)
        const isCreatorBeingRemoved =
            !!team &&
            canManageRoom &&
            !!slot.user_id &&
            getTeamCreatorId(team) === slot.user_id

        if (isCreatorBeingRemoved && team) {
            setCreatorRemovalCandidate({ team, slot })
            return
        }

        const { error } = await supabase
            .from('match_slots')
            .delete()
            .eq('id', slot.id)
        if (error) {
            alert('Ошибка удаления игрока из команды: ' + error.message)
            return
        }
        await onRefresh()
    }

    const claimTeamAtomically = async (team: Team, actorUserId: string) => {
        const payload: {
            created_by_user_id: string
            name: string
            color_json?: TeamTitleColor
        } = {
            created_by_user_id: actorUserId,
            name: tempTeamName.trim() || team.name
        }

        if (canManageRoom) {
            payload.color_json = tempTeamColor
        }

        const { data, error } = await supabase
            .from('match_teams')
            .update(payload)
            .eq('id', team.id)
            .is('created_by_user_id', null)
            .select('id')

        return { data, error }
    }

    const submitCreateTeam = async () => {
        if (!activeTeam || !userId || isSubmittingTeam) return

        if (draftUserIds.length === 0 && draftManualNames.length === 0) {
            alert('Добавьте хотя бы одного участника или игрока вручную')
            return
        }

        setIsSubmittingTeam(true)
        try {
            let claimTarget = activeTeam
            let claimResult = await claimTeamAtomically(claimTarget, userId)

            if (claimResult.error) {
                const lowered = claimResult.error.message.toLowerCase()
                if (lowered.includes('created_by_user_id')) {
                    alert('Нужно применить SQL-миграцию для безопасной записи команд (created_by_user_id).')
                } else {
                    alert('Ошибка при записи команды: ' + claimResult.error.message)
                }
                return
            }

            if (!claimResult.data || claimResult.data.length === 0) {
                const { data: nextFreeTeams, error: nextTeamError } = await supabase
                    .from('match_teams')
                    .select('id, name, color_json, display_order')
                    .eq('match_id', matchId)
                    .is('created_by_user_id', null)
                    .order('display_order', { ascending: true })
                    .limit(1)

                if (nextTeamError) {
                    alert('Ошибка при записи команды: ' + nextTeamError.message)
                    return
                }

                if (!nextFreeTeams || nextFreeTeams.length === 0) {
                    alert('Все места на игру заняты')
                    await onRefresh()
                    closeTeamModal()
                    return
                }

                const nextTeam = nextFreeTeams[0] as unknown as Team
                claimTarget = nextTeam
                claimResult = await claimTeamAtomically(claimTarget, userId)

                if (claimResult.error || !claimResult.data || claimResult.data.length === 0) {
                    alert('Все места на игру заняты')
                    await onRefresh()
                    closeTeamModal()
                    return
                }
            }

            for (const targetUserId of draftUserIds) {
                const success = await assignUserToTeam(claimTarget.id, targetUserId)
                if (!success) return
            }

            const actorNick = currentMember?.nickname || 'Участник'
            for (const rawName of draftManualNames) {
                const finalNickname = `${rawName} /от ${actorNick}/`
                await supabase.from('match_slots').insert({
                    match_id: matchId,
                    nickname: finalNickname,
                    status: 'go',
                    team_id: claimTarget.id,
                    added_by_user_id: userId,
                    added_by_nickname: actorNick,
                    created_at: new Date().toISOString()
                })
            }

            await onRefresh()
            closeTeamModal()
        } finally {
            setIsSubmittingTeam(false)
        }
    }

    const resetTeamToEmpty = async (team: Team) => {
        const { error: clearSlotsError } = await supabase
            .from('match_slots')
            .delete()
            .eq('match_id', matchId)
            .eq('team_id', team.id)
        if (clearSlotsError) {
            alert('Ошибка очистки состава команды: ' + clearSlotsError.message)
            return
        }
        await supabase
            .from('match_teams')
            .update({
                name: `Команда ${team.display_order || 1}`,
                color_json: DEFAULT_TEAM_COLOR
            })
            .eq('id', team.id)
        await supabase
            .from('match_teams')
            .update({ created_by_user_id: null })
            .eq('id', team.id)
    }

    const deleteTeamCompletely = async (team: Team) => {
        if (!canDeleteTeam(team)) return
        if (!window.confirm('Команда удалится полностью')) return

        await resetTeamToEmpty(team)
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

        const { data: updatedRows, error: updateError } = await supabase
            .from('match_slots')
            .update({
                status: 'reserve',
                team_id: null
            })
            .eq('match_id', matchId)
            .eq('user_id', userId)
            .select('id')

        if (updateError) {
            alert('Ошибка записи в список без команды: ' + updateError.message)
            return
        }

        if (!updatedRows || updatedRows.length === 0) {
            const { error: insertError } = await supabase.from('match_slots').insert({
                match_id: matchId,
                user_id: userId,
                nickname: currentMember?.nickname || 'Участник',
                status: 'reserve',
                team_id: null,
                created_at: new Date().toISOString()
            })

            if (insertError) {
                alert('Ошибка записи в список без команды: ' + insertError.message)
                return
            }
        }

        await onRefresh()
    }

    const removeWithoutTeam = async (slot: Slot) => {
        if (!slot.user_id) return
        if (!canManageRoom && slot.user_id !== userId) return
        await supabase.from('match_slots').delete().eq('id', slot.id)
        await onRefresh()
    }

    const inviteFromWithoutTeam = async (slot: Slot) => {
        if (!slot.user_id || !userId) return

        const editableTeams = sortedTeams.filter(team => canEditTeam(team) && getTeamSlots(team.id).length > 0)
        if (editableTeams.length === 0) return

        let targetTeam: Team | undefined
        if (!canManageRoom) {
            targetTeam = editableTeams[0]
        } else if (editableTeams.length === 1) {
            targetTeam = editableTeams[0]
        } else {
            const variants = editableTeams.map((team, index) => `${index + 1} — ${team.name}`).join('\n')
            const raw = window.prompt(`Выберите команду для приглашения:\n${variants}`)
            if (!raw) return
            const idx = parseInt(raw, 10)
            if (!Number.isInteger(idx) || idx < 1 || idx > editableTeams.length) {
                alert('Некорректный номер команды')
                return
            }
            targetTeam = editableTeams[idx - 1]
        }

        if (!targetTeam) return

        if (!window.confirm('Пригласить этого игрока в команду?')) return

        const success = await assignUserToTeam(targetTeam.id, slot.user_id)
        if (!success) return
        await onRefresh()
    }

    const saveTeamMeta = async (teamId: string) => {
        const team = sortedTeams.find(item => item.id === teamId)
        if (!team || !canEditTeam(team)) return

        const payload: {
            name: string
            color_json?: TeamTitleColor
        } = {
            name: tempTeamName.trim() || 'Команда'
        }

        if (canManageRoom) {
            payload.color_json = tempTeamColor
        }

        await supabase
            .from('match_teams')
            .update(payload)
            .eq('id', teamId)
        await onRefresh()
    }

    const saveActiveTeamMetaFromModal = async () => {
        if (!activeTeam || !canEditTeam(activeTeam)) return
        await saveTeamMeta(activeTeam.id)
        closeTeamModal()
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
            <div className="grid grid-cols-[2.45fr_1.2fr] gap-4">
                <div className="space-y-2 min-w-0">
                    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-center">
                        <button
                            onClick={startTeamRegistration}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase"
                        >
                            Записать команду
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {activeTeams.map((team) => {
                            const teamPlayers = getTeamSlots(team.id)
                            const mainCount = Math.min(gameFormat, teamPlayers.length)
                            const reserveCount = Math.max(0, teamPlayers.length - gameFormat)
                            const teamColor = (team.color_json as TeamTitleColor) || DEFAULT_TEAM_COLOR

                            return (
                                <div key={team.id} className="rounded-xl border border-gray-200 bg-white p-3">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className={`text-left text-[10px] font-black uppercase px-2 py-1 rounded-md min-w-0 truncate whitespace-nowrap ${teamColor.bg} ${teamColor.text}`}>
                                            {team.name}
                                        </h3>

                                        <div className="flex gap-1 items-center shrink-0">
                                            {canEditTeam(team) ? (
                                                <button
                                                    onClick={() => openTeamModal(team.id)}
                                                    className="bg-gray-100 text-gray-900 border border-gray-300 w-6 h-6 rounded-md text-[13px] leading-none flex items-center justify-center"
                                                    title="Состав команды"
                                                >
                                                    ⛭
                                                </button>
                                            ) : null}
                                            {canDeleteTeam(team) && (
                                                <button
                                                    onClick={() => deleteTeamCompletely(team)}
                                                    className="bg-gray-100 text-red-500 border border-gray-300 w-6 h-6 rounded-md text-sm leading-none flex items-center justify-center"
                                                    title="Удалить команду"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-gray-500 mb-1">
                                        {mainCount} + {reserveCount} на замену
                                    </p>

                                    <div className="space-y-1">
                                        {teamPlayers.map((slot) => (
                                            <div key={slot.id} className="flex items-center justify-between bg-gray-50 rounded-md px-2 py-1">
                                                <span className="text-[10px] font-bold truncate pr-2">{slot.nickname}</span>
                                                {canRemoveSlot(slot) && (
                                                    <button onClick={() => removeTeamSlot(slot)} className="text-red-500 font-black leading-none">
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
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col min-w-0 w-full max-w-[390px] justify-self-end">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-3">Игроки без команды</p>
                    <div className="space-y-1">
                        {unassignedSlots.map((slot) => (
                            <div key={slot.id} className="flex items-center justify-between gap-1 bg-gray-50 rounded-lg px-2 py-1">
                                <span className="text-[11px] font-bold truncate pr-2">{slot.nickname}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    {sortedTeams.some(team => canEditTeam(team) && getTeamSlots(team.id).length > 0) && (
                                        <button
                                            onClick={() => inviteFromWithoutTeam(slot)}
                                            className="bg-blue-600 text-white rounded-md w-5 h-5 text-[11px] font-black leading-none"
                                            title="Пригласить в команду"
                                        >
                                            +
                                        </button>
                                    )}
                                    {(canManageRoom || slot.user_id === userId) && (
                                        <button onClick={() => removeWithoutTeam(slot)} className="text-red-500 font-black">
                                            ×
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                    </div>
                    <button
                        onClick={joinWithoutTeam}
                        disabled={!canVote || myUnassigned || !!getUserTeamId(userId)}
                        className="mt-auto pt-3 bg-black text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase disabled:opacity-40"
                    >
                        Нет команды
                    </button>
                </div>
            </div>

            {isTeamModalOpen && activeTeam && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-6 max-h-[88vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4 gap-3">
                            <div className="flex-1 min-w-0">
                                {(isCreatingTeam || canEditTeam(activeTeam)) ? (
                                    <input
                                        value={tempTeamName}
                                        onChange={e => setTempTeamName(e.target.value)}
                                        className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-black uppercase outline-none whitespace-nowrap overflow-hidden text-ellipsis"
                                    />
                                ) : (
                                    <h3 className="text-sm font-black uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                                        {activeTeam.name}
                                    </h3>
                                )}
                                {canManageRoom && (
                                    <div className="flex gap-1 mt-2 flex-wrap">
                                        {TEAM_TITLE_COLORS.map(color => (
                                            <button
                                                key={`${color.bg}-${color.text}`}
                                                onClick={() => setTempTeamColor(color)}
                                                className={`w-5 h-5 rounded-full ${color.bg} border ${
                                                    color.bg === 'bg-white'
                                                        ? tempTeamColor.bg === color.bg && tempTeamColor.text === color.text ? 'border-black' : 'border-gray-400'
                                                        : tempTeamColor.bg === color.bg && tempTeamColor.text === color.text ? 'border-black' : 'border-transparent'
                                                }`}
                                                title={color.label}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {isCreatingTeam && (
                                    <button
                                        onClick={closeTeamModal}
                                        className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                                    >
                                        Отменить
                                    </button>
                                )}
                                {!isCreatingTeam && canEditTeam(activeTeam) && (
                                    <button
                                        onClick={saveActiveTeamMetaFromModal}
                                        className="bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                                    >
                                        Сохранить
                                    </button>
                                )}
                                <button
                                    onClick={isCreatingTeam ? submitCreateTeam : closeTeamModal}
                                    disabled={isCreatingTeam && isSubmittingTeam}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase disabled:opacity-50"
                                >
                                    {isCreatingTeam ? (isSubmittingTeam ? 'Сохранение...' : 'Ок') : 'Закрыть'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Участники группы</p>
                                <div className="space-y-1">
                                    {getAvailablePlayersForTeam(activeTeam.id, isCreatingTeam ? draftUserIds : []).map((member) => (
                                        <button
                                            key={member.user_id}
                                            onClick={() => addPlayerToTeam(member.user_id)}
                                            disabled={!isCreatingTeam && !canEditTeam(activeTeam)}
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
                                                    {(currentMemberRole !== 'player' || member.user_id !== userId) && (
                                                        <button
                                                            onClick={() => setDraftUserIds(prev => prev.filter(id => id !== member.user_id))}
                                                            className="text-red-500 font-black"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
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
                                    disabled={!manualName.trim() || (!isCreatingTeam && !canEditTeam(activeTeam))}
                                    className="w-full bg-black text-white py-3 rounded-xl text-[10px] font-black uppercase disabled:opacity-40"
                                >
                                    Добавить вручную
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {creatorRemovalCandidate && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
                        <p className="text-sm font-black uppercase mb-3">Удалить создателя команды?</p>
                        <p className="text-xs text-gray-600 mb-5">
                            Если удалить этого игрока, команда будет удалена полностью. Продолжить?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    const teamToRemove = creatorRemovalCandidate.team
                                    setCreatorRemovalCandidate(null)
                                    await resetTeamToEmpty(teamToRemove)
                                    await onRefresh()
                                }}
                                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-[10px] font-black uppercase"
                            >
                                Да
                            </button>
                            <button
                                onClick={() => setCreatorRemovalCandidate(null)}
                                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-[10px] font-black uppercase"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
