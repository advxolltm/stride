import { createAction, createListenerMiddleware } from '@reduxjs/toolkit'
import { wsService } from '../websocket'
import { WSMessageType } from './wsMessageTypes'
import { handleProjectWsMessage } from './wsProjectHandlers'
import { handleTaskWsMessage, type WsListenerApi } from './wsTaskHandlers'

export const wsListener = createListenerMiddleware()

export const wsConnect = createAction<string>('ws/connect')
export const wsDisconnect = createAction('ws/disconnect')

wsListener.startListening({
    actionCreator: wsDisconnect,
    effect: async () => {
        wsService.disconnect()
    },
})

wsListener.startListening({
    actionCreator: wsConnect,
    effect: async (action, listenerApi) => {
        const projectId = action.payload
        const api = listenerApi as unknown as WsListenerApi

        wsService.connect(projectId)

        wsService.onMessage((msg) => {
            // Task messages (create/update/delete/move/assign/unassign/skill)
            // are handled in wsTaskHandlers.ts with optimistic cache updates.
            if (handleTaskWsMessage(msg.type, msg.payload, projectId, api)) {
                return
            }

            // Project messages are patched in wsProjectHandlers.ts when the
            // payload has enough data, with invalidation kept as a fallback.
            if (handleProjectWsMessage(msg.type, msg.payload, projectId, api)) {
                return
            }

            switch (msg.type) {
                case WSMessageType.ChatMessageCreate:
                    break
                default:
                    console.error('unexpected ws message', msg)
                    break
            }
        })
    },
})
