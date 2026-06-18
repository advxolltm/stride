import { expect, type Page } from '@playwright/test'

export async function createProjectFromSidebar(
    page: Page,
    project: { title: string; description: string },
) {
    const sidebar = page.locator('aside')

    await page.goto('/')
    await sidebar.getByRole('button', { name: 'Create project' }).click()

    const createDialog = page.getByRole('dialog')
    await createDialog.getByLabel('Title').fill(project.title)
    await createDialog.getByLabel('Description').fill(project.description)
    await createDialog.getByRole('button', { name: 'Create project' }).click()

    await expect(
        page.getByRole('heading', { name: project.title }),
    ).toBeVisible()
}

export async function openProjectFromActiveSidebar(page: Page, projectTitle: string) {
    const activeProjectsSection = page
        .locator('aside')
        .locator('section[aria-label="Active projects"]')

    await activeProjectsSection
        .getByRole('link', { name: new RegExp(projectTitle) })
        .click()

    await expect(page).toHaveURL(/\/project\//)
    await expect(
        page.getByRole('heading', { name: projectTitle }),
    ).toBeVisible()
}

export function getProjectSettingsDialog(page: Page) {
    return page.locator('section[role="dialog"]').first()
}

export async function openProjectSettings(page: Page) {
    await page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-settings') })
        .first()
        .click()

    await expect(getProjectSettingsDialog(page)).toBeVisible()
}

export async function openProjectSettingsTab(page: Page, tabName: string) {
    const dialog = getProjectSettingsDialog(page)
    await dialog.getByRole('button', { name: tabName, exact: true }).click()
}

export async function addMembersFromProjectSpace(
    page: Page,
    memberEmails: string[],
) {
    await page.getByRole('button', { name: 'Add members' }).click()

    const addMembersDialog = page.getByRole('dialog')
    for (const memberEmail of memberEmails) {
        await addMembersDialog
            .getByPlaceholder('Search by name or email...')
            .fill(memberEmail)
        await addMembersDialog
            .getByRole('option', { name: new RegExp(memberEmail) })
            .click()
    }

    await addMembersDialog
        .getByRole('button', { name: `Add (${memberEmails.length})` })
        .click()

    await expect(page.getByText('Members added successfully')).toBeVisible()
}
