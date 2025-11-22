import React from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full text-fg font-sans relative overflow-x-hidden">
            <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
                <header className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl filter drop-shadow-lg">⏰</div>
                        <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-muted">
                            Time Alarm
                        </h1>
                    </div>
                </header>
                <main className="w-full animate-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
}
