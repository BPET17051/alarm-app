import { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';

interface ControlsProps {
    selected: Set<string>;
}

export function Controls({ selected }: ControlsProps) {
    const { clearAll, saveTemplate, loadTemplate, templates, deleteTemplate, shiftItems, equalizeGaps } = useAlarms();
    const [showSave, setShowSave] = useState(false);
    const [showLoad, setShowLoad] = useState(false);
    const [showShift, setShowShift] = useState(false);
    const [showEqualize, setShowEqualize] = useState(false);
    const [tplName, setTplName] = useState('');
    const [shiftAmount, setShiftAmount] = useState(0);
    const [shiftUnit, setShiftUnit] = useState<'m' | 's'>('m');
    const [gapAmount, setGapAmount] = useState(5);
    const [gapUnit, setGapUnit] = useState<'m' | 's'>('m');

    return (
        <div className="mt-6 pt-6 border-t border-line/50">
            <div className="flex flex-wrap gap-3">
                {/* Bulk Actions Group */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowShift(true)}
                        disabled={selected.size === 0}
                        className="px-4 py-2.5 rounded-lg border border-line hover:bg-white/5 hover:border-primary/50 transition-all text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        title={selected.size === 0 ? "Select alarms to shift" : `Shift ${selected.size} alarm(s)`}
                        aria-label="Shift selected alarms"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                        </svg>
                        Shift Time
                    </button>
                    <button
                        onClick={() => setShowEqualize(true)}
                        disabled={selected.size < 2}
                        className="px-4 py-2.5 rounded-lg border border-line hover:bg-white/5 hover:border-primary/50 transition-all text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        title={selected.size < 2 ? "Select 2+ alarms to equalize" : `Equalize ${selected.size} alarm(s)`}
                        aria-label="Equalize gaps between selected alarms"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                        Equalize Gaps
                    </button>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px bg-line/50 self-stretch"></div>

                {/* Template Actions Group */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowLoad(true)}
                        className="px-4 py-2.5 rounded-lg border border-line hover:bg-white/5 hover:border-primary/50 transition-all text-sm font-semibold flex items-center gap-2"
                        aria-label="Load template"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                        Load Template
                    </button>
                    <button
                        onClick={() => setShowSave(true)}
                        className="px-4 py-2.5 rounded-lg border border-line hover:bg-white/5 hover:border-primary/50 transition-all text-sm font-semibold flex items-center gap-2"
                        aria-label="Save as template"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                        </svg>
                        Save Template
                    </button>
                </div>

                {/* Clear All - Danger Action */}
                <button
                    onClick={() => {
                        if (window.confirm('ลบ Alarm ทั้งหมด? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) {
                            clearAll();
                        }
                    }}
                    className="ml-auto px-4 py-2.5 rounded-lg border border-danger/50 text-danger hover:bg-danger/10 hover:border-danger transition-all text-sm font-semibold flex items-center gap-2"
                    aria-label="Clear all alarms"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    ล้างทั้งหมด
                </button>
            </div>

            {/* Shift Modal */}
            {showShift && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowShift(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowShift(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shift-modal-title"
                >
                    <div className="bg-card border border-line p-6 rounded-2xl shadow-2xl w-96 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="shift-modal-title" className="text-lg font-bold mb-2">เลื่อนเวลา Alarm</h3>
                        <p className="text-sm text-muted/70 mb-4">ปรับเวลา {selected.size} Alarm ที่เลือก</p>
                        <div className="flex gap-2 mb-6">
                            <input
                                type="number"
                                className="flex-1 bg-bg-soft border border-line rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={shiftAmount}
                                onChange={e => setShiftAmount(parseInt(e.target.value) || 0)}
                                placeholder="Amount"
                                aria-label="Shift amount"
                            />
                            <select
                                value={shiftUnit}
                                onChange={e => setShiftUnit(e.target.value as 'm' | 's')}
                                className="bg-bg-soft border border-line rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                                aria-label="Time unit"
                            >
                                <option value="m">Minutes</option>
                                <option value="s">Seconds</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowShift(false)} className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={() => {
                                    const delta = shiftUnit === 'm' ? shiftAmount * 60 : shiftAmount;
                                    shiftItems(Array.from(selected), delta);
                                    setShowShift(false);
                                }}
                                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-semibold"
                            >
                                Apply Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Equalize Modal */}
            {showEqualize && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowEqualize(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowEqualize(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="equalize-modal-title"
                >
                    <div className="bg-card border border-line p-6 rounded-2xl shadow-2xl w-96 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="equalize-modal-title" className="text-lg font-bold mb-2">จัดเวลาเท่าๆ กัน</h3>
                        <p className="text-sm text-muted/70 mb-4">ตั้งค่าระยะห่างเท่ากันระหว่าง {selected.size} Alarm</p>
                        <div className="flex gap-2 mb-6">
                            <input
                                type="number"
                                min="1"
                                className="flex-1 bg-bg-soft border border-line rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={gapAmount}
                                onChange={e => setGapAmount(parseInt(e.target.value) || 0)}
                                placeholder="Gap size"
                                aria-label="Gap amount"
                            />
                            <select
                                value={gapUnit}
                                onChange={e => setGapUnit(e.target.value as 'm' | 's')}
                                className="bg-bg-soft border border-line rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                                aria-label="Time unit"
                            >
                                <option value="m">Minutes</option>
                                <option value="s">Seconds</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowEqualize(false)} className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={() => {
                                    const gap = gapUnit === 'm' ? gapAmount * 60 : gapAmount;
                                    equalizeGaps(Array.from(selected), gap);
                                    setShowEqualize(false);
                                }}
                                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-semibold"
                            >
                                Apply Gaps
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Template Modal */}
            {showSave && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowSave(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowSave(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="save-modal-title"
                >
                    <div className="bg-card border border-line p-6 rounded-2xl shadow-2xl w-96 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="save-modal-title" className="text-lg font-bold mb-2">บันทึก Template</h3>
                        <p className="text-sm text-muted/70 mb-4">บันทึก Alarm ปัจจุบันเป็น Template</p>
                        <input
                            type="text"
                            placeholder="Template name..."
                            className="w-full bg-bg-soft border border-line rounded-lg p-3 mb-6 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={tplName}
                            onChange={e => setTplName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && tplName && (saveTemplate(tplName), setShowSave(false), setTplName(''))}
                            autoFocus
                            aria-label="Template name"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSave(false)} className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={() => { saveTemplate(tplName); setShowSave(false); setTplName(''); }}
                                disabled={!tplName}
                                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Load Template Modal */}
            {showLoad && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowLoad(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowLoad(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="load-modal-title"
                >
                    <div className="bg-card border border-line p-6 rounded-2xl shadow-2xl w-96 max-h-[80vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="load-modal-title" className="text-lg font-bold mb-2">โหลด Template</h3>
                        <p className="text-sm text-muted/70 mb-4">เลือก Template ที่ต้องการโหลด</p>
                        <div className="flex-1 overflow-y-auto space-y-2 mb-6 min-h-[100px]">
                            {templates.length === 0 ? (
                                <div className="text-center py-8 text-muted/50">
                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <p className="text-sm">No templates saved yet</p>
                                </div>
                            ) :
                                templates.map(t => (
                                    <div key={t.name} className="flex items-center justify-between p-3 border border-line rounded-lg hover:bg-white/5 hover:border-primary/50 transition-all group">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <svg className="w-4 h-4 text-muted/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                            </svg>
                                            <span className="font-medium truncate">{t.name}</span>
                                            <span className="text-xs text-muted/50">({t.items.length})</span>
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { loadTemplate(t.name); setShowLoad(false); }}
                                                className="px-3 py-1.5 text-xs rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-semibold"
                                            >
                                                Load
                                            </button>
                                            <button
                                                onClick={() => deleteTemplate(t.name)}
                                                className="px-3 py-1.5 text-xs rounded-md bg-danger/20 text-danger hover:bg-danger/30 transition-colors font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="flex justify-end border-t border-line/50 pt-4">
                            <button onClick={() => setShowLoad(false)} className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
