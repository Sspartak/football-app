'use client'

interface Props {
    roomName: string
    roomId: string
    canManageRoom: boolean
    isEditingName: boolean
    tempRoomName: string
    setIsEditingName: (value: boolean) => void
    setTempRoomName: (value: string) => void
    updateRoomName: () => Promise<void>
    onBack: () => void
}

export default function RoomHeader({
    roomName,
    roomId,
    canManageRoom,
    isEditingName,
    tempRoomName,
    setIsEditingName,
    setTempRoomName,
    updateRoomName,
    onBack
}: Props) {
    return (
        <header className="px-8 py-4 border-b flex justify-between items-center bg-white shrink-0 shadow-sm z-20">
            <div className="flex flex-col gap-1">
                {isEditingName && canManageRoom ? (
                    <div className="flex gap-2 items-center">
                        <input
                            value={tempRoomName}
                            onChange={(e) => setTempRoomName(e.target.value)}
                            className="text-xl font-black uppercase text-blue-600 border-b-2 border-blue-600 outline-none w-48 bg-transparent"
                            autoFocus
                        />
                        <button onClick={updateRoomName} className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black">
                            Ок
                        </button>
                    </div>
                ) : (
                    <h1
                        onClick={() => canManageRoom && setIsEditingName(true)}
                        className={`text-2xl font-black uppercase text-blue-600 tracking-tighter ${canManageRoom ? 'cursor-pointer hover:opacity-70' : ''}`}
                    >
                        {roomName}
                    </h1>
                )}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { navigator.clipboard.writeText(roomId); alert('ID команды скопирован') }}
                        className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors font-mono"
                        title="Нажмите, чтобы скопировать"
                    >
                        🆔 {roomId}
                    </button>
                </div>
            </div>
            <button
                onClick={onBack}
                className="text-[10px] font-black uppercase bg-gray-50 px-5 py-2 rounded-full hover:bg-black hover:text-white transition-all"
            >
                ← Назад
            </button>
        </header>
    )
}