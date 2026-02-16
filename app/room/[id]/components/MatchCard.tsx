'use client'

interface Props {
    address: string
    matchDate: string | null
    startTime: string | null
    endTime: string | null
    goCount: number
    maxPlayers: number
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
    canManageRoom,
    onDelete,
    onEdit
}: Props) {
    const formattedDate = matchDate 
        ? new Date(matchDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        : '—'

    return (
        <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden shrink-0">
            {/* Кнопки управления матчем */}
            {canManageRoom && (
                <div className="absolute top-4 right-4 flex gap-2">
                    <button
                        onClick={onEdit}
                        className="text-white/60 hover:text-white text-[10px] font-black uppercase transition-colors bg-blue-700/30 px-3 py-1 rounded-full"
                    >
                        ✎ Изменить
                    </button>
                    <button
                        onClick={onDelete}
                        className="text-white/60 hover:text-white text-[10px] font-black uppercase transition-colors bg-red-500/30 px-3 py-1 rounded-full"
                    >
                        ✕ Удалить
                    </button>
                </div>
            )}
            
            <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest truncate">{address}</p>
            <p className="text-xl font-black uppercase mb-4">{formattedDate}</p>
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
                    {goCount}/{maxPlayers}
                </div>
            </div>
        </div>
    )
}