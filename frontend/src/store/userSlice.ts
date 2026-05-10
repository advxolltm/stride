import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'

type UserState = {
    userId: string | null
}

const initialState: UserState = {
    userId: null,
}

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUserId: (state, action: PayloadAction<string>) => {
            state.userId = action.payload
        },
        clearUserId: (state) => {
            state.userId = null
        },
    },
})

export const { setUserId, clearUserId } = userSlice.actions
export const selectUserId = (state: RootState) => state.user.userId

export default userSlice.reducer
