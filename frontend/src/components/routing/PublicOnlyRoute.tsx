import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useGetSessionQuery } from '../../store/features/auth/auth.api'
import { RouteLoadingFallback } from './RouteLoadingFallback'

type PublicOnlyRouteProps = {
    children?: ReactNode
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
    const { data: user, isLoading, isError } = useGetSessionQuery()

    // show spinner instead of white screen
    if (isLoading) {
        return <RouteLoadingFallback />
    }

    // already logged in - redirect
    if (user && !isError) {
        return <Navigate to="/" replace />
    }

    return children ? <>{children}</> : <Outlet />
}
