import { useContext } from 'react'
import { TaskBoardContext } from './taskBoardContext.shared'

// Custom hook to consume TaskBoardContext safely
export function useTaskBoard() {
    const context = useContext(TaskBoardContext)

    // Ensure the hook is used within the corresponding provider
    // This prevents undefined access bugs and makes misuse obvious
    if (!context) {
        throw new Error('useTaskBoard must be used within TaskBoardProvider')
    }

    return context
}
