import { afterEach, describe, expect, it, vi } from 'vitest'
import createProjectSlug from './createProjectSlug'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('createProjectSlug', () => {
    it('builds lowercase slug and appends timestamp suffix', () => {
        const now = 1700000000000

        vi.spyOn(Date, 'now').mockReturnValue(now)

        expect(createProjectSlug('My New Project')).toBe(
            `my-new-project-${now.toString(36)}`,
        )
    })

    it('trims whitespace and collapses special characters into one dash', () => {
        const now = 1700000000001

        vi.spyOn(Date, 'now').mockReturnValue(now)

        expect(createProjectSlug('  Hello,   World!!!  ')).toBe(
            `hello-world-${now.toString(36)}`,
        )
    })

    it('normalizes accented characters before slugifying', () => {
        const now = 1700000000002

        vi.spyOn(Date, 'now').mockReturnValue(now)

        expect(createProjectSlug('Crème Brûlée Über')).toBe(
            `creme-brulee-uber-${now.toString(36)}`,
        )
    })

    it('falls back to default slug when title has no latin letters or digits', () => {
        const now = 1700000000003

        vi.spyOn(Date, 'now').mockReturnValue(now)

        expect(createProjectSlug('   !!!   ')).toBe(
            `project-${now.toString(36)}`,
        )
    })
})
