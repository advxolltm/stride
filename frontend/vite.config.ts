import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    test: {
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['.fttemplates/**', 'node_modules/**', 'dist/**'],
        environment: 'node',
    },
})
