'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  const [formData, setFormData] = useState({
    nickname: '',
    first_name: '',
    last_name: '',
    email: ''
  })

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFormData({
          nickname: profile.nickname,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email
        })
      }
      setLoading(false)
    }
    fetchUser()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ text: '', type: '' })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Проверка ника
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('nickname', formData.nickname)
        .neq('id', user?.id)
        .maybeSingle()

      if (existing) throw new Error('Этот никнейм уже занят')

      // Обновляем БД (триггеры подхватят остальное)
      const { error: dbError } = await supabase
        .from('users')
        .update({
          nickname: formData.nickname,
          first_name: formData.first_name,
          last_name: formData.last_name
        })
        .eq('id', user?.id)

      if (dbError) throw dbError

      // Обновляем метаданные сессии
      await supabase.auth.updateUser({
        data: { nickname: formData.nickname }
      })

      setMessage({ text: 'Профиль обновлен! В группах ник сменится автоматически.', type: 'success' })
      setTimeout(() => router.refresh(), 500)
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase italic text-gray-200">Загрузка профиля...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center text-black">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Профиль</h1>
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-[10px] font-black uppercase tracking-widest border border-gray-100 px-3 py-1 rounded-full">← Назад</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-gray-300 uppercase ml-3 mb-1 block tracking-widest">Email (🔒)</label>
            <input type="text" value={formData.email} disabled className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold text-gray-300 cursor-not-allowed border border-gray-100" />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase ml-3 mb-1 block tracking-widest text-blue-500">Никнейм</label>
            <input 
              type="text" 
              value={formData.nickname} 
              onChange={e => setFormData({...formData, nickname: e.target.value})}
              className="w-full bg-gray-50 border-2 border-transparent p-4 rounded-2xl text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all" 
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase ml-3 mb-1 block tracking-widest">Имя</label>
              <input 
                type="text" 
                value={formData.first_name} 
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-50 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white transition-all" 
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase ml-3 mb-1 block tracking-widest">Фамилия</label>
              <input 
                type="text" 
                value={formData.last_name} 
                onChange={e => setFormData({...formData, last_name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-50 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white transition-all" 
              />
            </div>
          </div>

          {message.text && (
            <p className={`text-center text-[10px] font-black uppercase tracking-tighter ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
              {message.text}
            </p>
          )}

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-all disabled:bg-gray-200 mt-4"
          >
            {saving ? 'Сохранение...' : 'Обновить данные'}
          </button>
        </form>
      </div>
    </div>
  )
}
