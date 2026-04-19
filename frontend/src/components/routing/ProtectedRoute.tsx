import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useGetSessionQuery } from '../../store/features/auth/auth.api'
import { RouteLoadingFallback } from './RouteLoadingFallback'

type ProtectedRouteProps = {
    children?: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const location = useLocation()

    const { data: user, isLoading, isError } = useGetSessionQuery()

    // Loading state
    if (isLoading) {
        return <RouteLoadingFallback />
    }

    // Not authenticated
    if (!user || isError) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    // Authenticated
    return children ? <>{children}</> : <Outlet />
}
