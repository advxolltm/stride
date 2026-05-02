import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { chatApi } from "./features/chat/chat.api";

interface ChatState {
    messages: string[];
}

const initialState: ChatState = {
    messages: [],
};

const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        messageDeleted: (state, action: PayloadAction<{ projectId: string; messageId: string }>) => {
			console.log(action);
            chatApi.util.updateQueryData('getMessages', { projectId: action.payload.projectId }, (draftMsgs) => {
                console.warn("updating getMessages data", draftMsgs.pages);
                for (const page of draftMsgs.pages) {
                    const mIdx = page.items.findIndex(m => m.id === action.payload.messageId);
                    if (mIdx !== -1) {
                        page.items.splice(mIdx, 1);
                        console.warn("removed item");
                    }
                }
            })
        },
        messageReceived: (state, action: PayloadAction<string>) => {
            const msg = action.payload;

            state.messages.push(msg);
        },
    },
});

export const { messageReceived, messageDeleted } = chatSlice.actions;
export default chatSlice.reducer;
