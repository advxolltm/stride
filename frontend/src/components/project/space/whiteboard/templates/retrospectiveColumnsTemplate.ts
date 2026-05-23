import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { WhiteboardTemplateDefinition } from './templateTypes'

const createNativeRetroColumn = ({
    x,
    title,
    strokeColor,
    backgroundColor,
    notes,
}: {
    x: number
    title: string
    strokeColor: string
    backgroundColor: string
    notes: readonly [string, string, string]
}): ExcalidrawElementSkeleton[] => {
    const noteWidth = 150
    const noteHeight = 64
    const notePositions = [
        { x: x + 26, y: 88 },
        { x: x + 202, y: 88 },
        { x: x + 26, y: 176 },
    ] as const

    return [
        {
            type: 'rectangle',
            x,
            y: 0,
            width: 380,
            height: 620,
            strokeColor,
            backgroundColor,
            strokeWidth: 2,
            fillStyle: 'solid',
            roughness: 1,
            label: {
                text: title,
                fontSize: 26,
                textAlign: 'center',
                verticalAlign: 'top',
            },
        },
        ...notes.map((note, index) => ({
            type: 'rectangle' as const,
            x: notePositions[index].x,
            y: notePositions[index].y,
            width: noteWidth,
            height: noteHeight,
            strokeColor: '#333333',
            backgroundColor: '#ffffff',
            strokeWidth: 2,
            fillStyle: 'solid' as const,
            roughness: 1,
            label: {
                text: note,
                fontSize: 14,
                textAlign: 'center' as const,
                verticalAlign: 'middle' as const,
            },
        })),
    ]
}

const retrospectiveColumnsElements: ExcalidrawElementSkeleton[] = [
    ...createNativeRetroColumn({
        x: 0,
        title: 'What Went Well',
        strokeColor: '#01579b',
        backgroundColor: '#e1f5fe',
        notes: [
            'Accomplished Sprint Goals',
            'Great Team Collaboration',
            'New Tooling Worked Effectively',
        ],
    }),
    ...createNativeRetroColumn({
        x: 440,
        title: 'What Did Not Go Well',
        strokeColor: '#b71c1c',
        backgroundColor: '#ffebee',
        notes: [
            'Environment Downtime',
            'Requirements Ambiguity',
            'Missed Daily Standups',
        ],
    }),
    ...createNativeRetroColumn({
        x: 880,
        title: 'Lessons Learned',
        strokeColor: '#1b5e20',
        backgroundColor: '#e8f5e9',
        notes: [
            'Improve Documentation Early',
            'Automate Regression Tests',
            'Refine Story Pointing',
        ],
    }),
]

export const retrospectiveColumnsTemplate: WhiteboardTemplateDefinition = {
    id: 'retrospective-columns',
    title: 'Retrospective Columns',
    description:
        'Three-column retro board with grouped sections for wins, issues, and lessons learned.',
    kind: 'excalidraw',
    elements: retrospectiveColumnsElements,
}
