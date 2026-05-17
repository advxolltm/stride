import { describe, expect, it } from 'vitest'

import { WSMessageType } from './projectSocket.types'

describe('WSMessageType', () => {
    it('uses unique numeric ids matching the backend iota order', () => {
        expect(WSMessageType).toEqual({
            ChatMessageCreate: 0,
            ChatMessageUpdate: 1,
            ChatMessageDelete: 2,
            TaskCreate: 3,
            TaskUpdate: 4,
            TaskDelete: 5,
            TaskMove: 6,
            TaskAssign: 7,
            TaskUnassign: 8,
            TaskSkillAdded: 9,
            TaskSkillRemoved: 10,
            ProjectMemberAdd: 11,
            ProjectMemberRemove: 12,
            ProjectSkillAdd: 13,
            ProjectSkillRemove: 14,
            WhiteboardElementCreate: 15,
            WhiteboardElementUpdate: 16,
            WhiteboardElementDelete: 17,
            WhiteboardElementLiveUpdate: 18,
            WhiteboardElementLiveClear: 19,
            WhiteboardElementRollback: 20,
        })

        const ids = Object.values(WSMessageType)

        expect(new Set(ids).size).toBe(ids.length)
    })
})
