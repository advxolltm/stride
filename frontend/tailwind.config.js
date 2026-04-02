/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

    darkMode: ['class', '[data-theme="dark"]'],

    theme: {
        extend: {
            colors: {
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                border: 'var(--border)',

                primary: 'var(--accent)',
                'primary-foreground': 'var(--accent-foreground)',

                default: 'var(--default)',
                'default-foreground': 'var(--default-foreground)',

                danger: 'var(--danger)',
                'danger-foreground': 'var(--danger-foreground)',

                success: 'var(--success)',
                'success-foreground': 'var(--success-foreground)',

                warning: 'var(--warning)',
                'warning-foreground': 'var(--warning-foreground)',

                surface: 'var(--surface)',
                'surface-foreground': 'var(--surface-foreground)',

                'surface-secondary': 'var(--surface-secondary)',
                'surface-secondary-foreground':
                    'var(--surface-secondary-foreground)',

                'surface-tertiary': 'var(--surface-tertiary)',
                'surface-tertiary-foreground':
                    'var(--surface-tertiary-foreground)',

                muted: 'var(--muted)',

                overlay: 'var(--overlay)',
                'overlay-foreground': 'var(--overlay-foreground)',

                separator: 'var(--separator)',
                scrollbar: 'var(--scrollbar)',

                segment: 'var(--segment)',
                'segment-foreground': 'var(--segment-foreground)',

                'field-background': 'var(--field-background)',
                'field-foreground': 'var(--field-foreground)',
                'field-placeholder': 'var(--field-placeholder)',

                focus: 'var(--focus)',
            },

            borderRadius: {
                base: 'var(--radius)',
                field: 'var(--field-radius)',
            },

            fontFamily: {
                onest: ['var(--font-onest)'],
                sans: ['var(--font-sans)'],
            },

            screens: {
                xs: '375px',
                xm: '510px',
            },
        },
    },

    plugins: [],

    future: {
        hoverOnlyWhenSupported: true,
    },

    experimental: {
        optimizeUniversalDefaults: true,
    },
}
