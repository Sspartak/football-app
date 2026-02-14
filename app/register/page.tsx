'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1️⃣ Сначала проверяем, не занят ли никнейм в таблице users
    const { data: existingUser } = await supabase
      .from('users')
      .select('nickname')
      .eq('nickname', nickname)
      .single()

    if (existingUser) {
      setError("Этот никнейм уже занят")
      setLoading(false)
      return
    }

    // 2️⃣ Регистрируем в Supabase Auth + записываем ник в метаданные
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname: nickname, // Сохраняем здесь для быстрого доступа
          first_name: firstName
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(`Ошибка регистрации: ${authError.message}`)
      setLoading(false)
      return
    }

    // 3️⃣ Добавляем данные в таблицу users
    const { error: dbError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user?.id,
          first_name: firstName,
          last_name: lastName,
          nickname,
          email,
        },
      ])

    if (dbError) {
      // Если случилась ошибка здесь (например, кто-то успел занять ник),
      // то Auth юзер уже создан, но данных в таблице нет.
      setError(`Ошибка записи в таблицу: ${dbError.message}`)
      setLoading(false)
      return
    }

    // 4️⃣ Вход
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError(`Ошибка при входе: ${signInError.message}`)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded shadow-md mt-10 text-black">
      <h1 className="text-2xl font-bold mb-6">Регистрация</h1>
      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Имя"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Фамилия"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Никнейм"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </form>
    </div>
  )
}
