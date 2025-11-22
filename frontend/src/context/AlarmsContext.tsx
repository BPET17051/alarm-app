import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AlarmItem, Template } from '../types';
import * as API from '../services/api';
import * as Storage from '../services/storage';

interface AlarmsContextType {
    items: AlarmItem[];
    jobName: string;
    setJobName: (name: string) => void;
    templates: Template[];
    playedIds: Set<string>;
    addItem: (h: number, m: number, s: number, label: string, audioId: string | null, audioName: string) => Promise<void>;
    updateItem: (id: string, updates: Partial<AlarmItem>) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
    markPlayed: (id: string, status: 'SENT' | 'FAILED') => Promise<void>;
    shiftItems: (ids: string[], deltaSeconds: number) => Promise<void>;
    equalizeGaps: (ids: string[], gapSeconds: number) => Promise<void>;
    saveTemplate: (name: string) => void;
    loadTemplate: (name: string) => Promise<void>;
    deleteTemplate: (name: string) => void;
}

const AlarmsContext = createContext<AlarmsContextType | undefined>(undefined);

export function AlarmsProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<AlarmItem[]>([]);
    const [jobName, setJobName] = useState('');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());

    // Load initial state
    useEffect(() => {
        loadAlarms();
        setJobName(Storage.loadJobName());
        // Templates loaded via API in separate effect
        const played = Storage.loadPlayed();
        const today = new Date().toISOString().split('T')[0];
        if (played.date !== today) {
            Storage.savePlayed(today, []);
            setPlayedIds(new Set());
        } else {
            setPlayedIds(new Set(played.ids));
        }
    }, []);

    const loadAlarms = async () => {
        try {
            const data = await API.getAlarms();
            console.log('Loaded alarms:', data);
            setItems(data);
        } catch (e) {
            console.error('Failed to load alarms', e);
        }
    };

    // Persistence effects
    useEffect(() => {
        Storage.saveJobName(jobName);
    }, [jobName]);

    useEffect(() => {
        Storage.saveTemplates(templates);
    }, [templates]);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        Storage.savePlayed(today, Array.from(playedIds));
    }, [playedIds]);

    // Actions
    const addItem = useCallback(async (h: number, m: number, s: number, label: string, audioId: string | null, audioName: string) => {
        try {
            console.log('Adding item:', { h, m, s, label, audioId, audioName });
            const newItem = await API.createAlarm({ h, m, s, label, audioId, audioName });
            console.log('Added item response:', newItem);
            setItems(prev => {
                const next = [...prev, newItem].sort((a, b) => (a.h * 3600 + a.m * 60 + a.s) - (b.h * 3600 + b.m * 60 + b.s));
                console.log('New items state:', next);
                return next;
            });
        } catch (e: any) {
            console.error('Failed to add alarm', e);
            alert(`Failed to add alarm: ${e.message}`);
        }
    }, []);

    const updateItem = useCallback(async (id: string, updates: Partial<AlarmItem>) => {
        try {
            const updated = await API.updateAlarm(id, updates);
            setItems(prev => prev.map(item => item.id === id ? updated : item).sort((a, b) => (a.h * 3600 + a.m * 60 + a.s) - (b.h * 3600 + b.m * 60 + b.s)));
        } catch (e) {
            console.error('Failed to update alarm', e);
        }
    }, []);

    const removeItem = useCallback(async (id: string) => {
        try {
            await API.deleteAlarm(id);
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (e) {
            console.error('Failed to delete alarm', e);
        }
    }, []);

    const clearAll = useCallback(async () => {
        try {
            await API.clearAlarms();
            setItems([]);
        } catch (e) {
            console.error('Failed to clear alarms', e);
        }
    }, []);

    const markPlayed = useCallback(async (id: string, status: 'SENT' | 'FAILED') => {
        setPlayedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        // Optimistic update
        setItems(prev => prev.map(item => item.id === id ? { ...item, notify_status: status } : item));
        // Sync with backend
        try {
            await API.updateAlarm(id, { notify_status: status });
        } catch (e) {
            console.error('Failed to update status', e);
        }
    }, []);

    const shiftItems = useCallback(async (ids: string[], deltaSeconds: number) => {
        const idSet = new Set(ids);
        const toUpdate = items.filter(item => idSet.has(item.id));

        for (const item of toUpdate) {
            const totalSecs = (item.h * 3600 + item.m * 60 + item.s + deltaSeconds + 86400) % 86400;
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            await updateItem(item.id, { h, m, s });
        }
    }, [items, updateItem]);

    const equalizeGaps = useCallback(async (ids: string[], gapSeconds: number) => {
        const idSet = new Set(ids);
        // Get selected items sorted by time
        const selectedItems = items
            .filter(item => idSet.has(item.id))
            .sort((a, b) => (a.h * 3600 + a.m * 60 + a.s) - (b.h * 3600 + b.m * 60 + b.s));

        if (selectedItems.length < 2) return;

        // Start from the first item's time
        let currentTotalSecs = selectedItems[0].h * 3600 + selectedItems[0].m * 60 + selectedItems[0].s;

        // Update subsequent items
        for (let i = 1; i < selectedItems.length; i++) {
            currentTotalSecs = (currentTotalSecs + gapSeconds + 86400) % 86400;
            const h = Math.floor(currentTotalSecs / 3600);
            const m = Math.floor((currentTotalSecs % 3600) / 60);
            const s = currentTotalSecs % 60;
            await updateItem(selectedItems[i].id, { h, m, s });
        }
    }, [items, updateItem]);

    const saveTemplate = useCallback(async (name: string) => {
        try {
            await API.saveTemplate(name, items);
            const tpls = await API.getTemplates();
            setTemplates(tpls);
        } catch (e) {
            console.error(e);
        }
    }, [items]);

    const loadTemplate = useCallback(async (name: string) => {
        const tpl = templates.find(t => t.name === name);
        if (tpl) {
            await clearAll();
            // Add items sequentially to preserve order
            for (const item of tpl.items) {
                await addItem(item.h, item.m, item.s || 0, item.label || '', item.audioId, item.audioName);
            }
        }
    }, [templates, clearAll, addItem]);

    const deleteTemplate = useCallback(async (name: string) => {
        try {
            await API.deleteTemplate(name);
            setTemplates(prev => prev.filter(t => t.name !== name));
        } catch (e) {
            console.error(e);
        }
    }, []);

    const value = {
        items,
        jobName,
        setJobName,
        templates,
        playedIds,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        markPlayed,
        shiftItems,
        equalizeGaps,
        saveTemplate,
        loadTemplate,
        deleteTemplate
    };

    return (
        <AlarmsContext.Provider value={value}>
            {children}
        </AlarmsContext.Provider>
    );
}

export function useAlarmsContext() {
    const context = useContext(AlarmsContext);
    if (context === undefined) {
        throw new Error('useAlarmsContext must be used within an AlarmsProvider');
    }
    return context;
}
