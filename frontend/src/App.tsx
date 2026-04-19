import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { AccountPage } from './pages/AccountPage'
import { TasksPage } from './pages/TasksPage'
import { WhiteboardPage } from './pages/WhiteboardPage'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<HomePage />} />
                <Route path="/settings" element={<AccountPage />} />
                <Route path="/project/:projectId">
                    <Route index element={<ProjectPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="whiteboard" element={<WhiteboardPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Route>

            <Route
                path="/login"
                element={
                    <PublicOnlyRoute>
                        <LoginPage />
                    </PublicOnlyRoute>
                }
            />
            <Route
                path="/register"
                element={
                    <PublicOnlyRoute>
                        <RegisterPage />
                    </PublicOnlyRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
