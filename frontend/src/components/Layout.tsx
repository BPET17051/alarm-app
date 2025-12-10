import React from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full text-fg font-sans relative overflow-x-hidden">
            {/* Skip to content link for screen readers and keyboard users */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-white"
            >
                ข้ามไปเนื้อหาหลัก
            </a>
            <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
                <header className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl filter drop-shadow-lg" aria-hidden="true">⏰</div>
                        <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-muted">
                            Time Alarm
                        </h1>
                    </div>
                </header>
                <main id="main-content" className="w-full animate-fade-in" tabIndex={-1}>
                    {children}
                </main>
            </div>
        </div>
    );
}
