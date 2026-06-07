const reconnectBaseDelayMs = 250
const reconnectMaxDelayMs = 5_000
const reconnectJitterRatio = 0.2

type SocketEventHandlers = {
    close: () => void
    error: () => void
    message: (event: MessageEvent) => void
    open: () => void
}

type ManagedSocketRuntimeControls = {
    reportParseError: (message: string) => void
}

type ManagedSocketOpenEvent = {
    isReconnect: boolean
    socket: WebSocket
}

type WatchManagedSocketArgs = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    createSocket: () => WebSocket
    createSocketEventHandlers: (
        socket: WebSocket,
        controls: ManagedSocketRuntimeControls,
    ) => SocketEventHandlers
    onFinally?: () => void
    onOpen?: (event: ManagedSocketOpenEvent) => void
    onParseError?: (message: string) => void
    onReconnect?: (event: ManagedSocketOpenEvent) => void
}

type ActiveSocket = {
    close: () => void
}

const getReconnectDelay = (attempt: number) => {
    const cappedBackoff = Math.min(
        reconnectBaseDelayMs * 2 ** attempt,
        reconnectMaxDelayMs,
    )
    const jitter = cappedBackoff * reconnectJitterRatio * Math.random()
    return cappedBackoff + jitter
}

export const watchManagedSocket = async ({
    cacheDataLoaded,
    cacheEntryRemoved,
    createSocket,
    createSocketEventHandlers,
    onFinally,
    onOpen,
    onParseError,
    onReconnect,
}: WatchManagedSocketArgs) => {
    if (typeof WebSocket === 'undefined') {
        return
    }

    let activeSocket: ActiveSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let hasOpened = false
    let reconnectAttempt = 0

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return
        }

        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }

    const closeActiveSocket = () => {
        activeSocket?.close()
        activeSocket = null
    }

    const scheduleReconnect = (connect: () => void) => {
        if (stopped || reconnectTimer) {
            return
        }

        const delay = getReconnectDelay(reconnectAttempt)
        reconnectAttempt += 1
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            connect()
        }, delay)
    }

    try {
        await cacheDataLoaded

        const connect = () => {
            if (stopped) {
                return
            }

            closeActiveSocket()

            const socket = createSocket()
            const handlers = createSocketEventHandlers(socket, {
                reportParseError: (message) => {
                    onParseError?.(message)
                },
            })

            const wrappedHandlers: SocketEventHandlers = {
                open: () => {
                    const isReconnect = hasOpened
                    hasOpened = true
                    reconnectAttempt = 0
                    handlers.open()
                    const event = { isReconnect, socket }
                    onOpen?.(event)
                    if (isReconnect) {
                        onReconnect?.(event)
                    }
                },
                message: handlers.message,
                error: handlers.error,
                close: () => {
                    handlers.close()
                    if (!stopped) {
                        scheduleReconnect(connect)
                    }
                },
            }

            socket.addEventListener('open', wrappedHandlers.open)
            socket.addEventListener('message', wrappedHandlers.message)
            socket.addEventListener('error', wrappedHandlers.error)
            socket.addEventListener('close', wrappedHandlers.close)

            activeSocket = {
                close: () => {
                    socket.removeEventListener('open', wrappedHandlers.open)
                    socket.removeEventListener(
                        'message',
                        wrappedHandlers.message,
                    )
                    socket.removeEventListener('error', wrappedHandlers.error)
                    socket.removeEventListener('close', wrappedHandlers.close)

                    if (
                        socket.readyState === WebSocket.OPEN ||
                        socket.readyState === WebSocket.CONNECTING
                    ) {
                        socket.close()
                    }
                },
            }
        }

        connect()
        await cacheEntryRemoved
    } catch {
        return
    } finally {
        stopped = true
        clearReconnectTimer()
        closeActiveSocket()
        onFinally?.()
    }
}
