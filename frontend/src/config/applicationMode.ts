const APPLICATION_MODE_CLOSED_NETWORK = 'closed_network'
const APPLICATION_MODE_CLOSED_AUTH = 'closed_auth'
const APPLICATION_MODE_OPEN_NETWORK_LEGACY = 'open_network'

type ApplicationMode =
    | typeof APPLICATION_MODE_CLOSED_NETWORK
    | typeof APPLICATION_MODE_CLOSED_AUTH

const normalizeApplicationMode = (value: unknown): ApplicationMode => {
    if (
        value === APPLICATION_MODE_CLOSED_AUTH ||
        value === APPLICATION_MODE_OPEN_NETWORK_LEGACY
    ) {
        return APPLICATION_MODE_CLOSED_AUTH
    }

    return APPLICATION_MODE_CLOSED_NETWORK
}

export const applicationMode = normalizeApplicationMode(
    import.meta.env.APPLICATION_MODE ?? import.meta.env.VITE_APPLICATION_MODE,
)

export const isOpenNetworkApplicationMode =
    applicationMode === APPLICATION_MODE_CLOSED_AUTH
