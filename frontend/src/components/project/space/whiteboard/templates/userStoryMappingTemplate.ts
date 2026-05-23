import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { WhiteboardTemplateDefinition } from './templateTypes'

const CARD_WIDTH = 200
const CARD_HEIGHT = 92
const CARD_GAP = 28
const MAP_START_X = 320

const sectionLabel = (
    text: string,
    y: number,
    color: string,
    size: number,
): ExcalidrawElementSkeleton => ({
    type: 'text',
    x: 72,
    y,
    text,
    fontSize: size,
    strokeColor: color,
})

const divider = (y: number): ExcalidrawElementSkeleton => ({
    type: 'line',
    x: MAP_START_X,
    y,
    points: [
        [0, 0],
        [1490, 0],
    ],
    strokeColor: '#b8b8b8',
    strokeWidth: 3,
    roughness: 0,
})

const userMarker = (
    x: number,
    y: number,
    label: string,
): ExcalidrawElementSkeleton[] => [
    {
        type: 'ellipse',
        x,
        y,
        width: 56,
        height: 56,
        strokeColor: '#8b5e34',
        backgroundColor: '#f5c08a',
        strokeWidth: 2,
        fillStyle: 'solid',
        roughness: 1,
    },
    {
        type: 'rectangle',
        x: x + 10,
        y: y + 44,
        width: 36,
        height: 20,
        strokeColor: '#3f3f46',
        backgroundColor: '#6b7280',
        strokeWidth: 2,
        fillStyle: 'solid',
        roughness: 1,
        roundness: {
            type: 3,
        },
    },
    {
        type: 'text',
        x: x - 8,
        y: y + 74,
        text: label,
        fontSize: 16,
        strokeColor: '#4b5563',
    },
]

const card = ({
    x,
    y,
    text,
    backgroundColor,
    strokeColor,
}: {
    x: number
    y: number
    text: string
    backgroundColor: string
    strokeColor: string
}): ExcalidrawElementSkeleton => ({
    type: 'rectangle',
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    strokeColor,
    backgroundColor,
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

const activityCards = [
    { x: MAP_START_X, text: 'Explore' },
    { x: MAP_START_X + 220, text: 'Plan' },
    { x: MAP_START_X + 700, text: 'Build' },
    { x: MAP_START_X + 1180, text: 'Review' },
].map(({ x, text }) =>
    card({
        x,
        y: 150,
        text,
        backgroundColor: '#ff9ea4',
        strokeColor: '#8f2430',
    }),
)

const backboneCards = [
    'Find needs',
    'Capture ideas',
    'Organize scope',
    'Prioritize',
    'Implement',
    'Validate',
    'Release',
].map((text, index) =>
    card({
        x: MAP_START_X + index * (CARD_WIDTH + CARD_GAP),
        y: 370,
        text,
        backgroundColor: '#7fd1d6',
        strokeColor: '#1f5d63',
    }),
)

const releaseSliceCards = [
    { x: MAP_START_X + 0 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'Interviews' },
    { x: MAP_START_X + 1 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'Problem notes' },
    { x: MAP_START_X + 2 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'Story draft' },
    { x: MAP_START_X + 3 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'MVP scope' },
    { x: MAP_START_X + 4 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'Task board' },
    { x: MAP_START_X + 5 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'QA checklist' },
    { x: MAP_START_X + 6 * (CARD_WIDTH + CARD_GAP), y: 590, text: 'Rollout plan' },
    { x: MAP_START_X + 0 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'User quotes' },
    { x: MAP_START_X + 1 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'Theme clusters' },
    { x: MAP_START_X + 2 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'Acceptance criteria' },
    { x: MAP_START_X + 3 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'Priorities' },
    { x: MAP_START_X + 5 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'Regression pass' },
    { x: MAP_START_X + 6 * (CARD_WIDTH + CARD_GAP), y: 706, text: 'Success metrics' },
    { x: MAP_START_X + 1 * (CARD_WIDTH + CARD_GAP), y: 822, text: 'Refinement notes' },
    { x: MAP_START_X + 5 * (CARD_WIDTH + CARD_GAP), y: 822, text: 'Release review' },
].map(({ x, y, text }) =>
    card({
        x,
        y,
        text,
        backgroundColor: '#ffd762',
        strokeColor: '#9b6a00',
    }),
)

const userStoryMappingElements: ExcalidrawElementSkeleton[] = [
    sectionLabel('Users', 58, '#111111', 46),
    sectionLabel('Activities', 190, '#b26063', 44),
    sectionLabel('Backbone', 430, '#2f6e75', 44),
    sectionLabel('Release\nSlice', 690, '#bf8d09', 44),
    ...userMarker(MAP_START_X + 32, 38, 'Researcher'),
    ...userMarker(MAP_START_X + 252, 38, 'Planner'),
    ...userMarker(MAP_START_X + 732, 38, 'Builder'),
    ...userMarker(MAP_START_X + 1212, 38, 'Reviewer'),
    ...activityCards,
    divider(332),
    ...backboneCards,
    divider(548),
    ...releaseSliceCards,
]

export const userStoryMappingTemplate: WhiteboardTemplateDefinition = {
    id: 'user-story-mapping',
    title: 'User Story Mapping',
    description:
        'Row-based story map with users, activities, backbone steps, and release slices.',
    kind: 'excalidraw',
    elements: userStoryMappingElements,
}
