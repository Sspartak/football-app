'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userNick, setUserNick] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    
    setUserId(user.id)
    
    // Получаем актуальный никнейм из таблицы users (на случай изменений в профиле)
    const { data: profile } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', user.id)
      .single()

    setUserNick(profile?.nickname || user.user_metadata?.nickname || 'Игрок')

    const { data: roomsData } = await supabase.from('rooms').select('*')
    const { data: membersData } = await supabase.from('room_members').select('*')

    setRooms(roomsData || [])
    setMembers(membersData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Realtime подписка: мгновенно обновляем статистику при вступлении или одобрении
    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const deleteRoom = async (roomId: string) => {
    if (window.confirm('Вы точно хотите удалить команду? Все данные участников исчезнут.')) {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId)
      if (error) alert(error.message)
      else fetchData()
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse text-gray-300 italic">Синхронизация...</p>
    </div>
  )

  const adminRooms = rooms.filter(r => r.admin_id === userId)
  const playerRooms = rooms.filter(r => r.admin_id !== userId)

  const GroupCard = ({ room, isAdmin }: { room: any, isAdmin: boolean }) => {
    const roomMembers = members.filter(m => m.room_id === room.id)
    const approvedCount = roomMembers.filter(m => m.approved).length
    const pendingCount = roomMembers.filter(m => !m.approved).length
    const myRecord = roomMembers.find(m => m.user_id === userId)
    const isMeApproved = myRecord?.approved

    return (
      <div className="border border-gray-100 p-6 rounded-[2.5rem] bg-white shadow-sm mb-4 flex justify-between items-center transition-all hover:border-blue-100 hover:shadow-md">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className={`text-lg font-black uppercase italic tracking-tighter ${isAdmin ? 'text-blue-600' : 'text-gray-900'}`}>
              {room.name}
            </h3>
            {!isAdmin && !isMeApproved && (
              <span className="bg-orange-50 text-orange-500 text-[8px] font-black px-2 py-0.5 rounded-md border border-orange-100 uppercase tracking-tighter">
                Ожидание
              </span>
            )}
          </div>
          <div className="flex gap-4">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
               👥 В КОМАНДЕ: <span className="text-black font-black">{approvedCount}</span>
             </span>
             {/* Проверяем роль пользователя в этой команде */}
{(() => {
  const userMember = roomMembers.find(m => m.user_id === userId);
  const canManage = userMember?.role === 'owner' || userMember?.role === 'admin';
  return canManage && pendingCount > 0 && (
    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 rounded-full italic animate-bounce">
      📩 ЗАЯВКИ: {pendingCount}
    </span>
  );
})()}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.push(`/room/${room.id}`)}
            className="bg-black text-white px-7 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-gray-200"
          >
            Пойти на тренировку
          </button>
          {isAdmin && (
            <button 
              onClick={() => deleteRoom(room.id)} 
              className="w-10 h-10 flex items-center justify-center text-gray-200 hover:text-red-500 transition-colors text-2xl font-light leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/30 p-6 text-black flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <button 
            onClick={() => router.push('/profile')}
            className="group flex flex-col items-start"
          >
            <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none group-hover:text-blue-600 transition-colors">
              {userNick}
            </h1>
            <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity">Настроить профиль →</span>
          </button>
          
          <button 
            onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} 
            className="text-[9px] font-black text-gray-400 uppercase border-2 border-gray-100 px-4 py-1.5 rounded-full hover:bg-black hover:text-white transition-all tracking-widest"
          >
            Выход
          </button>
        </header>

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-4 mb-14">
          <button 
            onClick={() => router.push('/create-room')} 
            className="bg-blue-600 text-white p-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all hover:bg-blue-700"
          >
            Создать команду
          </button>
          <button 
            onClick={() => router.push('/join-room')} 
            className="bg-white border-2 border-gray-100 p-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] text-gray-400 hover:border-black hover:text-black transition-all shadow-sm active:scale-95"
          >
            Найти команду
          </button>
        </div>

        {/* ADMIN SECTION */}
        <section className="mb-12">
          <h2 className="text-[10px] font-black text-gray-300 mb-6 uppercase tracking-[0.4em] ml-4 italic underline decoration-blue-500 underline-offset-8 decoration-2">
            Ваши команды
          </h2>
          {adminRooms.length > 0 ? (
            adminRooms.map(r => <GroupCard key={r.id} room={r} isAdmin={true} />)
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-[2.5rem] text-[10px] font-black uppercase text-gray-200 tracking-widest">
              У вас нет созданных команд
            </div>
          )}
        </section>

        {/* PLAYER SECTION */}
        <section className="pb-10">
          <h2 className="text-[10px] font-black text-gray-300 mb-6 uppercase tracking-[0.4em] ml-4 italic">
            Команды в которых вы состоите
          </h2>
          {playerRooms.length > 0 ? (
            playerRooms.map(r => <GroupCard key={r.id} room={r} isAdmin={false} />)
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-[2.5rem] text-[10px] font-black uppercase text-gray-200 tracking-widest">
              Вы еще не вступили в команды
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
