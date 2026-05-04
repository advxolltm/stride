import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from './api/base.api'
import chatReducer from './chatSlice'
import {
    themeListener,
    syncThemeWithDocument,
} from './middleware/themeListener'
import themeReducer from './themeSlice'
import taskReducer from './taskSlice'

export const store = configureStore({
    reducer: {
        [baseApi.reducerPath]: baseApi.reducer,
        chat: chatReducer,
        tasks: taskReducer,
        theme: themeReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware()
            .concat(themeListener.middleware)
            .concat(baseApi.middleware),
})

setupListeners(store.dispatch)
syncThemeWithDocument(store.getState().theme.isDark)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
