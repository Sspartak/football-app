'use client'

import { Slot } from '../types'

interface Props {
    matchId: string
    userId: string | null
    goPlayers: Slot[]
    reservePlayers: Slot[]
    notGoPlayers: Slot[]
    canManageRoom: boolean
    canVote: boolean
    maxPlayers: number
    onVote: (status: 'go' | 'reserve' | 'not_go') => void
    onDeleteSlot: (slotId: string) => void
    onAddManualPlayer: () => void
    manualName: string
    setManualName: (value: string) => void
    showManualInput: boolean
}

export default function VotingPanel({
    userId,
    goPlayers,
    reservePlayers,
    notGoPlayers,
    canManageRoom,
    canVote,
    maxPlayers,
    onVote,
    onDeleteSlot,
    onAddManualPlayer,
    manualName,
    setManualName,
    showManualInput
}: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-3 items-start flex-1 shrink-0">
                {/* ИДУТ */}
                <div className="flex flex-col gap-3">
                    <div className="bg-green-50/50 border border-green-100 p-4 rounded-3xl min-h-[350px]">
                        <p className="text-[8px] font-black uppercase text-green-600 mb-3 text-center tracking-tighter">
                            Идут ({goPlayers.length}/{maxPlayers})
                        </p>
                        <div className="space-y-2">
                            {goPlayers.map((p) => (
                                <div key={p.id} className="text-[11px] font-bold flex flex-col border-b border-green-100 pb-1 relative not-italic">
                                    <span className="truncate pr-4">{p.nickname}</span>
                                    {(canManageRoom || p.added_by_user_id === userId) && (
                                        <button 
                                            onClick={() => onDeleteSlot(p.id)} 
                                            className="absolute right-0 top-0 text-red-500 font-black"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {canVote && (
                        <button
                            onClick={() => onVote('go')}
                            className="w-full bg-green-500 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
                        >
                            Иду
                        </button>
                    )}
                </div>

                {/* РЕЗЕРВ */}
                <div className="flex flex-col gap-3">
                    <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-3xl min-h-[350px]">
                        <p className="text-[8px] font-black uppercase text-orange-600 mb-3 text-center tracking-tighter">
                            Резерв ({reservePlayers.length})
                        </p>
                        <div className="space-y-2 text-orange-800">
                            {reservePlayers.map((p) => (
                                <div key={p.id} className="text-[11px] font-bold flex flex-col border-b border-orange-100 pb-1 relative not-italic">
                                    <span className="truncate pr-4 text-orange-600 font-black">{p.nickname}</span>
                                    {(canManageRoom || p.added_by_user_id === userId) && (
                                        <button 
                                            onClick={() => onDeleteSlot(p.id)} 
                                            className="absolute right-0 top-0 text-red-500 font-black"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {canVote && (
                        <button
                            onClick={() => onVote('reserve')}
                            className="w-full bg-orange-500 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
                        >
                            В резерв
                        </button>
                    )}
                </div>

                {/* НЕ ИДУ */}
                <div className="flex flex-col gap-3">
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-3xl min-h-[350px]">
                        <p className="text-[8px] font-black uppercase text-gray-400 mb-3 text-center tracking-tighter">
                            Не идут ({notGoPlayers.length})
                        </p>
                        <div className="space-y-2 italic text-gray-400">
                            {notGoPlayers.map((p) => (
                                <div key={p.id} className="text-[11px] font-medium flex flex-col border-b border-gray-100 pb-1 relative not-italic">
                                    <span className="truncate pr-4 text-gray-400">{p.nickname}</span>
                                    {(canManageRoom || p.added_by_user_id === userId) && (
                                        <button 
                                            onClick={() => onDeleteSlot(p.id)} 
                                            className="absolute right-0 top-0 text-gray-400 font-black"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {canVote && (
                        <button
                            onClick={() => onVote('not_go')}
                            className="w-full bg-white border-2 border-gray-200 text-gray-400 py-4 rounded-2xl text-[9px] font-black uppercase active:scale-95"
                        >
                            Не иду
                        </button>
                    )}
                </div>
            </div>

            {showManualInput && canVote && (
                <div className="flex gap-2 pt-6 border-t border-dashed mt-2 shrink-0">
                    <input
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="Вписать вручную..."
                        className="flex-1 bg-gray-50 px-5 py-3 rounded-2xl text-xs font-bold outline-none border border-gray-100 italic"
                    />
                    <button 
                        onClick={onAddManualPlayer} 
                        className="bg-black text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase active:scale-95 shadow-md"
                    >
                        Добавить
                    </button>
                </div>
            )}
        </div>
    )
}
