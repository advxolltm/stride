import { describe, expect, it, vi } from 'vitest'
import { baseApi } from '../../api/base.api'
import {
    createProjectTasksSocketState,
    createProjectTasksSocketUrl,
    invalidateProjectTasks,
} from './task.socket'

describe('task socket', () => {
    it('uses the tasks websocket endpoint', () => {
        expect(createProjectTasksSocketUrl('project-1')).toBe(
            '/api/v1/ws/project/project-1/tasks',
        )
    })

    it('creates initial connecting state', () => {
        expect(createProjectTasksSocketState('project-1')).toMatchObject({
            projectId: 'project-1',
            url: '/api/v1/ws/project/project-1/tasks',
            status: 'connecting',
            lastMessage: null,
            lastMessageAt: null,
            lastError: null,
        })
    })

    it('invalidates project tasks for socket open and reconnect recovery', () => {
        const dispatch = vi.fn()
        const expectedAction = baseApi.util.invalidateTags([
            { type: 'Task', id: 'project-1' },
        ])

        invalidateProjectTasks({ dispatch }, 'project-1')

        expect(dispatch).toHaveBeenCalledWith(expectedAction)
    })
})
