import type {
    WhiteboardLiveClientMessage,
    WhiteboardSocketEventMessage,
} from './whiteboard.socket.types'
import {
    WhiteboardSocketEventMessageSchema,
} from './whiteboard.socket.types'

export const serializeWhiteboardLiveClientMessage = (
    message: WhiteboardLiveClientMessage,
) => JSON.stringify(message)

export const parseWhiteboardEventMessage = (
    rawMessage: string,
): WhiteboardSocketEventMessage | null => {
    try {
        const parsed = WhiteboardSocketEventMessageSchema.safeParse(
            JSON.parse(rawMessage) as unknown,
        )
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}
