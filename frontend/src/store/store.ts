import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from './api/base.api'
import chatReducer from "./chatSlice";
import taskReducer from "./taskSlice";
import { wsListener } from './middleware/wsListener';

export const store = configureStore({
    reducer: {
        [baseApi.reducerPath]: baseApi.reducer,
		chat: chatReducer,
		tasks: taskReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware()
		.concat(baseApi.middleware)
		.concat(wsListener.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
