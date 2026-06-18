import { describe, expect, it } from 'vitest'

import { WSMessageType } from './realtime.types'

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
            ProjectUpdate: 15,
            ProjectDelete: 16,
            WhiteboardElementCreate: 17,
            WhiteboardElementUpdate: 18,
            WhiteboardElementDelete: 19,
            WhiteboardElementLiveUpdate: 20,
            WhiteboardElementLiveClear: 21,
            WhiteboardElementRollback: 22,
            WhiteboardElementSelectionUpdate: 23,
        })

        const ids = Object.values(WSMessageType)

        expect(new Set(ids).size).toBe(ids.length)
    })
})
