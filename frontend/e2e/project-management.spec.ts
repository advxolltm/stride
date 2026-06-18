import { expect, test } from '@playwright/test'

function projectActionsButton(
    page: Parameters<typeof test>[0]['page'],
    projectTitle: string,
) {
    return page
        .locator('main')
        .getByRole('link', { name: new RegExp(projectTitle) })
        .locator('xpath=..')
        .getByRole('button', { name: 'Project actions' })
}

test('creates, edits, archives, and deletes a project while keeping sidebar sections in sync', async ({
    page,
}) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const initialProject = {
        title: `Stride Alpha ${suffix}`,
        description: `Initial project description ${suffix}`,
    }
    const updatedProject = {
        title: `Stride Beta ${suffix}`,
        description: `Updated project description ${suffix}`,
    }

    await page.goto('/')

    const sidebar = page.locator('aside')
    const activeProjectsSection = sidebar.locator(
        'section[aria-label="Active projects"]',
    )
    const archivedProjectsSection = sidebar.locator(
        'section[aria-label="Archived projects"]',
    )

    await sidebar.getByRole('button', { name: 'Create project' }).click()

    const createDialog = page.getByRole('dialog')

    await createDialog.getByLabel('Title').fill(initialProject.title)
    await createDialog
        .getByLabel('Description')
        .fill(initialProject.description)
    await createDialog
        .getByRole('button', { name: 'Create project' })
        .click()

    await expect(
        page.getByRole('heading', { name: initialProject.title }),
    ).toBeVisible()
    await expect(page.getByText(initialProject.description)).toBeVisible()
    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(initialProject.title),
        }),
    ).toBeVisible()
    await expect(
        archivedProjectsSection.getByRole('link', {
            name: new RegExp(initialProject.title),
        }),
    ).toHaveCount(0)

    await projectActionsButton(page, initialProject.title).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const editDialog = page.getByRole('dialog')

    await editDialog.getByLabel('Title').fill(updatedProject.title)
    await editDialog.getByLabel('Description').fill(updatedProject.description)
    await editDialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(
        page.getByRole('heading', { name: updatedProject.title }),
    ).toBeVisible()
    await expect(page.getByText(updatedProject.description)).toBeVisible()
    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toBeVisible()
    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(initialProject.title),
        }),
    ).toHaveCount(0)

    await projectActionsButton(page, updatedProject.title).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive Project' }).click()

    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toHaveCount(0)
    await expect(
        archivedProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toBeVisible()
    await expect(page.getByText('Project archived successfully')).toBeVisible()

    await projectActionsButton(page, updatedProject.title).click()
    await page.getByRole('menuitem', { name: 'Unarchive' }).click()
    await page.getByRole('button', { name: 'Unarchive Project' }).click()

    await expect(
        archivedProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toHaveCount(0)
    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toBeVisible()
    await expect(page.getByText('Project moved to active projects')).toBeVisible()

    await projectActionsButton(page, updatedProject.title).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete Project' }).click()

    await expect(page.getByText('Project deleted successfully')).toBeVisible()
    await expect(
        activeProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toHaveCount(0)
    await expect(
        archivedProjectsSection.getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toHaveCount(0)
    await expect(
        page.locator('main').getByRole('link', {
            name: new RegExp(updatedProject.title),
        }),
    ).toHaveCount(0)
    await expect(
        page.getByRole('heading', { name: updatedProject.title }),
    ).toHaveCount(0)
})
