'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function CreateRoomPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ошибка сессии')
      const userNick = user.user_metadata?.nickname

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ name: name, admin_id: user.id })
        .select().single()

      if (roomError) throw roomError

      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        email: user.email,
        nickname: userNick,
        approved: true,
        role: 'owner'
      })

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col justify-center text-black">
      <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-blue-50 border border-gray-100">
        <h1 className="text-3xl font-black mb-2 text-center italic tracking-tighter uppercase">Создать</h1>
        <p className="text-[10px] text-gray-400 mb-8 text-center uppercase font-bold tracking-widest underline decoration-blue-500 underline-offset-4">Новая игровая группа</p>
        
        <form onSubmit={createRoom} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название группы"
            className="w-full border-2 border-gray-50 p-4 rounded-2xl bg-gray-50 font-bold text-sm focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 text-black"
            required
          />
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:bg-gray-200"
          >
            {loading ? 'Creating...' : 'Запустить группу'}
          </button>
        </form>
        
        <button onClick={() => router.push('/dashboard')} className="w-full mt-8 text-gray-300 text-[9px] font-black uppercase tracking-widest hover:text-black transition-colors italic text-center">
          Отмена
        </button>
      </div>
    </div>
  )
}
