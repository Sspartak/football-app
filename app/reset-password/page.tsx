'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) setMessage(`Ошибка: ${error.message}`)
    else setMessage('Инструкции отправлены на вашу почту!')
    
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 text-black">
      <h1 className="text-2xl font-bold mb-4">Восстановление пароля</h1>
      <p className="text-gray-500 mb-6 text-sm">Мы отправим вам ссылку для сброса пароля.</p>
      
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <input
          className="border p-3 rounded-lg"
          type="email"
          placeholder="Ваш Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button 
          className="bg-black text-white p-3 rounded-lg font-bold disabled:bg-gray-400"
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Отправка...' : 'Отправить ссылку'}
        </button>
      </form>
      
      {message && <p className="mt-4 text-blue-600 font-medium">{message}</p>}
      <Link href="/login" className="block mt-6 text-sm text-gray-500 hover:underline text-center">Вернуться ко входу</Link>
    </div>
  )
}
