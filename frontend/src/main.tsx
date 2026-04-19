import { Toast } from '@heroui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider.tsx'
import './i18n'
import './index.css'
import { store } from './store/store'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <ThemeProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
                <Toast.Provider placement="bottom end" />
            </ThemeProvider>
        </Provider>
    </StrictMode>,
)