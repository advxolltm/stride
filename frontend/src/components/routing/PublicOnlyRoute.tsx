import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '../../shared/hooks/redux'

type PublicOnlyRouteProps = {
    children?: ReactNode
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
    const { isAuthenticated, isInitialized } = useAppSelector(
        (state) => state.auth,
    )

    if (!isInitialized) {
        return null
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />
    }

    return children ? <>{children}</> : <Outlet />
}
