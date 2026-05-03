const DEFAULT_PROJECT_SLUG = 'project'

const createProjectSlug = (title: string) => {
    const baseSlug = title
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const suffix = Date.now().toString(36)

    return `${baseSlug || DEFAULT_PROJECT_SLUG}-${suffix}`
}

export default createProjectSlug
