'use client'

import { Message } from '../types'
import { RefObject } from 'react'

interface Props {
    messages: Message[]
    userId: string | null
    isApproved: boolean
    newMessage: string
    setNewMessage: (value: string) => void
    onSendMessage: (e: React.FormEvent) => Promise<void>
    scrollRef: RefObject<HTMLDivElement | null>
}

export default function Chat({
    messages,
    userId,
    isApproved,
    newMessage,
    setNewMessage,
    onSendMessage,
    scrollRef
}: Props) {
    return (
        <div className="md:w-[60%] bg-white rounded-[2.5rem] flex flex-col shadow-sm border border-gray-100 overflow-hidden h-full relative">
            <div className="px-8 py-5 border-b shrink-0 flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">💬 Чат раздевалки</h2>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth bg-gray-50/20 custom-scroll">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.user_id === userId ? 'items-end' : 'items-start'}`}>
                        <div className="flex gap-2 items-center mb-1.5 px-1">
                            <span className={`text-[9px] font-black uppercase ${msg.user_id === userId ? 'text-blue-500' : 'text-gray-400'}`}>
                                {msg.nickname}
                            </span>
                            <span className="text-[7px] font-bold text-gray-300 uppercase">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className={`max-w-[85%] px-6 py-4 rounded-[1.8rem] text-[14px] font-semibold leading-tight shadow-sm transition-all not-italic ${
                            msg.user_id === userId 
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' 
                                : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                        }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            {isApproved ? (
                <form onSubmit={onSendMessage} className="p-6 bg-white border-t flex gap-3 shrink-0">
                    <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Сообщение..."
                        className="flex-1 bg-gray-50 px-6 py-4 rounded-2xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-blue-100 shadow-inner"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase active:scale-95 shadow-lg">
                        Send
                    </button>
                </form>
            ) : (
                <div className="p-6 bg-white border-t text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400">Чат после подтверждения</p>
                </div>
            )}
        </div>
    )
}
