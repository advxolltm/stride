// wsListener.ts
import { createAction, createListenerMiddleware } from "@reduxjs/toolkit";
import { baseApi } from "../api/base.api";
import { wsService } from "../websocket";

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
    TaskSkillAdded: 7,
    TaskSkillRemoved: 8,
    ProjectMemberAdd: 9,
    ProjectMemberRemove: 10,
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
                case WSMessageType.TaskCreate:
                case WSMessageType.TaskUpdate:
                case WSMessageType.TaskDelete:
                case WSMessageType.TaskMove:
                case WSMessageType.TaskAssign:
                case WSMessageType.TaskUnassign:
                case WSMessageType.TaskSkillAdded:
                case WSMessageType.TaskSkillRemoved:
                    listenerApi.dispatch(
                        baseApi.util.invalidateTags([
                            { type: 'Task', id: projectId },
                        ]),
                    );
                    break;
                case WSMessageType.ChatMessageCreate:
                    break;
                case WSMessageType.ProjectMemberAdd:
                case WSMessageType.ProjectMemberRemove:
                    listenerApi.dispatch(
                        baseApi.util.invalidateTags([
                            { type: 'ProjectMember', id: projectId },
                            { type: 'Project', id: projectId },
                            { type: 'Project', id: 'LIST' },
                        ]),
                    );
                    break;
                default:
					console.error("unexpected ws message", msg)
					break;
            }
        });
    },
});
