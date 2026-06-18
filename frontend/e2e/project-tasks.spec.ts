import { expect, type Page, test } from '@playwright/test'
import {
    authFile,
    buildUniqueCredentials,
    registerUser,
    type TestCredentials,
} from './helpers/auth'
import {
    addMembersFromProjectSpace,
    createProjectFromSidebar,
    getProjectSettingsDialog,
    openProjectFromActiveSidebar,
    openProjectSettings,
    openProjectSettingsTab,
} from './helpers/project'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToTasks(page: Page, projectId: string) {
    await page.goto(`/project/${projectId}/tasks`)
    await expect(page.getByText('To Do', { exact: true })).toBeVisible()
}

/**
 * Columns are rendered in a fixed order: index 0 = To Do, 1 = In Progress, 2 = Done.
 * Each column has its own "Add Task" button, selected by position.
 */
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

/** Click the task card to open the edit drawer and wait for it to appear. */
async function openTaskDrawer(page: Page, taskTitle: string) {
    // The kanban card is the first (and only) element showing the task title before
    // the drawer opens; .first() guards against strict-mode if it ever matches more.
    await page.getByText(taskTitle, { exact: true }).first().click()
    await expect(
        page.getByRole('heading', { name: 'Task Details' }),
    ).toBeVisible()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.serial('Project Tasks', () => {
    let projectId: string
    let member: TestCredentials
    let skillName: string
    /** Title of the task used for all edit tests. Updated after the rename test. */
    let editTaskTitle: string

    test.beforeAll(async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        skillName = `Skill ${suffix}`
        editTaskTitle = `Edit Me ${suffix}`

        member = buildUniqueCredentials('task-member')
        await registerUser(request, member)

        const context = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: authFile,
        })
        const setupPage = await context.newPage()

        // Create project
        await createProjectFromSidebar(setupPage, {
            title: `Tasks ${suffix}`,
            description: `Task test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(setupPage, `Tasks ${suffix}`)

        const match = setupPage.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        // Add member so the assignee field has someone to assign
        await addMembersFromProjectSpace(setupPage, [member.email])

        // Add a project skill so the skill field has something to select
        await openProjectSettings(setupPage)
        await openProjectSettingsTab(setupPage, 'Skills')
        const settingsDialog = getProjectSettingsDialog(setupPage)
        await settingsDialog.getByRole('button', { name: 'Add Skill' }).click()
        await settingsDialog.getByRole('tab', { name: 'Custom' }).click()
        await settingsDialog.getByLabel('Name').fill(skillName)
        await settingsDialog.getByRole('button', { name: 'Save skill' }).click()
        await expect(setupPage.getByText('Skill added successfully')).toBeVisible()
        await settingsDialog.getByRole('button', { name: 'Done' }).click()
        await setupPage.keyboard.press('Escape') // close settings dialog

        // Pre-create the task that all edit tests share
        await navigateToTasks(setupPage, projectId)
        await addTaskInColumn(setupPage, 0, editTaskTitle)

        await context.close()
    })

    // -------------------------------------------------------------------------
    // Creating tasks
    // -------------------------------------------------------------------------

    test('creates a task in each kanban column', async ({ page }) => {
        const suffix = Date.now()
        await navigateToTasks(page, projectId)

        await addTaskInColumn(page, 0, `Todo ${suffix}`)
        await addTaskInColumn(page, 1, `In Progress ${suffix}`)
        await addTaskInColumn(page, 2, `Done ${suffix}`)

        await expect(
            page.getByText(`Todo ${suffix}`, { exact: true }),
        ).toBeVisible()
        await expect(
            page.getByText(`In Progress ${suffix}`, { exact: true }),
        ).toBeVisible()
        await expect(
            page.getByText(`Done ${suffix}`, { exact: true }),
        ).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // Editing task fields (all operate on the shared editTaskTitle task)
    // -------------------------------------------------------------------------

    test('edits task title', async ({ page }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newTitle = `Renamed ${suffix}`

        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        await page.getByRole('button', { name: 'Edit Task name' }).click()
        // Use getByRole to avoid matching the Cancel/Save buttons whose aria-labels
        // also contain "Task name".
        const titleInput = page.getByRole('textbox', { name: 'Task name' })
        await titleInput.fill(newTitle)
        await page.getByRole('button', { name: 'Save Task name' }).click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
        // Title appears in both the card (background) and the drawer field — use first()
        await expect(page.getByText(newTitle, { exact: true }).first()).toBeVisible()

        // Carry the new title forward so subsequent tests can find the task
        editTaskTitle = newTitle
    })

    test('edits task description', async ({ page }) => {
        const description = `Desc for ${editTaskTitle}`
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        await page.getByRole('button', { name: 'Edit Description' }).click()
        await page.getByRole('textbox', { name: 'Description' }).fill(description)
        await page.getByRole('button', { name: 'Save Description' }).click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })

    test('edits estimated hours', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        await page
            .getByRole('button', { name: 'Edit Estimated Time (hours)' })
            .click()
        // Number inputs have role="spinbutton"; avoids matching Cancel/Save buttons
        const input = page.getByRole('spinbutton', { name: 'Estimated Time (hours)' })
        await input.fill('4')
        await input.press('Enter')

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })

    test('assigns a skill to a task', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        // Click the placeholder text to open the Skills autocomplete.
        // The HeroUI Autocomplete trigger is not a <button> — clicking the visible
        // placeholder span bubbles up to the trigger and opens the popover.
        await page.getByText('Add skills...', { exact: true }).click()
        await page.getByPlaceholder('Search skills...').fill(skillName)
        await page.getByRole('option', { name: skillName }).click()

        // With selectionMode="multiple" the popover stays open after selecting.
        // Confirm the skill is selected via aria-selected (the chip in the trigger
        // is below the viewport and would be reported as hidden by toBeVisible).
        await expect(
            page.getByRole('option', { name: skillName }),
        ).toHaveAttribute('aria-selected', 'true')
    })

    test('assigns a member to a task', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        // Click the placeholder span to open the Assignee autocomplete
        await page.getByText('No assignee', { exact: true }).click()
        await page.getByPlaceholder('Search users...').fill(member.username)
        await page
            .getByRole('option', { name: new RegExp(member.username) })
            .click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })

    test('sets a start date on a task', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        // HeroUI Popover wraps the date button in a div[role="button"] trigger AND
        // keeps the inner <button> — use locator('button') to target only the <button>.
        await page.locator('button').filter({ hasText: 'No start date' }).click()

        // Wait for the Calendar to open. react-aria's useCalendarBase sets
        // role="application" on the Calendar root (not "group").
        await expect(page.getByRole('application', { name: 'Start Date' })).toBeVisible()

        // react-aria adds data-today="true" to the button for today's date.
        // That button is inside the open popover (above the backdrop) so a plain
        // click works fine.
        await page.locator('[data-today="true"]').click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })

    test('sets a due date on a task', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        // Same HeroUI Popover double-element issue — target the inner <button>
        await page.locator('button').filter({ hasText: 'No due date' }).click()

        await expect(page.getByRole('application', { name: 'Due Date' })).toBeVisible()

        // today >= start date (which we also set to today), so clicking today is valid.
        await page.locator('[data-today="true"]').click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })

    test('changes task status via the drawer', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await openTaskDrawer(page, editTaskTitle)

        // filterDOMProps(props, { global: true }) in react-aria-components Select strips
        // aria-label (labelable props need { labelable: true } to pass through), so
        // [aria-label="Status"] never matches. data-* attributes always pass through.
        // There is only one Select in the drawer, so [data-slot="select-trigger"] is unique.
        await page.locator('[data-slot="select-trigger"]').click()
        await page.getByRole('option', { name: 'In Progress' }).click()

        await expect(page.getByText('Task updated.').first()).toBeVisible()
    })
})
