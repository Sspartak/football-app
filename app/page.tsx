'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Проверяем сессию при загрузке
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    }
    checkUser()

    // Слушаем изменения состояния (логин/логут)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 animate-pulse font-medium">Загрузка приложения...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-black">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-10 border border-gray-100">
        
        {/* Логотип или Иконка */}
       {/* Логотип */}
<div className="w-100 h-30 mx-auto mb-8 flex items-center justify-center">
  <img 
    src="/footballhublogo1.png" 
    alt="Football Hub Logo"
    className="w-full h-full object-contain"
  />
</div>

        {user ? (
          /* Контент для авторизованного пользователя */
          <div className="text-center">
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">С возвращением!</h1>
            <p className="text-gray-500 mb-8 text-sm">
              Вы вошли как <span className="font-bold text-gray-800">{user.user_metadata?.nickname || user.email}</span>
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                В личный кабинет
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.refresh()
                }}
                className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
              >
                Выйти из аккаунта
              </button>
            </div>
          </div>
        ) : (
          /* Контент для гостя */
          <div className="text-center">
            
            <p className="text-gray-500 mb-10 text-sm leading-relaxed">
              Создавайте клубы, приглашайте друзей по ID команды и играйте вместе.
            </p>
            
            <div className="flex flex-col gap-4">
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Войти в профиль
              </button>
              <button
                onClick={() => router.push('/register')}
                className="w-full bg-white border-2 border-black text-black py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95"
              >
                Регистрация
              </button>
            </div>
            
            <p className="mt-8 text-[10px] text-gray-300 uppercase tracking-[0.2em] font-bold">
              v 1.0.0 Stable
            </p>
          </div>
        )}
        
      </div>
    </div>
  )
}
