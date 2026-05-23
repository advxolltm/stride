import { useCallback, useEffect, useRef } from 'react'
import {
    sendWhiteboardCursor,
} from '../../../../../store/features/whiteboard/whiteboard.api'
import type { WhiteboardCursorClientMessage } from '../../../../../store/features/whiteboard/whiteboard.socket.types'

const emptyCursorMessage: WhiteboardCursorClientMessage = {
    cursor: { x: null, y: null },
}

type UseWhiteboardCursorSyncArgs = {
    projectId?: string
}

export const useWhiteboardCursorSync = ({
    projectId,
}: UseWhiteboardCursorSyncArgs) => {
    const cursorFrameRef = useRef<number | null>(null)
    const pendingCursorMessageRef =
        useRef<WhiteboardCursorClientMessage | null>(null)

    const flushPendingCursor = useCallback(() => {
        cursorFrameRef.current = null
        if (!projectId || !pendingCursorMessageRef.current) {
            return
        }

        sendWhiteboardCursor(projectId, pendingCursorMessageRef.current)
        pendingCursorMessageRef.current = null
    }, [projectId])

    const queueCursorUpdate = useCallback((message: WhiteboardCursorClientMessage) => {
        pendingCursorMessageRef.current = message

        if (cursorFrameRef.current !== null) {
            return
        }

        cursorFrameRef.current = window.requestAnimationFrame(
            flushPendingCursor,
        )
    }, [flushPendingCursor])

    const clearCursor = useCallback(() => {
        if (!projectId) {
            return
        }

        sendWhiteboardCursor(projectId, emptyCursorMessage)
        pendingCursorMessageRef.current = null
    }, [projectId])

    useEffect(() => {
        return () => {
            if (cursorFrameRef.current !== null) {
                window.cancelAnimationFrame(cursorFrameRef.current)
            }

            if (!projectId) {
                return
            }

            sendWhiteboardCursor(projectId, emptyCursorMessage)
            pendingCursorMessageRef.current = null
        }
    }, [projectId])

    return {
        clearCursor,
        queueCursorUpdate,
    }
}
