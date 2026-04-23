import { createContext } from 'react'
import type { TaskBoardContextValue } from './taskBoard.types'

export const TaskBoardContext = createContext<TaskBoardContextValue | null>(
    null,
)
