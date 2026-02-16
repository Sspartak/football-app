'use client'

import { Member } from './types'

interface Props {
    isOpen: boolean
    onClose: () => void
    members: Member[]
    approvedCount: number
    canManageRoom: boolean
    currentUserRole?: string
    userId: string | null
    onApprove: (memberId: string) => Promise<void>
    onMakeAdmin: (memberUserId: string) => Promise<void>
    onRemoveAdmin: (memberUserId: string) => Promise<void>
    onRemove: (memberId: string) => Promise<void>
    onLeave: () => Promise<void>
}

export default function MembersModal({
    isOpen,
    onClose,
    members,
    approvedCount,
    canManageRoom,
    currentUserRole,
    userId,
    onApprove,
    onMakeAdmin,
    onRemoveAdmin,
    onRemove,
    onLeave
}: Props) {
    if (!isOpen) return null

    const staff = members.filter(m => m.role === 'owner' || m.role === 'admin')
    const players = members.filter(m => m.role === 'player')
    const bench = members.filter(m => m.role === 'pending')
    const currentMember = members.find(m => m.user_id === userId)

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl scale-in not-italic">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-blue-600">
                        Состав команды ({approvedCount})
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-black text-xl font-black">✕</button>
                </div>

                <div className="space-y-6">
                    {/* Тренерский штаб */}
                    {staff.length > 0 && (
                        <div>
                            <h3 className="text-sm font-black uppercase text-purple-600 mb-3 tracking-wider">
                                👔 Тренерский штаб
                            </h3>
                            <div className="space-y-3">
                                {staff.map((member) => (
                                    <div key={member.id} className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-sm">{member.nickname || '—'}</p>
                                            <p className="text-xs text-gray-500">{member.first_name} {member.last_name}</p>
                                            <p className="text-[9px] font-black uppercase mt-1">
                                                {member.role === 'owner' && <span className="text-purple-600">Владелец</span>}
                                                {member.role === 'admin' && <span className="text-blue-600">Админ</span>}
                                            </p>
                                        </div>
                                        {canManageRoom && member.user_id !== userId && member.role !== 'owner' && (
                                            <div className="flex gap-2">
                                                {member.role === 'admin' ? (
                                                    <button
                                                        onClick={() => onRemoveAdmin(member.user_id)}
                                                        className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-orange-600 transition-all min-w-[100px]"
                                                    >
                                                        Убрать админа
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => onMakeAdmin(member.user_id)}
                                                        className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 transition-all min-w-[100px]"
                                                    >
                                                        Сделать админом
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onRemove(member.id)}
                                                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 transition-all min-w-[100px]"
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Основной состав */}
                    {players.length > 0 && (
                        <div>
                            <h3 className="text-sm font-black uppercase text-green-600 mb-3 tracking-wider">
                                ⚽ Основной состав
                            </h3>
                            <div className="space-y-3">
                                {players.map((member) => (
                                    <div key={member.id} className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-sm">{member.nickname || '—'}</p>
                                            <p className="text-xs text-gray-500">{member.first_name} {member.last_name}</p>
                                            <p className="text-[9px] font-black uppercase mt-1 text-green-600">Игрок</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {canManageRoom && member.user_id !== userId && (
                                                <>
                                                    <button
                                                        onClick={() => onMakeAdmin(member.user_id)}
                                                        className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 transition-all min-w-[100px]"
                                                    >
                                                        Сделать админом
                                                    </button>
                                                    <button
                                                        onClick={() => onRemove(member.id)}
                                                        className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 transition-all min-w-[100px]"
                                                    >
                                                        Удалить
                                                    </button>
                                                </>
                                            )}
                                            {/* Кнопка "Выйти" для самого участника */}
                                            {member.user_id === userId && currentUserRole !== 'owner' && (
                                                <button
                                                    onClick={onLeave}
                                                    className="bg-gray-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-gray-600 transition-all min-w-[100px]"
                                                >
                                                    Выйти
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Скамейка запасных */}
                    {bench.length > 0 && (
                        <div>
                            <h3 className="text-sm font-black uppercase text-yellow-600 mb-3 tracking-wider">
                                🪑 Скамейка запасных
                            </h3>
                            <div className="space-y-3">
                                {bench.map((member) => (
                                    <div key={member.id} className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-sm">{member.nickname || '—'}</p>
                                            <p className="text-xs text-gray-500">{member.first_name} {member.last_name}</p>
                                            <p className="text-[9px] font-black uppercase mt-1 text-yellow-600">Ожидание</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {canManageRoom && (
                                                <>
                                                    <button
                                                        onClick={() => onApprove(member.id)}
                                                        className="bg-green-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-green-600 transition-all min-w-[100px]"
                                                    >
                                                        Подтвердить
                                                    </button>
                                                    <button
                                                        onClick={() => onRemove(member.id)}
                                                        className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 transition-all min-w-[100px]"
                                                    >
                                                        Удалить
                                                    </button>
                                                </>
                                            )}
                                            {/* Кнопка "Выйти" для самого участника в ожидании */}
                                            {member.user_id === userId && (
                                                <button
                                                    onClick={onLeave}
                                                    className="bg-gray-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-gray-600 transition-all min-w-[100px]"
                                                >
                                                    Выйти
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}