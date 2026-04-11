import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { AccountPage } from './pages/AccountPage'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/settings" element={<AccountPage />} />
                <Route path="/project/:projectId" element={<ProjectPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
