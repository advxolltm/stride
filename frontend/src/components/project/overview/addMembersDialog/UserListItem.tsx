import { Avatar, Description, Label, ListBox } from '@heroui/react'
import { getInitials } from '../../../../shared/utils'

interface UserListItemProps {
    id: string
    name: string
    email: string
}

export function UserListItem({ id, name, email }: Readonly<UserListItemProps>) {
    return (
        <ListBox.Item id={id} textValue={name}>
            <Avatar size="sm">
                <Avatar.Fallback className="bg-accent text-sm text-white">
                    {getInitials(name)}
                </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col">
                <Label>{name}</Label>
                <Description>{email}</Description>
            </div>
            <ListBox.ItemIndicator />
        </ListBox.Item>
    )
}
