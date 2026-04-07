import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import common_en from './locales/en/common.json'
import project_en from './locales/en/project.json'

import common_de from './locales/de/common.json'
import project_de from './locales/de/project.json'

const savedLang = localStorage.getItem('lang') || 'en'

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                common: common_en,
                project: project_en,
            },
            de: {
                common: common_de,
                project: project_de,
            },
        },
        lng: savedLang,
        fallbackLng: 'en',
        ns: ['common', 'project'],
        defaultNS: 'common',
        interpolation: {
            escapeValue: false,
        },
    })

export default i18n
