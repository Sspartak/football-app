'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function JoinRoomPage() {
  const [roomId, setRoomId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const joinRoom = async () => {
    if (!roomId.trim()) return
    setLoading(true)
    setError('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Авторизуйтесь снова')
      const userNick = user.user_metadata?.nickname

      const { error: insertError } = await supabase.from('room_members').insert({
        room_id: roomId,
        user_id: user.id,
        email: user.email,
        nickname: userNick,
        approved: false
      })

      if (insertError) throw new Error('Группа не найдена или вы уже подали заявку')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col justify-center text-black">
      <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-gray-200 border border-gray-100">
        <h1 className="text-3xl font-black mb-2 text-center italic tracking-tighter uppercase">Вступить</h1>
        <p className="text-[10px] text-gray-400 mb-8 text-center uppercase font-bold tracking-widest underline decoration-green-500 underline-offset-4">Введите UUID группы</p>
        
        <input
          type="text"
          placeholder="00000000-0000-0000-0000-000000000000"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          className="border-2 border-gray-50 p-4 w-full rounded-2xl mb-6 bg-gray-50 font-mono text-xs focus:border-green-500 outline-none transition-all"
        />
        
        <button
          onClick={joinRoom}
          disabled={loading}
          className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all disabled:bg-gray-200"
        >
          {loading ? 'Sending...' : 'Подать заявку'}
        </button>
        
        {error && <p className="text-red-500 mt-6 text-[10px] font-black uppercase text-center tracking-tighter">{error}</p>}
        
        <button onClick={() => router.push('/dashboard')} className="w-full mt-8 text-gray-300 text-[9px] font-black uppercase tracking-widest hover:text-black transition-colors italic">
          Вернуться на базу
        </button>
      </div>
    </div>
  )
}
