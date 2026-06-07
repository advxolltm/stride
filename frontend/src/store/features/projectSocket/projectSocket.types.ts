import type {
    RealtimeSocketStatus,
    WSMessage,
} from '../realtime/realtime.types'

export type projectSocketStatus = RealtimeSocketStatus

export type projectSocketSocketState = {
    projectId: string
    url: string
    status: projectSocketStatus
    lastMessage: WSMessage<unknown> | null
    lastMessageAt: string | null
    lastError: string | null
}
