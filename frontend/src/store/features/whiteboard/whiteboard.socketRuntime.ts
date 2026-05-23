type SocketEventHandlers = {
    close: () => void
    error: () => void
    message: (event: MessageEvent) => void
    open: () => void
}

type WatchManagedSocketArgs = {
    cacheDataLoaded: Promise<unknown>
    cacheEntryRemoved: Promise<void>
    createSocket: () => WebSocket
    createSocketEventHandlers: (socket: WebSocket) => SocketEventHandlers
    onFinally?: () => void
}

export const watchManagedSocket = async ({
    cacheDataLoaded,
    cacheEntryRemoved,
    createSocket,
    createSocketEventHandlers,
    onFinally,
}: WatchManagedSocketArgs) => {
    if (typeof WebSocket === 'undefined') {
        return
    }

    let socket: WebSocket | null = null
    let handlers: SocketEventHandlers | null = null

    try {
        await cacheDataLoaded

        socket = createSocket()
        handlers = createSocketEventHandlers(socket)

        socket.addEventListener('open', handlers.open)
        socket.addEventListener('message', handlers.message)
        socket.addEventListener('error', handlers.error)
        socket.addEventListener('close', handlers.close)

        await cacheEntryRemoved
    } catch {
        return
    } finally {
        onFinally?.()

        if (socket && handlers) {
            socket.removeEventListener('open', handlers.open)
            socket.removeEventListener('message', handlers.message)
            socket.removeEventListener('error', handlers.error)
            socket.removeEventListener('close', handlers.close)
        }

        if (
            socket &&
            (socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING)
        ) {
            socket.close()
        }
    }
}
