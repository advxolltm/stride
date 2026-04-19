import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider.tsx'
import './i18n'
import './index.css'
import { hydrateAuth } from './store/features/auth/auth.slice'
import { loadAuthState } from './store/features/auth/auth.storage'
import { store } from './store/store'

store.dispatch(hydrateAuth(loadAuthState()))

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <ThemeProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ThemeProvider>
        </Provider>
    </StrictMode>,
)
