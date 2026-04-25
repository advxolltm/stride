import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

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
    messageReceived: (state, action: PayloadAction<string>) => {
      const msg = action.payload;

      state.messages.push(msg);
    },
  },
});

export const { messageReceived } = chatSlice.actions;
export default chatSlice.reducer;
