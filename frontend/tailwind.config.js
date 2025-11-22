/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#070F22',
                'bg-soft': '#0B1733',
                fg: '#FFFFFF',
                muted: '#B9C7E6',
                accent: '#144AE0',
                primary: '#144AE0',
                danger: '#ff6b6b',
                card: '#0B1733',
                line: '#162549',
            },
            fontFamily: {
                sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
