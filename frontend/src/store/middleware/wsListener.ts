// wsListener.ts
import { createAction, createListenerMiddleware } from "@reduxjs/toolkit";
import { WSMessageType, wsService } from "../websocket";
import { taskCreate, type Task } from "../taskSlice";
import { baseApi } from "../api/base.api";
import { chatApi } from "../features/chat/chat.api";
import { messageDeleted } from "../chatSlice";

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
        console.log("starting to listen");
        const projectId = action.payload;
        wsService.connect(projectId);

        wsService.onMessage((msg) => {
            console.log(`received a message`, msg);
            switch (msg.type) {
                case WSMessageType.ChatMessageCreate:
                case WSMessageType.ChatMessageUpdate:
                case WSMessageType.ChatMessageDelete:
					listenerApi.dispatch(baseApi.util.invalidateTags([{ type: 'Messages' }]));
					// // @ts-ignore
					// const deletedMsgId = msg.payload.id;
					// console.warn("deleted: ", msg.payload);
					// listenerApi.dispatch(messageDeleted({ projectId: projectId, messageId: deletedMsgId }));
					// listenerApi.dispatch(chatApi.util.updateQueryData('getMessages', { projectId }, (draftMsgs) => {
					// 	console.warn("updating getMessages data", draftMsgs.pages);
					// 	for(const page of draftMsgs.pages) {
					// 		const mIdx = page.items.findIndex(m => m.id === deletedMsgId);
					// 		if(mIdx !== -1) {
					// 			page.items.splice(mIdx, 1);
					// 			console.warn("removed item");
					// 		}
					// 	}
					// }))
					// listenerApi.dispatch(
     //  					baseApi.util.invalidateTags([{ type: 'Messages', id: projectId }])
					// )
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
