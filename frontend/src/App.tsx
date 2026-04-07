import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Navigate, Route, Routes } from 'react-router'
import HomePage from './routes/HomePage'
import { ProjectLayout } from './routes/project/ProjectLayout'
import { ProjectPage } from './routes/project/ProjectPage'
import SecondPage from './routes/SecondPage'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/second" element={<SecondPage />} />
            <Route path="/project/:projectId" element={<ProjectLayout />}>
                <Route index element={<ProjectPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
