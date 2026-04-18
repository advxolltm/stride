import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { ApiErrorResponse } from './types'

export const isFetchBaseQueryError = (
    error: unknown,
): error is FetchBaseQueryError => {
    return typeof error === 'object' && error !== null && 'status' in error
}

export const isApiErrorResponse = (data: unknown): data is ApiErrorResponse => {
    return (
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error: unknown }).error === 'string'
    )
}

export const getApiErrorMessage = (
    error: FetchBaseQueryError | SerializedError | unknown,
    fallback = 'Something went wrong.',
): string => {
    if (isFetchBaseQueryError(error)) {
        if (isApiErrorResponse(error.data)) {
            return error.data.error
        }

        if ('error' in error && typeof error.error === 'string') {
            return error.error
        }
    }

    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    ) {
        return (error as { message: string }).message
    }

    return fallback
}
