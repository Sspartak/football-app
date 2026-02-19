'use client'

import { Member } from '../../types'

interface Props {
    isOpen: boolean
    onClose: () => void
    pendingMembers: Member[]
    onApprove: (memberId: string) => Promise<void>
    onRemove: (memberId: string) => Promise<void>
}

export default function PendingModal({
    isOpen,
    onClose,
    pendingMembers,
    onApprove,
    onRemove
}: Props) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl scale-in not-italic">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-yellow-500">
                        Ожидают ({pendingMembers.length})
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-black text-xl font-black">✕</button>
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
                                    onClick={() => onApprove(member.id)}
                                    className="bg-green-500 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase"
                                >
                                    Подтвердить
                                </button>
                                <button
                                    onClick={() => onRemove(member.id)}
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
    )
}
