import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../shared/hooks/redux'

type ProtectedRouteProps = {
    children?: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const location = useLocation()
    const isAuthenticated = useAppSelector(
        (state) => state.auth.isAuthenticated,
    )

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return children ? <>{children}</> : <Outlet />
}
