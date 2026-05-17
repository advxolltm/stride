import { Description, Label, ListBox } from '@heroui/react'
import { UserAvatar } from '../../../../shared/components'

interface UserListItemProps {
    id: string
    name: string
    email: string
    avatarUrl?: string
}

export function UserListItem({
    id,
    name,
    email,
    avatarUrl,
}: Readonly<UserListItemProps>) {
    return (
        <ListBox.Item id={id} textValue={name}>
            <UserAvatar name={name} src={avatarUrl} />
            <div className="flex flex-col">
                <Label>{name}</Label>
                <Description>{email}</Description>
            </div>
            <ListBox.ItemIndicator />
        </ListBox.Item>
    )
}
