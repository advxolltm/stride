import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { ApiErrorResponse } from './types'
import { ApiErrorResponseSchema } from './types'

export const isFetchBaseQueryError = (
    error: unknown,
): error is FetchBaseQueryError => {
    return typeof error === 'object' && error !== null && 'status' in error
}

export const isApiErrorResponse = (data: unknown): data is ApiErrorResponse => {
    return ApiErrorResponseSchema.safeParse(data).success
}

export const getApiErrorMessage = (
    error: FetchBaseQueryError | SerializedError | unknown,
    fallback = 'Something went wrong.',
): string => {
    if (isFetchBaseQueryError(error)) {
        if (isApiErrorResponse(error.data)) {
            return error.data.error
        }

        if (typeof error.status === 'number') {
            if ([502, 503, 504].includes(error.status)) {
                return 'The server is temporarily unavailable. Please try again in a moment.'
            }

            return fallback
        }

        if (
            error.status === 'PARSING_ERROR' ||
            error.status === 'FETCH_ERROR' ||
            error.status === 'TIMEOUT_ERROR'
        ) {
            return fallback
        }

        if ('error' in error && typeof error.error === 'string') {
            return fallback
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
