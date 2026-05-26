const APPLICATION_MODE_CLOSED_NETWORK = 'closed_network'
const APPLICATION_MODE_OPEN_NETWORK = 'open_network'

type ApplicationMode =
    | typeof APPLICATION_MODE_CLOSED_NETWORK
    | typeof APPLICATION_MODE_OPEN_NETWORK

const normalizeApplicationMode = (value: unknown): ApplicationMode =>
    value === APPLICATION_MODE_OPEN_NETWORK
        ? APPLICATION_MODE_OPEN_NETWORK
        : APPLICATION_MODE_CLOSED_NETWORK

export const applicationMode = normalizeApplicationMode(
    import.meta.env.APPLICATION_MODE ?? import.meta.env.VITE_APPLICATION_MODE,
)

export const isOpenNetworkApplicationMode =
    applicationMode === APPLICATION_MODE_OPEN_NETWORK
