import type { LucideIcon } from 'lucide-react'

interface IconBadgeProps {
    icon: LucideIcon
    color: 'purple' | 'yellow' | 'green'
}

export function IconBadge({ icon: Icon, color }: IconBadgeProps) {
    const colorMap = {
        purple: 'bg-purple-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
    }

    return (
        <div
            className={`flex h-full w-full items-center justify-center rounded-lg ${colorMap[color]}`}
        >
            <Icon className="text-white" size={20} />
        </div>
    )
}
