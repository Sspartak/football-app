'use client'

interface Props {
    address: string
    matchDate: string | null
    startTime: string | null
    endTime: string | null
    goCount: number
    maxPlayers: number
    teamLimit?: number | null
    matchType?: 'match' | 'teams'
    cost?: number | null
    costPayer?: 'player' | 'team' | null
    canManageRoom?: boolean
    onDelete?: () => void
    onEdit?: () => void
}

export default function MatchCard({ 
    address, 
    matchDate, 
    startTime, 
    endTime, 
    goCount, 
    maxPlayers,
    teamLimit,
    matchType,
    cost,
    costPayer,
    canManageRoom,
    onDelete,
    onEdit
}: Props) {
    const formattedDate = matchDate 
        ? new Date(matchDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        : '—'

    return (
        <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden shrink-0">
            {canManageRoom && (
    <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button
            onClick={onEdit}
            className="bg-blue-700/30 hover:bg-blue-700/50 text-white/60 hover:text-white text-[10px] font-black uppercase transition-all px-4 py-2 rounded-full min-w-[80px] relative z-50"
            style={{ pointerEvents: 'auto' }}
        >
            ✎ Изменить
        </button>
        <button
            onClick={onDelete}
            className="bg-red-500/30 hover:bg-red-500/50 text-white/60 hover:text-white text-[10px] font-black uppercase transition-all px-4 py-2 rounded-full min-w-[80px] relative z-50"
            style={{ pointerEvents: 'auto' }}
        >
            ✕ Удалить
        </button>
    </div>
)}
            
            <p className="text-base font-black uppercase mb-1 truncate">{address}</p>
            {typeof cost === 'number' && (
                <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">{cost} ₽ {costPayer === 'team' ? '/ с команды' : '/ с игрока'}</p>
            )}
            <p className="text-xl font-bold uppercase mb-4">{formattedDate}</p>
            <div className="flex gap-6 text-sm font-bold">
                <div>
                    <span className="opacity-60 text-[9px] block uppercase mb-1">Старт</span>
                    {startTime?.slice(0, 5) || '—'}
                </div>
                <div>
                    <span className="opacity-60 text-[9px] block uppercase mb-1">Конец</span>
                    {endTime?.slice(0, 5) || '—'}
                </div>
                <div className="ml-auto text-right text-blue-200">
                    {matchType === 'teams' ? `${goCount}/${teamLimit || '—'} команд` : `${goCount}/${maxPlayers}`}
                </div>
            </div>
        </div>
    )
}
