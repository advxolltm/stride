import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'APPLICATION_MODE', 'PASSWORD_', 'USERNAME_', 'SCHED_'],
    server: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: true,
        watch: {
            usePolling: true,
        },
        allowedHosts: ['frontserver'],
        hmr: {
            protocol: 'ws',
            host: 'localhost',
            clientPort: 8080,
        },
    },
    test: {
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['.fttemplates/**', 'node_modules/**', 'dist/**'],
        environment: 'node',
    },
})
