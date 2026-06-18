import { useCallback, useEffect, useRef } from 'react'
import {
    sendWhiteboardCursor,
} from '../../../../../store/features/whiteboard/whiteboard.api'
import type { WhiteboardCursorClientMessage } from '../../../../../store/features/whiteboard/whiteboard.socket.types'

const emptyCursorMessage: WhiteboardCursorClientMessage = {
    cursor: { x: null, y: null },
}

const CURSOR_UPDATE_THROTTLE_MS = 50

type UseWhiteboardCursorSyncArgs = {
    projectId?: string
}

export const useWhiteboardCursorSync = ({
    projectId,
}: UseWhiteboardCursorSyncArgs) => {
    const cursorThrottleTimeoutRef = useRef<number | null>(null)
    const lastCursorFlushTimeRef = useRef<number>(0)
    const pendingCursorMessageRef =
        useRef<WhiteboardCursorClientMessage | null>(null)

    const flushPendingCursor = useCallback(() => {
        if (!projectId || !pendingCursorMessageRef.current) {
            return
        }

        sendWhiteboardCursor(projectId, pendingCursorMessageRef.current)
        pendingCursorMessageRef.current = null
    }, [projectId])

    const queueCursorUpdate = useCallback((message: WhiteboardCursorClientMessage) => {
        pendingCursorMessageRef.current = message

        if (cursorThrottleTimeoutRef.current !== null) {
            return
        }

        const elapsed = Date.now() - lastCursorFlushTimeRef.current
        const waitMs =
            elapsed >= CURSOR_UPDATE_THROTTLE_MS
                ? CURSOR_UPDATE_THROTTLE_MS
                : CURSOR_UPDATE_THROTTLE_MS - elapsed

        if (elapsed >= CURSOR_UPDATE_THROTTLE_MS) {
            flushPendingCursor()
            lastCursorFlushTimeRef.current = Date.now()
        }

        cursorThrottleTimeoutRef.current = window.setTimeout(() => {
            if (pendingCursorMessageRef.current) {
                flushPendingCursor()
            }
            lastCursorFlushTimeRef.current = Date.now()
            cursorThrottleTimeoutRef.current = null
        }, waitMs)
    }, [flushPendingCursor])

    const clearCursor = useCallback(() => {
        if (!projectId) {
            return
        }

        if (cursorThrottleTimeoutRef.current !== null) {
            window.clearTimeout(cursorThrottleTimeoutRef.current)
            cursorThrottleTimeoutRef.current = null
        }

        sendWhiteboardCursor(projectId, emptyCursorMessage)
        lastCursorFlushTimeRef.current = Date.now()
        pendingCursorMessageRef.current = null
    }, [projectId])

    useEffect(() => {
        return () => {
            if (cursorThrottleTimeoutRef.current !== null) {
                window.clearTimeout(cursorThrottleTimeoutRef.current)
                cursorThrottleTimeoutRef.current = null
            }

            if (!projectId) {
                return
            }

            sendWhiteboardCursor(projectId, emptyCursorMessage)
            lastCursorFlushTimeRef.current = Date.now()
            pendingCursorMessageRef.current = null
        }
    }, [projectId])

    return {
        clearCursor,
        queueCursorUpdate,
    }
}
