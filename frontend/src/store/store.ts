import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from './api/base.api'
import {
    themeListener,
    syncThemeWithDocument,
} from './middleware/themeListener'
import themeReducer from './themeSlice'
import userReducer from './userSlice'

export const store = configureStore({
    reducer: {
        [baseApi.reducerPath]: baseApi.reducer,
        theme: themeReducer,
        user: userReducer,
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
