// wsListener.ts
import { createAction, createListenerMiddleware } from "@reduxjs/toolkit";
import { wsService } from "../websocket";
import { taskCreate, type Task } from "../taskSlice";

export const wsListener = createListenerMiddleware();

// action you dispatch to start everything
export const wsConnect = createAction<string>("ws/connect");
export const wsDisconnect = createAction("ws/disconnect");


export const WSMessageType = {
    ChatMessageCreate: 0,
    TaskCreate: 1,
    TaskUpdate: 2,
    TaskDelete: 3,
    TaskMove: 4,
    TaskAssign: 5,
    TaskUnassign: 6,
    ProjectMemberAdd: 7,
    ProjectMemberRemove: 8,
} as const;

wsListener.startListening({
	actionCreator: wsDisconnect,
	effect: async () => {
		wsService.disconnect();
	}
});

wsListener.startListening({
    actionCreator: wsConnect,
    effect: async (action, listenerApi) => {
        console.log("starting to listen");
        const projectId = action.payload;
        wsService.connect(projectId);

        wsService.onMessage((msg) => {
            console.log(`received a message: ${msg}`);
            switch (msg.type) {
                case WSMessageType.ChatMessageCreate:
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
