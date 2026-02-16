'use client'

interface Props {
    isOpen: boolean
    onClose: () => void
    formData: {
        address: string
        date: string
        start: string
        end: string
        max: number
    }
    setFormData: (data: any) => void
    onSave: () => Promise<void>
}

export default function MatchFormModal({
    isOpen,
    onClose,
    formData,
    setFormData,
    onSave
}: Props) {
    if (!isOpen) return null
console.log('MatchFormModal OPEN')

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-md shadow-2xl scale-in not-italic">
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-8 text-blue-600">Матч</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                            Место
                        </label>
                        <input
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                            Дата
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                                Старт
                            </label>
                            <input
                                type="time"
                                value={formData.start}
                                onChange={e => setFormData({ ...formData, start: e.target.value })}
                                className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                                Конец
                            </label>
                            <input
                                type="time"
                                value={formData.end}
                                onChange={e => setFormData({ ...formData, end: e.target.value })}
                                className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none shadow-inner"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                            Лимит
                        </label>
                        <input
                            type="number"
                            value={formData.max}
                            onChange={e => {
                                const value = e.target.value;
                                setFormData({ 
                                    ...formData, 
                                    max: value === '' ? 10 : parseInt(value) 
                                });
                            }}
                            min="2"
                            className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-6">
                        <button 
                            onClick={onSave} 
                            className="flex-1 bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all"
                        >
                            Ок
                        </button>
                        <button 
                            onClick={onClose} 
                            className="flex-1 bg-gray-100 text-gray-400 py-5 rounded-[2rem] font-black uppercase text-xs"
                        >
                            Назад
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}