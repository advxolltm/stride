import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '../../shared/hooks/redux'

type PublicOnlyRouteProps = {
    children?: ReactNode
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
    const isAuthenticated = useAppSelector(
        (state) => state.auth.isAuthenticated,
    )

    if (isAuthenticated) {
        return <Navigate to="/" replace />
    }

    return children ? <>{children}</> : <Outlet />
}
