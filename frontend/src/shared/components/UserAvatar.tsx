import { Avatar } from '@heroui/react'
import clsx from 'clsx'
import type { ComponentProps, CSSProperties } from 'react'
import getInitials from '../utils/getInitials'

type UserAvatarProps = Omit<ComponentProps<typeof Avatar>, 'children'> & {
    name: string
    src?: string | null
    imageAlt?: string
    fallbackClassName?: string
    fallbackStyle?: CSSProperties
}

export function UserAvatar({
    name,
    src,
    imageAlt,
    fallbackClassName,
    fallbackStyle,
    size,
    className,
    ...avatarProps
}: Readonly<UserAvatarProps>) {
    const displayName = name.trim() || 'User'

    return (
        <Avatar
            {...avatarProps}
            className={className}
            size={size ?? "sm"}
        >
            <Avatar.Image
                src={src ?? undefined}
                alt={imageAlt ?? displayName}
            />
            <Avatar.Fallback
                className={clsx(
                    'bg-accent text-sm text-white',
                    fallbackClassName,
                )}
                style={fallbackStyle}
            >
                {getInitials(displayName)}
            </Avatar.Fallback>
        </Avatar>
    )
}
