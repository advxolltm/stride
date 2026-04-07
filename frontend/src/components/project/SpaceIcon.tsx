import type { ReactNode } from 'react'

interface SpaceIconProps {
    icon: ReactNode
    color: 'purple' | 'yellow' | 'green'
}

export default function SpaceIcon({ icon, color }: Readonly<SpaceIconProps>) {
    const colorMap = {
        purple: 'bg-purple-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
    }

    return (
        <div
            className={`flex h-10 w-16 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
            {icon}
        </div>
    )
}
