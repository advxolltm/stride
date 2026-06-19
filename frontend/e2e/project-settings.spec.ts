import { expect, test } from '@playwright/test'
import { buildUniqueCredentials, registerUser } from './helpers/auth'
import {
    addMembersFromProjectSpace,
    createProjectFromSidebar,
    getProjectSettingsDialog,
    openProjectFromActiveSidebar,
    openProjectSettings,
    openProjectSettingsTab,
} from './helpers/project'

test.describe('Project Settings', () => {
    test('edits project details and archive state from the general tab', async ({
        page,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const project = {
            title: `Settings Alpha ${suffix}`,
            description: `Project settings description ${suffix}`,
        }
        const updatedProject = {
            title: `Settings Beta ${suffix}`,
            description: `Updated settings description ${suffix}`,
        }

        await createProjectFromSidebar(page, project)
        await openProjectFromActiveSidebar(page, project.title)
        await openProjectSettings(page)
        await openProjectSettingsTab(page, 'General')

        const settingsDialog = getProjectSettingsDialog(page)

        await settingsDialog.getByRole('button', { name: 'Edit' }).click()
        await settingsDialog.getByLabel('Name').fill(updatedProject.title)
        await settingsDialog
            .getByLabel('Description')
            .fill(updatedProject.description)
        await settingsDialog.getByRole('button', { name: 'Save changes' }).click()

        await expect(page.getByText('Project updated successfully')).toBeVisible()
        await expect(
            page.getByRole('heading', { name: updatedProject.title }),
        ).toBeVisible()
        await expect(page.getByText(updatedProject.description)).toBeVisible()
        await expect(
            page.locator('aside').getByRole('link', {
                name: new RegExp(updatedProject.title),
            }),
        ).toBeVisible()

        await settingsDialog.getByRole('button', { name: 'Archive' }).click()
        await page.getByRole('button', { name: 'Archive Project' }).click()

        await expect(page.getByText('Project archived successfully')).toBeVisible()
        await expect(
            page
                .locator('aside')
                .locator('section[aria-label="Archived projects"]')
                .getByRole('link', { name: new RegExp(updatedProject.title) }),
        ).toBeVisible()

        await openProjectSettingsTab(page, 'General')
        await settingsDialog.getByRole('button', { name: 'Unarchive' }).click()
        await page.getByRole('button', { name: 'Unarchive Project' }).click()

        await expect(
            page.getByText('Project moved to active projects'),
        ).toBeVisible()
        await expect(
            page
                .locator('aside')
                .locator('section[aria-label="Active projects"]')
                .getByRole('link', { name: new RegExp(updatedProject.title) }),
        ).toBeVisible()
    })

    test('shows added members in the team tab and lets the owner remove them', async ({
        page,
        request,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const project = {
            title: `Team Alpha ${suffix}`,
            description: `Project team description ${suffix}`,
        }
        const member = buildUniqueCredentials('settings-member')

        await registerUser(request, member)
        await createProjectFromSidebar(page, project)
        await openProjectFromActiveSidebar(page, project.title)
        await addMembersFromProjectSpace(page, [member.email])

        await openProjectSettings(page)
        await openProjectSettingsTab(page, 'Team')

        const settingsDialog = getProjectSettingsDialog(page)

        await expect(
            settingsDialog.getByText(member.username, { exact: true }),
        ).toBeVisible()
        await expect(
            settingsDialog.getByText(member.email, { exact: true }),
        ).toBeVisible()

        const memberRow = settingsDialog
            .getByText(member.email, { exact: true })
            .locator('xpath=ancestor::div[contains(@class, "group")][1]')

        await memberRow.hover()
        await memberRow.getByRole('button').click()
        await page.getByRole('button', { name: 'Remove' }).click()

        await expect(
            page.getByText('Member removed successfully'),
        ).toBeVisible()
        await expect(
            settingsDialog.getByText(member.email, { exact: true }),
        ).toHaveCount(0)
    })

    test('adds custom and template skills from the skills tab', async ({
        page,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const project = {
            title: `Skills Alpha ${suffix}`,
            description: `Skills settings description ${suffix}`,
        }
        const customSkill = {
            name: `Custom Skill ${suffix}`,
            description: `Custom skill description ${suffix}`,
        }

        await createProjectFromSidebar(page, project)
        await openProjectFromActiveSidebar(page, project.title)
        await openProjectSettings(page)
        await openProjectSettingsTab(page, 'Skills')

        const settingsDialog = getProjectSettingsDialog(page)

        await settingsDialog.getByRole('button', { name: 'Add Skill' }).click()
        await settingsDialog.getByRole('tab', { name: 'Custom' }).click()
        await settingsDialog.getByLabel('Name').fill(customSkill.name)
        await settingsDialog
            .getByLabel('Description')
            .fill(customSkill.description)
        await settingsDialog.getByRole('button', { name: 'Save skill' }).click()

        await expect(page.getByText('Skill added successfully').first()).toBeVisible()
        await expect(
            settingsDialog.getByText(customSkill.name, { exact: true }),
        ).toBeVisible()
        await expect(settingsDialog.getByText(customSkill.description)).toBeVisible()

        await settingsDialog.getByRole('tab', { name: 'Templates' }).click()
        await settingsDialog.getByRole('button', { name: 'Engineering' }).click()
        await settingsDialog
            .getByPlaceholder('Search template skills...')
            .fill('React')
        await settingsDialog
            .getByRole('button', { name: 'Add', exact: true })
            .first()
            .click()

        await expect(page.getByText('Skill added successfully').first()).toBeVisible()
        await settingsDialog.getByRole('button', { name: 'Done' }).click()
        await expect(
            settingsDialog.getByText('React', { exact: true }),
        ).toBeVisible()
    })

    test('updates personal project skills from the my skills tab', async ({
        page,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const project = {
            title: `Skills Alpha ${suffix}`,
            description: `My skills description ${suffix}`,
        }
        const customSkill = {
            name: `Custom Skill ${suffix}`,
            description: `Custom skill description ${suffix}`,
        }

        await createProjectFromSidebar(page, project)
        await openProjectFromActiveSidebar(page, project.title)
        await openProjectSettings(page)
        await openProjectSettingsTab(page, 'Skills')

        const settingsDialog = getProjectSettingsDialog(page)

        await settingsDialog.getByRole('button', { name: 'Add Skill' }).click()
        await settingsDialog.getByRole('tab', { name: 'Custom' }).click()
        await settingsDialog.getByLabel('Name').fill(customSkill.name)
        await settingsDialog
            .getByLabel('Description')
            .fill(customSkill.description)
        await settingsDialog.getByRole('button', { name: 'Save skill' }).click()
        await expect(page.getByText('Skill added successfully')).toBeVisible()
        await settingsDialog.getByRole('button', { name: 'Done' }).click()

        await openProjectSettingsTab(page, 'My Skills')
        await settingsDialog.getByRole('button', { name: 'Edit' }).click()
        await settingsDialog
            .getByRole('group')
            .filter({ hasText: 'Select skills' })
            .click()

        const selectedSkillsDialog = page.getByRole('dialog', {
            name: 'Selected skills',
        })
        const searchSkillsInput = selectedSkillsDialog.getByRole('searchbox', {
            name: 'Search skills',
        })

        await searchSkillsInput.fill(customSkill.name)
        await searchSkillsInput.press('ArrowDown')
        await searchSkillsInput.press('Enter')

        const saveMySkillsButton = settingsDialog.getByRole('button', {
            name: 'Save changes',
        })
        await expect(saveMySkillsButton).toBeEnabled()

        const dialogBounds = await settingsDialog.boundingBox()
        if (dialogBounds) {
            await page.mouse.click(dialogBounds.x + 24, dialogBounds.y + 24)
        }

        await saveMySkillsButton.click()

        await expect(
            page.getByText('Your project skills were updated'),
        ).toBeVisible()
        await expect(
            settingsDialog.getByText(customSkill.name, { exact: true }),
        ).toBeVisible()
    })

    test('updates weekly hours from the my working hours tab', async ({
        page,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const project = {
            title: `Hours Alpha ${suffix}`,
            description: `Working hours description ${suffix}`,
        }

        await createProjectFromSidebar(page, project)
        await openProjectFromActiveSidebar(page, project.title)
        await openProjectSettings(page)
        await openProjectSettingsTab(page, 'My Working Hours')

        const settingsDialog = getProjectSettingsDialog(page)

        await settingsDialog.getByRole('button', { name: 'Edit' }).click()
        await settingsDialog
            .getByLabel(`Weekly hours on ${project.title}`)
            .fill('12')
        await settingsDialog.getByRole('button', { name: 'Save changes' }).click()

        await expect(
            page.getByText('Working hours updated successfully'),
        ).toBeVisible({ timeout: 15000 })

        await openProjectSettingsTab(page, 'My Working Hours')
        await expect(
            settingsDialog.getByLabel(`Weekly hours on ${project.title}`),
        ).toHaveValue('12')
    })
})
