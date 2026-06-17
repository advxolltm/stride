import { describe, expect, it } from 'vitest'
import type { Project } from '../../store/features/project/project.types'
import {
    TOTAL_WEEKLY_HOURS,
    buildWorkingHoursAllocations,
} from './workingHours.mappers'

const projects: Project[] = [
    {
        id: 'project-1',
        createdBy: 'user-1',
        name: 'Alpha Project',
        slug: 'alpha-project',
        description: 'First project',
        status: 'active',
        createdAt: '2026-06-17T00:00:00Z',
        updatedAt: '2026-06-17T00:00:00Z',
        joinLink: null,
        creator: {
            id: 'user-1',
            username: 'bedo',
            email: 'bedo@example.com',
            fullName: 'Bedo User',
            avatarUrl: null,
            avatarSmallUrl: null,
        },
        members: [
            {
                id: 'member-1',
                userId: 'user-1',
                projectId: 'project-1',
                role: 'owner',
                joinedAt: '2026-06-17T00:00:00Z',
                workingHours: 24,
                user: {
                    id: 'user-1',
                    username: 'bedo',
                    email: 'bedo@example.com',
                    fullName: 'Bedo User',
                    avatarUrl: null,
                    avatarSmallUrl: null,
                },
            },
        ],
        skills: [],
    },
    {
        id: 'project-2',
        createdBy: 'user-2',
        name: 'Beta Build',
        slug: 'beta-build',
        description: 'Second project',
        status: 'active',
        createdAt: '2026-06-17T00:00:00Z',
        updatedAt: '2026-06-17T00:00:00Z',
        joinLink: null,
        creator: {
            id: 'user-2',
            username: 'alice',
            email: 'alice@example.com',
            fullName: 'Alice Smith',
            avatarUrl: null,
            avatarSmallUrl: null,
        },
        members: [
            {
                id: 'member-2',
                userId: 'user-1',
                projectId: 'project-2',
                role: 'member',
                joinedAt: '2026-06-17T00:00:00Z',
                workingHours: 8,
                user: {
                    id: 'user-1',
                    username: 'bedo',
                    email: 'bedo@example.com',
                    fullName: 'Bedo User',
                    avatarUrl: null,
                    avatarSmallUrl: null,
                },
            },
        ],
        skills: [],
    },
    {
        id: 'project-3',
        createdBy: 'user-3',
        name: 'Gamma',
        slug: 'gamma',
        description: 'Third project',
        status: 'active',
        createdAt: '2026-06-17T00:00:00Z',
        updatedAt: '2026-06-17T00:00:00Z',
        joinLink: null,
        creator: {
            id: 'user-3',
            username: 'charlie',
            email: 'charlie@example.com',
            fullName: 'Charlie',
            avatarUrl: null,
            avatarSmallUrl: null,
        },
        members: [
            {
                id: 'member-3',
                userId: 'user-9',
                projectId: 'project-3',
                role: 'member',
                joinedAt: '2026-06-17T00:00:00Z',
                workingHours: 12,
                user: {
                    id: 'user-9',
                    username: 'zoe',
                    email: 'zoe@example.com',
                    fullName: 'Zoe',
                    avatarUrl: null,
                    avatarSmallUrl: null,
                },
            },
        ],
        skills: [],
    },
]

describe('working hours mappers', () => {
    it('exposes the total weekly hours constant', () => {
        expect(TOTAL_WEEKLY_HOURS).toBe(40)
    })

    it('builds allocations only for projects where the user is a member', () => {
        expect(buildWorkingHoursAllocations(projects, 'user-1')).toEqual([
            {
                id: 'project-1',
                name: 'Alpha Project',
                initials: 'AP',
                hours: 24,
                color: '#4f46e5',
            },
            {
                id: 'project-2',
                name: 'Beta Build',
                initials: 'BB',
                hours: 8,
                color: '#4338ca',
            },
        ])
    })
})
