'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-lg text-black">
      <h1 className="text-2xl font-bold mb-6 text-center">Вход в систему</h1>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          className="border p-3 rounded-lg bg-gray-50"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border p-3 rounded-lg bg-gray-50"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button 
          className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="text-red-600 mb-2 italic">Неверный логин или пароль.</p>
          <div className="flex flex-col gap-1">
            <Link href="/register" className="text-blue-600 hover:underline">
              Зарегистрироваться заново →
            </Link>
            <Link href="/reset-password" className="text-blue-600 hover:underline">
              Забыли пароль? Восстановить →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
