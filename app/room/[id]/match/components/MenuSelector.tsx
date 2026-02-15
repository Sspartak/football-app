'use client'

interface Props {
  numTeams: number
  setNumTeams: (value: number) => void
  onAuto: () => void
  onBaskets: () => void
  onManual: () => void
}

export default function MenuSelector({ numTeams, setNumTeams, onAuto, onBaskets, onManual }: Props) {
  return (
    <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-xl space-y-8">
      <div>
        <label className="text-[10px] text-gray-400 block mb-4 text-center tracking-widest">Количество команд</label>
        <div className="flex items-center justify-center gap-6">
          <button 
            onClick={() => setNumTeams(Math.max(2, numTeams - 1))} 
            className="text-2xl w-12 h-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            -
          </button>
          <span className="text-6xl text-blue-600 w-20 text-center">{numTeams}</span>
          <button 
            onClick={() => setNumTeams(Math.min(99, numTeams + 1))} 
            className="text-2xl w-12 h-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            +
          </button>
        </div>
        <p className="text-[8px] text-gray-400 text-center mt-2">макс. 99 команд</p>
      </div>
      <div className="space-y-3">
        <button 
          onClick={onAuto} 
          className="w-full bg-blue-600 text-white py-5 rounded-[2rem] text-[10px] shadow-lg active:scale-95 transition-all"
        >
          Авто-рандом
        </button>
        <button 
          onClick={onBaskets} 
          className="w-full border-2 border-blue-600 text-blue-600 py-5 rounded-[2rem] text-[10px] active:scale-95 transition-all hover:bg-blue-50"
        >
          По корзинам
        </button>
        <button 
          onClick={onManual} 
          className="w-full bg-green-600 text-white py-5 rounded-[2rem] text-[10px] shadow-lg active:scale-95 transition-all"
        >
          Вручную
        </button>
      </div>
    </div>
  )
}