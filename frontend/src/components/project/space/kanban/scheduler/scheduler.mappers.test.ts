import { describe, expect, it } from 'vitest'
import type { ProjectMember, SchedulerPreviewResponse } from '../../../../../store/features/project/project.types'
import type { Task } from '../../../../../store/features/tasks/task.types'
import type { StatusOption } from '../context/taskBoard.types'
import {
    buildSchedulerTriggerRequest,
    flattenSchedulerAssignments,
    mapProjectMemberToSchedulerMemberOption,
    mapTaskToSchedulerTaskOption,
} from './scheduler.mappers'

const statusOptions: StatusOption[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
]

const task: Task = {
    id: 'task-1',
    projectId: 'project-1',
    createdBy: 'member-1',
    title: 'Write tests',
    description: 'Add coverage for scheduler helpers',
    status: 'todo',
    startDate: null,
    dueDate: null,
    expectedDurationHours: 5,
    position: 0,
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
    completedAt: null,
    assignees: [],
    skills: [],
}

const member: ProjectMember = {
    id: 'member-1',
    userId: 'user-1',
    projectId: 'project-1',
    role: 'owner',
    joinedAt: '2026-06-17T00:00:00Z',
    workingHours: 20,
    user: {
        id: 'user-1',
        username: 'bedo',
        email: 'bedo@example.com',
        fullName: 'Bedo User',
        avatarUrl: 'https://example.com/original.png',
        avatarSmallUrl: 'https://example.com/small.png',
    },
}

describe('scheduler mappers', () => {
    it('maps tasks into scheduler options with status labels', () => {
        expect(mapTaskToSchedulerTaskOption(task, statusOptions)).toEqual({
            id: 'task-1',
            title: 'Write tests',
            status: 'todo',
            startDate: null,
            expectedDurationHours: 5,
            statusLabel: 'To Do',
        })
    })

    it('falls back to raw status when no matching label exists', () => {
        expect(mapTaskToSchedulerTaskOption(task, [])).toMatchObject({
            statusLabel: 'todo',
        })
    })

    it('maps project members into scheduler member options', () => {
        expect(mapProjectMemberToSchedulerMemberOption(member)).toEqual({
            id: 'user-1',
            name: 'Bedo User',
            initials: 'BU',
            avatarUrl: 'https://example.com/small.png',
            workingHours: 20,
        })
    })

    it('builds the scheduler trigger request payload', () => {
        expect(
            buildSchedulerTriggerRequest(
                [mapTaskToSchedulerTaskOption(task, statusOptions)],
                [mapProjectMemberToSchedulerMemberOption(member)],
            ),
        ).toEqual({
            task_ids: ['task-1'],
            user_ids: ['user-1'],
            settings: {
                optimization_goals: [
                    'max-hours-scheduled',
                    'distribute-evenly',
                ],
            },
        })
    })

    it('flattens new and changed scheduler assignments', () => {
        const response: SchedulerPreviewResponse = {
            newAssignments: [{ userId: 'user-1', taskId: 'task-1' }],
            changedAssignments: [{ userId: 'user-2', taskId: 'task-2' }],
        }

        expect(flattenSchedulerAssignments(response)).toEqual([
            { userId: 'user-1', taskId: 'task-1' },
            { userId: 'user-2', taskId: 'task-2' },
        ])
    })
})
