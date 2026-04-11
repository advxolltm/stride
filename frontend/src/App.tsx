import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { AccountPage } from './pages/AccountPage'
import { TasksPage } from './pages/TasksPage'
import { WhiteboardPage } from './pages/WhiteboardPage'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
        </Routes>
    )
}

export default App
