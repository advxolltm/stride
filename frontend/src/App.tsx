import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './routes/HomePage'
import { ProjectLayout } from './routes/project/ProjectLayout'
import { ProjectPage } from './routes/project/ProjectPage'
import { SettingsPage } from './routes/SettingsPage'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />

                <Route path="/settings" element={<SettingsPage />} />

                <Route path="/project/:projectId" element={<ProjectLayout />}>
                    <Route index element={<ProjectPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    )
}

export default App
