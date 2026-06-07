import { WSMessageType } from '../realtime/realtime.types'
import type { ApiWhiteboardElement } from './whiteboard.api.types'
import type {
    WhiteboardDeleteEventPayload,
    WhiteboardLiveClientMessage,
    WhiteboardLiveClearEventPayload,
    WhiteboardLiveUpdateEventPayload,
    WhiteboardSocketEventMessage,
} from './whiteboard.socket.types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isWhiteboardElementEventPayload = (
    value: unknown,
): value is ApiWhiteboardElement =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.whiteboardId === 'string' &&
    typeof value.elementType === 'string' &&
    typeof value.zIndex === 'number'

const isWhiteboardDeleteEventPayload = (
    value: unknown,
): value is WhiteboardDeleteEventPayload =>
    isRecord(value) && typeof value.elementId === 'string'

const isWhiteboardLiveUpdateEventPayload = (
    value: unknown,
): value is WhiteboardLiveUpdateEventPayload =>
    isRecord(value) &&
    typeof value.elementId === 'string' &&
    typeof value.elementType === 'string' &&
    typeof value.zIndex === 'number' &&
    isRecord(value.props) &&
    typeof value.props.id === 'string'

const isWhiteboardLiveClearEventPayload = (
    value: unknown,
): value is WhiteboardLiveClearEventPayload =>
    isRecord(value) && typeof value.elementId === 'string'

const isWhiteboardEventType = (value: unknown): value is number =>
    value === WSMessageType.WhiteboardElementCreate ||
    value === WSMessageType.WhiteboardElementUpdate ||
    value === WSMessageType.WhiteboardElementDelete ||
    value === WSMessageType.WhiteboardElementLiveUpdate ||
    value === WSMessageType.WhiteboardElementLiveClear

export const serializeWhiteboardLiveClientMessage = (
    message: WhiteboardLiveClientMessage,
) => JSON.stringify(message)

export const parseWhiteboardEventMessage = (
    rawMessage: string,
): WhiteboardSocketEventMessage | null => {
    try {
        const parsed = JSON.parse(rawMessage) as Partial<{
            type: number
            meta?: WhiteboardSocketEventMessage['meta']
            payload: unknown
        }>

        if (!isWhiteboardEventType(parsed.type)) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementDelete &&
            !isWhiteboardDeleteEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            (parsed.type === WSMessageType.WhiteboardElementCreate ||
                parsed.type === WSMessageType.WhiteboardElementUpdate) &&
            !isWhiteboardElementEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementLiveUpdate &&
            !isWhiteboardLiveUpdateEventPayload(parsed.payload)
        ) {
            return null
        }

        if (
            parsed.type === WSMessageType.WhiteboardElementLiveClear &&
            !isWhiteboardLiveClearEventPayload(parsed.payload)
        ) {
            return null
        }

        return parsed as WhiteboardSocketEventMessage
    } catch {
        return null
    }
}
