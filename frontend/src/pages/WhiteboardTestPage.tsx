import { Card, CardContent } from '@heroui/react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useWatchProjectSocketsQuery } from '../store/features/projectSocket/projectSocket.api'
import {
    sendWhiteboardCursor,
    useWatchWhiteboardCursorQuery,
} from '../store/features/whiteboard/whiteboard.api'
import type { WhiteboardCursorClientMessage } from '../store/features/whiteboard/whiteboard.types'

const emptyCursorMessage: WhiteboardCursorClientMessage = {
    cursor: { x: null, y: null },
}

const WhiteboardTestPage = () => {
    const params = useParams()
    const frameRef = useRef<number | null>(null)
    const pendingMessageRef = useRef<WhiteboardCursorClientMessage | null>(null)

    const projectId = params.projectId
    const whiteBoardCursorWS = useWatchWhiteboardCursorQuery(
        projectId ? projectId : skipToken,
    )
    const notifications = useWatchProjectSocketsQuery(
        projectId ? projectId : skipToken,
    )

    const flushPendingCursor = () => {
        frameRef.current = null
        if (!projectId || !pendingMessageRef.current) {
            return
        }

        sendWhiteboardCursor(projectId, pendingMessageRef.current)
        pendingMessageRef.current = null
    }

    const queueCursorUpdate = (message: WhiteboardCursorClientMessage) => {
        pendingMessageRef.current = message

        if (frameRef.current !== null) {
            return
        }

        frameRef.current = window.requestAnimationFrame(flushPendingCursor)
    }

    const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (
        event,
    ) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        queueCursorUpdate({
            cursor: {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            },
        })
    }

    const handlePointerLeave = () => {
        if (!projectId) {
            return
        }

        queueCursorUpdate(emptyCursorMessage)
    }

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current)
            }

            if (projectId) {
                sendWhiteboardCursor(projectId, emptyCursorMessage)
            }
        }
    }, [projectId])

    const presence = whiteBoardCursorWS.data?.presence ?? []

    return (
        <div className="mt-10 flex w-full flex-col gap-10 px-20">
            <h1>Whiteboard Test Page</h1>
            <Card>
                <CardContent className="space-y-4">
                    <h2>Whiteboard Cursor WS</h2>
                    <div className="text-foreground/70 text-sm">
                        <p>
                            Status: {whiteBoardCursorWS.data?.status ?? 'idle'}
                        </p>
                        <p>Users: {presence.length}</p>
                    </div>
                    <div
                        className="border-foreground/10 relative h-80 overflow-hidden rounded-3xl border"
                        onPointerMove={handlePointerMove}
                        onPointerLeave={handlePointerLeave}
                    >
                        {presence.map((item) => {
                            if (
                                item.cursor.x === null ||
                                item.cursor.y === null
                            ) {
                                return null
                            }

                            return (
                                <div
                                    key={item.user.id}
                                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${item.cursor.x}px`,
                                        top: `${item.cursor.y}px`,
                                    }}
                                >
                                    <div className="mt-2 rounded-full bg-black/70 px-3 py-1">
                                        {item.user.name}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="space-y-2 text-sm">
                        {presence.length === 0 ? (
                            <p className="text-foreground/60">
                                Nobody on whiteboard.
                            </p>
                        ) : (
                            presence.map((item) => (
                                <div key={item.user.id}>
                                    {item.user.name}: {item.cursor.x ?? '-'} /{' '}
                                    {item.cursor.y ?? '-'}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <h2>Project WS</h2>
                    <pre>{JSON.stringify(notifications.data, null, 2)}</pre>
                </CardContent>
            </Card>
        </div>
    )
}
export default WhiteboardTestPage
