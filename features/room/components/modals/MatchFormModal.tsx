'use client'

import { TEAM_TITLE_COLORS, TeamTitleColor } from '@/lib/constants/teamColors'

type MatchFormState = {
    matchType: 'match' | 'teams'
    address: string
    date: string
    start: string
    end: string
    max: number
    teamLimit: number
    gameFormat: number
    teamColors: TeamTitleColor[]
    cost?: number | ''
    costPayer?: 'player' | 'team'
}

interface Props {
    isOpen: boolean
    onClose: () => void
    formData: MatchFormState
    setFormData: (data: MatchFormState) => void
    onSave: () => Promise<void>
}

export default function MatchFormModal({ isOpen, onClose, formData, setFormData, onSave }: Props) {
    console.log('MatchFormModal render, isOpen:', isOpen, 'formData:', formData)
    
    if (!isOpen) {
        console.log('MatchFormModal not open')
        return null
    }
    
    console.log('MatchFormModal OPEN')

    const toggleTeamColor = (color: TeamTitleColor) => {
        const exists = formData.teamColors.some(
            selected => selected.bg === color.bg && selected.text === color.text && selected.label === color.label
        )

        if (exists) {
            setFormData({
                ...formData,
                teamColors: formData.teamColors.filter(
                    selected => !(selected.bg === color.bg && selected.text === color.text && selected.label === color.label)
                )
            })
            return
        }

        setFormData({
            ...formData,
            teamColors: [...formData.teamColors, color]
        })
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-md shadow-2xl scale-in not-italic max-h-[90vh] overflow-y-auto">
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 text-blue-600">Создать игру</h2>
                <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-2xl p-1 mb-6">
                    <button
                        onClick={() => setFormData({ ...formData, matchType: 'match' })}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                            formData.matchType === 'match' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        Матч
                    </button>
                    <button
                        onClick={() => setFormData({ ...formData, matchType: 'teams' })}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                            formData.matchType === 'teams' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        Команды
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-3.5 block tracking-widest">
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
                    {formData.matchType === 'teams' && (
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                                Формат игры (5x5, 11x11 и т.п.)
                            </label>
                            <input
                                type="number"
                                placeholder="5x5, 11x11"
                                value={formData.gameFormat}
                                onChange={e => setFormData({ ...formData, gameFormat: e.target.value === '' ? 5 : parseInt(e.target.value) })}
                                min="1"
                                className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                            {formData.matchType === 'teams' ? 'Лимит команд' : 'Лимит'}
                        </label>
                        <input
                            type="number"
                            value={formData.matchType === 'teams' ? formData.teamLimit : formData.max}
                            onChange={e => {
                                const value = e.target.value
                                const parsed = value === '' ? 2 : parseInt(value)
                                setFormData({ 
                                    ...formData, 
                                    ...(formData.matchType === 'teams'
                                        ? { teamLimit: parsed }
                                        : { max: value === '' ? 10 : parseInt(value) })
                                })
                            }}
                            min="2"
                            className="w-full bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                        />
                    </div>
                    {formData.matchType === 'teams' && (
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                                Цвета команд (необязательно)
                            </label>
                            <p className="text-[10px] text-gray-500 ml-3 mb-2">
                                Если выбран хотя бы один цвет, их количество должно совпадать с лимитом команд.
                            </p>
                            <div className="grid grid-cols-5 gap-2">
                                {TEAM_TITLE_COLORS.map((color) => {
                                    const isSelected = formData.teamColors.some(
                                        selected => selected.bg === color.bg && selected.text === color.text && selected.label === color.label
                                    )

                                    return (
                                        <button
                                            key={`${color.bg}-${color.text}-${color.label}`}
                                            type="button"
                                            onClick={() => toggleTeamColor(color)}
                                            className={`h-8 rounded-lg ${color.bg} ${color.text} border-2 ${
                                                color.bg === 'bg-white'
                                                    ? isSelected ? 'border-black' : 'border-gray-400'
                                                    : isSelected ? 'border-black' : 'border-transparent'
                                            }`}
                                            title={color.label}
                                        >
                                            {isSelected ? '✓' : ''}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-3 mb-1.5 block tracking-widest">
                            Стоимость (необязательно)
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                value={formData.cost === undefined ? '' : formData.cost}
                                onChange={e => {
                                    const v = e.target.value
                                    setFormData({ ...formData, cost: v === '' ? '' : parseFloat(v) })
                                }}
                                min="0"
                                className="flex-1 bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                            />
                            <select
                                value={formData.costPayer || 'player'}
                                onChange={e => setFormData({ ...formData, costPayer: e.target.value as 'player' | 'team' })}
                                className="bg-gray-50 p-5 rounded-3xl text-sm font-bold outline-none"
                            >
                                <option value="player">С игрока</option>
                                <option value="team">С команды</option>
                            </select>
                        </div>
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
