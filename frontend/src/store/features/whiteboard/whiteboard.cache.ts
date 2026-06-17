import { WSMessageType } from '../realtime/realtime.types'
import type {
    ApiWhiteboardElement,
    WhiteboardElement,
} from './whiteboard.api.types'
import type {
    WhiteboardEventMessage,
    WhiteboardLiveEventMessage,
    WhiteboardLiveUpdateEventPayload,
    WhiteboardSocketEventMessage,
} from './whiteboard.socket.types'
import type { WhiteboardEventsSocketState } from './whiteboard.ui.types'

export const applyPersistedElementToCache = (
    draft: WhiteboardElement[],
    element: WhiteboardElement,
) => {
    const existingIndex = draft.findIndex((item) => item.id === element.id)

    if (existingIndex === -1) {
        draft.push(element as never)
        return
    }

    draft[existingIndex] = element as never
}

export const removePersistedElementFromCache = (
    draft: WhiteboardElement[],
    elementId: string,
) => draft.filter((element) => element.id !== elementId)

export const patchWhiteboardElementsCacheFromEvent = (
    draft: WhiteboardElement[],
    message: WhiteboardEventMessage,
    transformWhiteboardElement: (
        element: ApiWhiteboardElement,
    ) => WhiteboardElement,
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementCreate:
        case WSMessageType.WhiteboardElementUpdate: {
            const element = transformWhiteboardElement(message.payload)
            applyPersistedElementToCache(draft, element)
            return
        }
        case WSMessageType.WhiteboardElementDelete:
            return removePersistedElementFromCache(
                draft,
                message.payload.elementId,
            )
        default:
            return
    }
}

export const isPersistedWhiteboardEventMessage = (
    message: WhiteboardSocketEventMessage,
): message is WhiteboardEventMessage =>
    message.type !== WSMessageType.WhiteboardElementLiveUpdate &&
    message.type !== WSMessageType.WhiteboardElementLiveClear &&
    message.type !== WSMessageType.WhiteboardElementSelectionUpdate

export const resolveLiveElementIDToClear = (
    message: WhiteboardEventMessage,
    persistedElements?: WhiteboardElement[],
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementCreate:
        case WSMessageType.WhiteboardElementUpdate:
            return message.payload.props.id
        case WSMessageType.WhiteboardElementDelete: {
            const persistedElement = persistedElements?.find(
                (element) => element.id === message.payload.elementId,
            )
            return persistedElement?.props.id ?? null
        }
        default:
            return null
    }
}

export const patchWhiteboardLiveOverlayFromEvent = (
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>,
    message: WhiteboardSocketEventMessage,
    persistedElements?: WhiteboardElement[],
) => {
    if (isPersistedWhiteboardEventMessage(message)) {
        const liveElementID = resolveLiveElementIDToClear(
            message,
            persistedElements,
        )
        if (liveElementID) {
            delete liveElementsById[liveElementID]
        }
        return
    }

    applyWhiteboardLiveEventToOverlay(liveElementsById, message)
}

export const patchWhiteboardRemoteSelectionsFromEvent = (
    remoteSelectionClientIdsByElementId: WhiteboardEventsSocketState['remoteSelectionClientIdsByElementId'],
    message: WhiteboardSocketEventMessage,
) => {
    if (message.type !== WSMessageType.WhiteboardElementSelectionUpdate) {
        return
    }

    const clientId = message.meta?.clientId
    if (!clientId) {
        return
    }

    Object.entries(remoteSelectionClientIdsByElementId).forEach(
        ([elementId, clientIds]) => {
            const remainingClientIds = clientIds.filter(
                (existingClientId) => existingClientId !== clientId,
            )
            if (remainingClientIds.length === 0) {
                delete remoteSelectionClientIdsByElementId[elementId]
                return
            }
            remoteSelectionClientIdsByElementId[elementId] =
                remainingClientIds
        },
    )

    message.payload.elementIds.forEach((elementId) => {
        const clientIds =
            remoteSelectionClientIdsByElementId[elementId] ?? []
        if (!clientIds.includes(clientId)) {
            remoteSelectionClientIdsByElementId[elementId] = [
                ...clientIds,
                clientId,
            ]
        }
    })
}

const applyWhiteboardLiveEventToOverlay = (
    liveElementsById: Record<string, WhiteboardLiveUpdateEventPayload>,
    message: WhiteboardLiveEventMessage,
) => {
    switch (message.type) {
        case WSMessageType.WhiteboardElementLiveUpdate:
            liveElementsById[message.payload.elementId] = message.payload
            return
        case WSMessageType.WhiteboardElementLiveClear:
            delete liveElementsById[message.payload.elementId]
            return
        case WSMessageType.WhiteboardElementSelectionUpdate:
            return
        default:
            return
    }
}
