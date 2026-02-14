#!/bin/bash

# Скрипт для создания страниц Next.js: dashboard, create-room, join-room
# Работает в папке football-app

mkdir -p app/dashboard
mkdir -p app/create-room
mkdir -p app/join-room

# 4️⃣ dashboard/page.tsx
cat > app/dashboard/page.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    const user = supabase.auth.user()
    if (!user) router.push('/')

    const { data, error } = await supabase
      .from('room_members')
      .select('room_id, role, status, room:rooms(name)')
      .eq('user_id', user!.id)

    if (error) console.error(error)
    else setRooms(data || [])

    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <button onClick={logout}>Выйти</button>
      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <>
          <h2>Мои комнаты</h2>
          {rooms.length === 0 && <p>У вас нет комнат</p>}
          <ul>
            {rooms.map((r: any) => (
              <li key={r.room_id}>
                {r.room.name} ({r.role})
              </li>
            ))}
          </ul>
          <button onClick={() => router.push('/create-room')}>Создать комнату</button>
          <button onClick={() => router.push('/join-room')}>Вступить в комнату</button>
        </>
      )}
    </div>
  )
}
EOF

# 5️⃣ create-room/page.tsx
cat > app/create-room/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function CreateRoomPage() {
  const [name, setName] = useState('')
  const router = useRouter()
  const [message, setMessage] = useState('')

  const createRoom = async () => {
    const user = supabase.auth.user()
    if (!user) return

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name, admin_id: user.id })
      .select()
      .single()

    if (error) setMessage(error.message)
    else {
      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      })
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Создать комнату</h1>
      <input
        type="text"
        placeholder="Название комнаты"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button onClick={createRoom}>Создать</button>
      {message && <p>{message}</p>}
    </div>
  )
}
EOF

# 6️⃣ join-room/page.tsx
cat > app/join-room/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function JoinRoomPage() {
  const [roomId, setRoomId] = useState('')
  const [message, setMessage] = useState('')

  const joinRoom = async () => {
    const user = supabase.auth.user()
    if (!user) return

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error || !room) {
      setMessage('Комната не найдена')
      return
    }

    const { error: joinError } = await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      role: 'player',
      status: 'pending',
    })

    if (joinError) setMessage(joinError.message)
    else setMessage('Заявка отправлена, ждите подтверждения админа')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Вступить в комнату</h1>
      <input
        type="text"
        placeholder="ID комнаты"
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
      />
      <button onClick={joinRoom}>Вступить</button>
      {message && <p>{message}</p>}
    </div>
  )
}
EOF

echo "Страницы dashboard, create-room и join-room созданы!"
