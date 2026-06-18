import { expect, type Page, test } from '@playwright/test'
import {
    authFile,
    buildUniqueCredentials,
    createAuthenticatedPage,
    registerUser,
    type TestCredentials,
} from './helpers/auth'
import {
    addMembersFromProjectSpace,
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

async function addTaskInColumn(
    page: Page,
    columnIndex: 0 | 1 | 2,
    taskName: string,
) {
    await page.getByRole('button', { name: 'Add Task' }).nth(columnIndex).click()
    await page.getByLabel('Task name').fill(taskName)
    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText('Task created.').first()).toBeVisible()
}

/** Drag a task card to a column using pointer events (required for DnD Kit). */
async function dragTaskToColumn(
    page: Page,
    taskTitle: string,
    targetColumnLabel: string,
) {
    const card = page.getByText(taskTitle, { exact: true })
    const cardBox = await card.boundingBox()
    if (!cardBox) throw new Error(`Card "${taskTitle}" not found`)

    const heading = page.getByText(targetColumnLabel, { exact: true }).first()
    const headingBox = await heading.boundingBox()
    if (!headingBox) throw new Error(`Column "${targetColumnLabel}" not found`)

    const startX = cardBox.x + cardBox.width / 2
    const startY = cardBox.y + cardBox.height / 2
    const endX = headingBox.x + headingBox.width / 2
    const endY = headingBox.y + 80

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 15, startY, { steps: 5 })
    await page.mouse.move(endX, endY, { steps: 25 })
    await page.mouse.up()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

/**
 * Two-user WebSocket sync tests.
 *
 * The app opens a WebSocket at /ws/project/{id}/tasks and pushes task events
 * to all connected clients.  These tests verify that a second user sees the
 * changes made by the first user in real-time — without refreshing the page.
 */
test.describe.serial('Project Tasks – WebSocket Sync', () => {
    let projectId: string
    let member: TestCredentials
    let suffix: string

    test.beforeAll(async ({ browser, request }) => {
        suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        member = buildUniqueCredentials('ws-member')
        await registerUser(request, member)

        const context = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: authFile,
        })
        const setupPage = await context.newPage()

        await createProjectFromSidebar(setupPage, {
            title: `WS Tasks ${suffix}`,
            description: `WebSocket task test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(setupPage, `WS Tasks ${suffix}`)

        const match = setupPage.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        await addMembersFromProjectSpace(setupPage, [member.email])
        await context.close()
    })

    // -------------------------------------------------------------------------
    // Real-time task creation
    // -------------------------------------------------------------------------

    test('member sees a task created by owner without refreshing', async ({
        page,
        browser,
    }) => {
        const taskTitle = `WS New Task ${suffix}`

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            // Both users open the kanban board
            await memberPage.goto(`/project/${projectId}/tasks`)
            await expect(
                memberPage.getByText('To Do', { exact: true }),
            ).toBeVisible()

            // Owner creates a task
            await navigateToTasks(page, projectId)
            await addTaskInColumn(page, 0, taskTitle)

            // Member should see the new card appear via WebSocket — no refresh
            await expect(
                memberPage.getByText(taskTitle, { exact: true }),
            ).toBeVisible({ timeout: 10_000 })
        } finally {
            await context.close()
        }
    })

    // -------------------------------------------------------------------------
    // Real-time task move (drag-and-drop / status change)
    // -------------------------------------------------------------------------

    test('member sees a task moved to another column by owner without refreshing', async ({
        page,
        browser,
    }) => {
        const taskTitle = `WS Move Task ${suffix}`

        // Pre-create the task as owner so both users can see it
        await navigateToTasks(page, projectId)
        await addTaskInColumn(page, 0, taskTitle)

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            // Member opens the board and sees the task in "To Do"
            await memberPage.goto(`/project/${projectId}/tasks`)
            await expect(
                memberPage.getByText(taskTitle, { exact: true }),
            ).toBeVisible()

            // Owner drags the task to "In Progress"
            await dragTaskToColumn(page, taskTitle, 'In Progress')
            await expect(page.getByText('Task moved.').first()).toBeVisible()

            // Member's board should update without a refresh:
            // The task appears inside a container that also holds the "In Progress" heading.
            const inProgressColumn = memberPage
                .locator('div')
                .filter({ hasText: 'In Progress' })
                .filter({
                    has: memberPage.getByText(taskTitle, { exact: true }),
                })
                .first()
            await expect(inProgressColumn).toBeVisible({ timeout: 10_000 })
        } finally {
            await context.close()
        }
    })
})
