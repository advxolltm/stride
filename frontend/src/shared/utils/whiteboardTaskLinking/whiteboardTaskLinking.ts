import type { ExcalidrawRectangleElement, ExcalidrawTextElement, NonDeletedExcalidrawElement, Ordered } from "@excalidraw/excalidraw/element/types";
import type { Task } from "../../../store/features/tasks/task.types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type AABB = {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function getElementsAABB(elements: readonly Ordered<NonDeletedExcalidrawElement>[]): AABB {
    if (elements.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
        if (
            (el.type === "freedraw" || el.type === "line" || el.type === "arrow") &&
            "points" in el &&
            el.points.length > 0
        ) {
            // points are relative to el.x / el.y
            for (const [px, py] of el.points) {
                minX = Math.min(minX, el.x + px);
                minY = Math.min(minY, el.y + py);
                maxX = Math.max(maxX, el.x + px);
                maxY = Math.max(maxY, el.y + py);
            }
        } else {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + el.width);
            maxY = Math.max(maxY, el.y + el.height);
        }
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function isOnlyLinkedGroupSelected(
    elements: readonly Ordered<NonDeletedExcalidrawElement>[],
    selectedOuterGroupIds: readonly string[],
): boolean {
    // precondition (1) for whether a "task-region" is (solely) selected
    if (selectedOuterGroupIds.length !== 1) {
        return false;
    }

    const groupID = selectedOuterGroupIds[0];

    // precondition (2) for whether a "task-region" is (solely) selected
    if (!isTaskLinkGroupID(groupID)) {
        return false;
    }

    // precondition (3) for whether a "task-region" is (solely) selected
    // -> check whether any other element is selected that is NOT in the outer-group
    const elementsNotInGroup = elements.filter(e => !e.groupIds.includes(groupID));
    if (elementsNotInGroup.length > 0) {
        return false;
    }

    return true;
}

function getTaskRegionID(groupedElements: readonly Ordered<NonDeletedExcalidrawElement>[]): string | null {
    // task-regions may be nested, so this might return multiple task-regions
    const taskLinksInGroup = groupedElements
        .filter(e => Boolean(e.customData?.taskLinkId));

    // We find the correct task-region by its group-count:
    // 	The outmost task-region (which matches with the selectedOuterGroupIds behaviour) must also have the lowest group-count!
    // Why? Assume any task-region inside this task-region has a smaller group count, then the outer task-region cannot exist since the inner task-region must've inherited the groups of the outer task-region on creation.
    if (taskLinksInGroup.length > 0) {
        const minimumTaskRegion = taskLinksInGroup
            .reduce((prev, curr) => prev.groupIds.length < curr.groupIds.length ? prev : curr);
        return minimumTaskRegion.customData?.taskLinkId;
    }

    return null;
}

export function searchSelectedTaskRegionID(
    elements: readonly Ordered<NonDeletedExcalidrawElement>[],
    groupedElements: readonly Ordered<NonDeletedExcalidrawElement>[],
    selectedOuterGroupIds: readonly string[],
): string | null {
    if (isOnlyLinkedGroupSelected(elements, selectedOuterGroupIds)) {
        return getTaskRegionID(groupedElements);
    } else {
        return null;
    }
}

type TaskLinkElementsStyle = {
    padding: number;
    color: string;
}

function createTaskLinkText(
    aabb: AABB,
    groupIds: string[],
    taskId: string,
    title: string,
    style: TaskLinkElementsStyle
): ExcalidrawTextElement {
    return {
        id: crypto.randomUUID(),
        groupIds: groupIds,
        type: "text",
        x: aabb.x - style.padding,
        y: aabb.y - style.padding - 24, // sit above the rectangle
        width: title.length * 10, // TODO: somehow calculate this better, but this seems to be good enough for now
        height: 20,
        text: title,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 16,
        containerId: null,
        originalText: title,
        strokeColor: style.color,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: Math.floor(Math.random() * 2 ** 31),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        isDeleted: false,
        boundElements: null,
        locked: false,
        roundness: null,
        updated: Date.now(),
        index: null,
        frameId: null,
        link: null,
        lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
        autoResize: true,
        customData: {
            taskLinkId: taskId,
        }
    } as ExcalidrawTextElement;
}

function createTaskLinkRectangle(
    aabb: AABB,
    groupIds: string[],
    projectId: string,
    taskId: string,
    style: TaskLinkElementsStyle
): ExcalidrawRectangleElement {
    return {
        id: crypto.randomUUID(),
        groupIds: groupIds,
        type: "rectangle",
        x: aabb.x - style.padding,
        y: aabb.y - style.padding,
        width: aabb.width + style.padding * 2,
        height: aabb.height + style.padding * 2,

        strokeColor: style.color,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "dashed",
        roughness: 1,
        opacity: 100,

        angle: 0,
        seed: Math.floor(Math.random() * 2 ** 31),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),

        isDeleted: false,
        boundElements: null,
        locked: false,

        roundness: null,
        updated: Date.now(),
        index: null,
        frameId: null,
        link: null,
        customData: {
            taskLinkId: taskId
        }
    } as ExcalidrawRectangleElement;
}

function generateTaskLinkGroupID(): string {
    return `task-link-${crypto.randomUUID()}`;
}

function isTaskLinkGroupID(groupID: string): boolean {
    return groupID.startsWith("task-link-");
}

type LinkTaskGroup = {
    text: ExcalidrawTextElement,
    rect: ExcalidrawRectangleElement,
    groupID: string,
}

function applyLinkTaskGroup(
    excalidrawAPI: ExcalidrawImperativeAPI,
    linkTaskGroup: LinkTaskGroup,
	selectedElements: readonly Ordered<NonDeletedExcalidrawElement>[],
): void {
    const existingElements =
        excalidrawAPI.getSceneElements() ?? [];

    const selectedIds = new Set(selectedElements.map(e => e.id));
    const existingElementsWithGroup = existingElements.map(el => {
        if (selectedIds.has(el.id)) {
            return {
                ...el,
                groupIds: [...(el.groupIds ?? []), linkTaskGroup.groupID],
                version: el.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
                updated: Date.now(),
            };
        } else {
            return el;
        }
    });

    excalidrawAPI.updateScene({
        elements: [...existingElementsWithGroup, linkTaskGroup.rect, linkTaskGroup.text],
        appState: {
            selectedElementIds: {},
        }
    });
}

function getSelectedElements(
    excalidrawAPI: ExcalidrawImperativeAPI
): readonly Ordered<NonDeletedExcalidrawElement>[] {
    const state = excalidrawAPI.getAppState();
    const elements = excalidrawAPI.getSceneElements();
    return elements.filter(el => state.selectedElementIds[el.id]);
}

function createLinkTaskGroupFromSelection(
    selectedElements: readonly Ordered<NonDeletedExcalidrawElement>[],
    linkTaskChoice: Task
): LinkTaskGroup {
    function getRandomColor() {
        return `#${Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, "0")}`;
    }

    const aabb = getElementsAABB(selectedElements);

    const everythingGroupID = crypto.randomUUID();
    const titleAndRectangleGroupID = generateTaskLinkGroupID();
    const taskLinkGroups = [everythingGroupID, titleAndRectangleGroupID];

    const taskLinkStyle = {
        padding: 20,
        color: getRandomColor()
    } as TaskLinkElementsStyle;

    const text = createTaskLinkText(aabb, taskLinkGroups, linkTaskChoice.id, linkTaskChoice.title, taskLinkStyle)
    const rect = createTaskLinkRectangle(aabb, taskLinkGroups, linkTaskChoice.projectId, linkTaskChoice.id, taskLinkStyle);

    return {
        text,
        rect,
        groupID: everythingGroupID
    };
}

export function createAndApplyNewLinkTaskGroup(excalidrawAPI: ExcalidrawImperativeAPI, task: Task) {
	const selectedElements = getSelectedElements(excalidrawAPI);
	const group = createLinkTaskGroupFromSelection(selectedElements, task);
	applyLinkTaskGroup(excalidrawAPI, group, selectedElements);
}
