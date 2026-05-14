// wsListener.ts
import { createAction, createListenerMiddleware } from "@reduxjs/toolkit";
import { WSMessageType, wsService } from "../websocket";
import { taskCreate, type Task } from "../taskSlice";
import { baseApi } from "../api/base.api";

export const wsListener = createListenerMiddleware();

// action you dispatch to start everything
export const wsConnect = createAction<string>("ws/connect");
export const wsDisconnect = createAction("ws/disconnect");


wsListener.startListening({
	actionCreator: wsDisconnect,
	effect: async () => {
		wsService.disconnect();
	}
});

wsListener.startListening({
    actionCreator: wsConnect,
    effect: async (action, listenerApi) => {
        const projectId = action.payload;
        wsService.connect(projectId);

        wsService.onMessage((msg) => {
            switch (msg.type) {
                case WSMessageType.ChatMessageCreate:
                case WSMessageType.ChatMessageUpdate:
                case WSMessageType.ChatMessageDelete:
					listenerApi.dispatch(baseApi.util.invalidateTags([{ type: 'Messages' }]));
                    break;
                case WSMessageType.TaskCreate:
					listenerApi.dispatch(taskCreate(msg.payload as Task));
                    break;
                case WSMessageType.TaskUpdate:
                    break;
                case WSMessageType.TaskDelete:
                    break;
                case WSMessageType.TaskMove:
                    break;
                case WSMessageType.TaskAssign:
                    break;
                case WSMessageType.TaskUnassign:
                    break;
                case WSMessageType.ProjectMemberAdd:
                    break;
                case WSMessageType.ProjectMemberRemove:
                    break;
                default:
					console.error("unexpected ws message", msg)
					break;
            }
        });
    },
});
