'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(`Ошибка: ${error.message}`)
    } else {
      setMessage('Пароль успешно изменен!')
      setTimeout(() => router.push('/dashboard'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 text-black">
      <h1 className="text-2xl font-bold mb-4">Придумайте новый пароль</h1>
      <form onSubmit={handleUpdate} className="flex flex-col gap-4">
        <input
          className="border p-3 rounded-lg"
          type="password"
          placeholder="Новый пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button 
          className="bg-green-600 text-white p-3 rounded-lg font-bold"
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Обновление...' : 'Сохранить пароль'}
        </button>
      </form>
      {message && <p className="mt-4 text-center font-bold">{message}</p>}
    </div>
  )
}
