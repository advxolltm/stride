import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import common_en from './locales/en/common.json'
import project_en from './locales/en/project.json'
import setting_en from './locales/en/setting.json'
import space_en from './locales/en/space.json'
import chat_en from './locales/en/chat.json'

import common_de from './locales/de/common.json'
import project_de from './locales/de/project.json'
import setting_de from './locales/de/setting.json'
import space_de from './locales/de/space.json'
import chat_de from './locales/de/chat.json'

import common_it from './locales/it/common.json'
import project_it from './locales/it/project.json'
import setting_it from './locales/it/setting.json'
import space_it from './locales/it/space.json'
import chat_it from './locales/it/chat.json'

const savedLang = localStorage.getItem('lang') || 'en'

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                common: common_en,
                project: project_en,
                setting: setting_en,
                space: space_en,
				chat: chat_en,
            },
            de: {
                common: common_de,
                project: project_de,
                setting: setting_de,
                space: space_de,
				chat: chat_de,
            },
			it: {
                common: common_it,
                project: project_it,
                setting: setting_it,
                space: space_it,
				chat: chat_it,
			},
        },
        lng: savedLang,
        fallbackLng: 'en',
        ns: ['common', 'project', 'setting', 'space', 'chat'],
        defaultNS: 'common',
        interpolation: {
            escapeValue: false,
        },
    })

export default i18n
