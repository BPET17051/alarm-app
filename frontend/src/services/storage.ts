import type { AlarmItem, Template } from '../types';

const NS = 'schd:v1';
const STORE_ITEMS = `${NS}:items`;
const STORE_JOB = `${NS}:job`;
const STORE_TPLS = `${NS}:tpls`;
const STORE_PLAYED = `${NS}:played`;

export function loadItems(): AlarmItem[] {
    try {
        const raw = localStorage.getItem(STORE_ITEMS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveItems(items: AlarmItem[]) {
    localStorage.setItem(STORE_ITEMS, JSON.stringify(items));
}

export function loadJobName(): string {
    return localStorage.getItem(STORE_JOB) || '';
}

export function saveJobName(name: string) {
    localStorage.setItem(STORE_JOB, name);
}

export function loadTemplates(): Template[] {
    try {
        const raw = localStorage.getItem(STORE_TPLS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveTemplates(tpls: Template[]) {
    localStorage.setItem(STORE_TPLS, JSON.stringify(tpls));
}

export function loadPlayed(): { date: string; ids: string[] } {
    try {
        const raw = localStorage.getItem(STORE_PLAYED);
        return raw ? JSON.parse(raw) : { date: '', ids: [] };
    } catch {
        return { date: '', ids: [] };
    }
}

export function savePlayed(date: string, ids: string[]) {
    localStorage.setItem(STORE_PLAYED, JSON.stringify({ date, ids }));
}
