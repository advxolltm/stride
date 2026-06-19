import { expect, type Page, test } from '@playwright/test'
import { authFile, e2eBaseUrl } from './helpers/auth'
import {
    createProjectFromSidebar,
    openProjectFromActiveSidebar,
} from './helpers/project'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToTasks(page: Page, projectId: string) {
    await page.goto(`/project/${projectId}/tasks`)
    await expect(page.getByText('To Do', { exact: true })).toBeVisible()
}

/**
 * Drag a task card to the target column using mouse pointer events.
 *
 * DnD Kit uses PointerSensor (not HTML5 drag). An intermediate move of >5px
 * is required to pass the activationConstraint before the card follows the
 * pointer to the drop target.
 *
 * @param targetColumnLabel - visible heading of the destination column
 *   e.g. "In Progress"
 */
async function dragTaskToColumn(
    page: Page,
    taskTitle: string,
    targetColumnLabel: string,
) {
    // Source: the task card — grab its centre
    const card = page.getByText(taskTitle, { exact: true })
    const cardBox = await card.boundingBox()
    if (!cardBox) throw new Error(`Card for "${taskTitle}" not found`)

    // Target: find the column heading then drop 80px below it (into the body)
    const heading = page
        .getByText(targetColumnLabel, { exact: true })
        .first()
    const headingBox = await heading.boundingBox()
    if (!headingBox) throw new Error(`Column "${targetColumnLabel}" not found`)

    const startX = cardBox.x + cardBox.width / 2
    const startY = cardBox.y + cardBox.height / 2
    const endX = headingBox.x + headingBox.width / 2
    const endY = headingBox.y + 80 // below the heading, into the droppable body

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Exceed the 5px activation constraint first
    await page.mouse.move(startX + 15, startY, { steps: 5 })
    // Then glide to the drop target in small steps so DnD Kit tracks the over-events
    await page.mouse.move(endX, endY, { steps: 25 })
    await page.mouse.up()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.serial('Project Tasks – Drag & Drop', () => {
    let projectId: string
    let todoTask: string
    let inProgressTask: string

    test.beforeAll(async ({ browser }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        todoTask = `Drag me ${suffix}`
        inProgressTask = `Already moving ${suffix}`

        const context = await browser.newContext({
            baseURL: e2eBaseUrl,
            storageState: authFile,
        })
        const setupPage = await context.newPage()

        await createProjectFromSidebar(setupPage, {
            title: `Drag ${suffix}`,
            description: `Drag-and-drop test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(setupPage, `Drag ${suffix}`)

        const match = setupPage.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        // Create the tasks that will be dragged
        await setupPage.goto(`/project/${projectId}/tasks`)
        await expect(setupPage.getByText('To Do', { exact: true })).toBeVisible()

        // todoTask starts in "To Do"
        await setupPage.getByRole('button', { name: 'Add Task' }).nth(0).click()
        await setupPage.getByLabel('Task name').fill(todoTask)
        await setupPage.getByRole('button', { name: 'Create Task' }).click()
        await expect(setupPage.getByText('Task created.')).toBeVisible()

        // inProgressTask starts in "In Progress" (for the second drag test)
        await setupPage.getByRole('button', { name: 'Add Task' }).nth(1).click()
        await setupPage.getByLabel('Task name').fill(inProgressTask)
        await setupPage.getByRole('button', { name: 'Create Task' }).click()
        await expect(setupPage.getByText('Task created.')).toBeVisible()

        await context.close()
    })

    test('drags a task from "To Do" to "In Progress"', async ({ page }) => {
        await navigateToTasks(page, projectId)

        await dragTaskToColumn(page, todoTask, 'In Progress')

        await expect(page.getByText('Task moved.').first()).toBeVisible()

        // Confirm the card now lives in the "In Progress" column
        // by checking that its text is inside a container that also contains
        // the "In Progress" heading.
        const inProgressColumn = page
            .locator('div')
            .filter({ hasText: 'In Progress' })
            .filter({ has: page.getByText(todoTask, { exact: true }) })
            .first()
        await expect(inProgressColumn).toBeVisible()
    })

    test('drags a task from "In Progress" to "Done"', async ({ page }) => {
        await navigateToTasks(page, projectId)

        await dragTaskToColumn(page, inProgressTask, 'Done')

        await expect(page.getByText('Task moved.').first()).toBeVisible()

        const doneColumn = page
            .locator('div')
            .filter({ hasText: 'Done' })
            .filter({ has: page.getByText(inProgressTask, { exact: true }) })
            .first()
        await expect(doneColumn).toBeVisible()
    })
})
