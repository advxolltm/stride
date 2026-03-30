import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './routes/HomePage'
import SecondPage from './routes/SecondPage'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/second" element={<SecondPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
