import { useNavigate } from 'react-router'
import CounterPanel from '../components/CounterPanel'

function SecondPage() {
    const navigate = useNavigate()

    return (
        <main className="space-y-4 p-8">
            <CounterPanel />
            <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-md border px-3 py-2"
            >
                Back to home
            </button>
        </main>
    )
}

export default SecondPage
