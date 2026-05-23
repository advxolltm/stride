import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { WhiteboardTemplateDefinition } from './templateTypes'

const note = ({
    x,
    y,
    text,
}: {
    x: number
    y: number
    text: string
}): ExcalidrawElementSkeleton => ({
    type: 'rectangle',
    x,
    y,
    width: 168,
    height: 128,
    strokeColor: '#475569',
    backgroundColor: '#ffffff',
    strokeWidth: 2,
    fillStyle: 'solid',
    roughness: 1,
    roundness: {
        type: 3,
    },
    label: {
        text,
        fontSize: 18,
        textAlign: 'center',
        verticalAlign: 'middle',
    },
})

const quadrant = ({
    x,
    y,
    title,
    backgroundColor,
    notes,
}: {
    x: number
    y: number
    title: string
    backgroundColor: string
    notes: Array<{ x: number; y: number; text: string }>
}): ExcalidrawElementSkeleton[] => [
    {
        type: 'rectangle',
        x,
        y,
        width: 620,
        height: 420,
        strokeColor: 'transparent',
        backgroundColor,
        strokeWidth: 0,
        fillStyle: 'solid',
        roughness: 0,
    },
    {
        type: 'text',
        x: x + 36,
        y: y + 34,
        text: title,
        fontSize: 28,
        strokeColor: '#273444',
    },
    ...notes.map((item) =>
        note({
            x: x + item.x,
            y: y + item.y,
            text: item.text,
        }),
    ),
]

const brainstormBoardElements: ExcalidrawElementSkeleton[] = [
    {
        type: 'text',
        x: 48,
        y: 34,
        text: 'TEAM BRAINSTORMING:',
        fontSize: 34,
        strokeColor: '#7177f7',
    },
    {
        type: 'text',
        x: 480,
        y: 34,
        text: 'Q3 2023',
        fontSize: 34,
        strokeColor: '#3f3f46',
    },
    ...quadrant({
        x: 0,
        y: 120,
        title: 'LEE',
        backgroundColor: '#ffc04f',
        notes: [
            { x: 54, y: 84, text: 'Optimizing Videos\nfor Social Media' },
            { x: 246, y: 196, text: 'Creating\nFacebook Ads' },
            { x: 422, y: 42, text: 'Posting The Best\nTime For Each\nTime Zone' },
        ],
    }),
    ...quadrant({
        x: 620,
        y: 120,
        title: 'ISABELLA',
        backgroundColor: '#6399e0',
        notes: [
            { x: 118, y: 180, text: 'Webinar Or\nVirtual Events\n2024' },
            { x: 370, y: 84, text: 'Website &\nLanding Page\nUpdate' },
        ],
    }),
    ...quadrant({
        x: 0,
        y: 540,
        title: 'KEISHA',
        backgroundColor: '#7770e8',
        notes: [
            { x: 116, y: 92, text: 'Create Content\nCalendar For\n2024' },
            { x: 352, y: 206, text: 'Optimizing Blog\nWriting Process' },
        ],
    }),
    ...quadrant({
        x: 620,
        y: 540,
        title: 'FRANK',
        backgroundColor: '#58c8cf',
        notes: [
            { x: 34, y: 106, text: 'Paid Search\n& Online\nAdvertising' },
            { x: 220, y: 28, text: 'Email Marketing' },
            { x: 404, y: 222, text: 'Testing &\nOptimization' },
        ],
    }),
]

export const brainstormBoardTemplate: WhiteboardTemplateDefinition = {
    id: 'brainstorm-board',
    title: 'Brainstorm Board',
    description:
        'Team brainstorming canvas with grouped idea areas and readable sticky notes.',
    kind: 'excalidraw',
    elements: brainstormBoardElements,
}
