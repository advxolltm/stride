// taskSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";


export type Task = {
    id: string;
    project_id: string;
    created_by: string;
    title: string;
    description: string | null;
    status: string;
    start_date: string | null;
    due_date: string | null;
    expected_duration_hours: number | null;
    position: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

const taskSlice = createSlice({
    name: "tasks",
    initialState: [] as Task[],
    reducers: {
        taskCreate: (state, action: PayloadAction<Task>) => {
			state.push(action.payload);
        },
        taskAssigned: (state, action: PayloadAction<Task>) => {
            state.push(action.payload);
        },
    },
});

export const { taskAssigned, taskCreate } = taskSlice.actions;
export default taskSlice.reducer;
