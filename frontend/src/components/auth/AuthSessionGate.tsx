import { useEffect, type ReactNode } from 'react'
import { useGetMeQuery } from '../../store/features/auth/auth.api'
import { resolveAuth } from '../../store/features/auth/auth.slice'
import { useAppDispatch, useAppSelector } from '../../shared/hooks/redux'

type AuthSessionGateProps = {
    children: ReactNode
}

export default function AuthSessionGate({ children }: AuthSessionGateProps) {
    const dispatch = useAppDispatch()
    const isInitialized = useAppSelector((state) => state.auth.isInitialized)
    const { isLoading, isSuccess, isError } = useGetMeQuery()

    useEffect(() => {
        if (isSuccess) {
            dispatch(resolveAuth(true))
            return
        }

        if (isError) {
            dispatch(resolveAuth(false))
        }
    }, [dispatch, isError, isSuccess])

    if (!isInitialized && isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted)]">
                Checking your session...
            </div>
        )
    }

    if (!isInitialized) {
        return null
    }

    return <>{children}</>
}
