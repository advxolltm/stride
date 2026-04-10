import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/layout'

export function AppLayout() {
    return (
        <div className="flex min-h-screen flex-col">
            <AppHeader />

            <main className="pt-14">
                <Outlet />
            </main>
        </div>
    )
}
