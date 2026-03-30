/** @type {import('tailwindcss').Config} */

module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            backgroundImage: {},
            colors: {},
            fontFamily: {
                onest: ['var(--font-onest)'],
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
