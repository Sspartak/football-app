'use client'

interface Props {
    canManageRoom: boolean
    currentUserRole?: string
    pendingCount: number
    onShowMembers: () => void
    onShowPending: () => void
    onShowMatchForm: () => void
    onLeaveRoom: () => Promise<void>
}

export default function ActionButtons({
    canManageRoom,
    currentUserRole,
    pendingCount,
    onShowMembers,
    onShowPending,
    onShowMatchForm,
    onLeaveRoom
}: Props) {
    return (
        <div className="flex justify-center gap-6 mb-4">
            <button
                onClick={onShowMembers}
                className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors"
            >
                ⚽ Состав
            </button>

            {canManageRoom && (
                <button
                    onClick={onShowPending}
                    className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors relative"
                >
                    📩 Заявки
                    {pendingCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                            {pendingCount}
                        </span>
                    )}
                </button>
            )}

            {currentUserRole !== 'owner' && (
                <button
                    onClick={onLeaveRoom}
                    className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                >
                    🚪 Выйти из состава
                </button>
            )}

            {canManageRoom && (
                <button
                    onClick={onShowMatchForm}
                    className="text-xs font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors"
                >
                    ⚡ Создать игру
                </button>
            )}
        </div>
    )
}