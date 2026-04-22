import {
    Button,
    Input,
    ListBox,
    Modal,
    Spinner,
    Surface,
    toast,
} from '@heroui/react'
import { UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Selection } from 'react-aria-components'
import { useTranslation } from 'react-i18next'
import { useGetUsersQuery } from '../../../../store/features/user/user.api'
import { UserChip } from './UserChip'
import { UserListItem } from './UserListItem'
import { useAddProjectMembersMutation } from '../../../../store/features/project/project.api'

interface AddMembersDialogProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    projectId: string
    projectName: string
    existingMemberIds: string[]
    currentUserId: string
}

export function AddMembersDialog({
    isOpen,
    setIsOpen,
    projectId,
    projectName,
    existingMemberIds,
    currentUserId,
}: Readonly<AddMembersDialogProps>) {
    const { t } = useTranslation('project')
    const [search, setSearch] = useState('')
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

    const { data: allUsers = [] } = useGetUsersQuery()
    const [addMember, { isLoading }] = useAddProjectMembersMutation()

    // Filter out users who are already members or the current user
    const availableUsers = useMemo(
        () =>
            allUsers.filter(
                (user) =>
                    !existingMemberIds.includes(user.id) &&
                    user.id !== currentUserId,
            ),
        [allUsers, existingMemberIds, currentUserId],
    )

    // Filter users based on search query
    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        if (!q) return availableUsers
        return availableUsers.filter(
            (user) =>
                user.fullName?.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q),
        )
    }, [search, availableUsers])

    // Get the selected user objects based on selected keys
    const selectedUsers = useMemo(
        () => availableUsers.filter((user) => selectedKeys.has(user.id)),
        [availableUsers, selectedKeys],
    )

    const handleSelectionChange = (keys: Selection) => {
        if (keys === 'all') return
        setSelectedKeys(keys as Set<string>)
    }

    const handleRemoveChip = (userId: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev)
            next.delete(userId)
            return next
        })
    }

    // Handle adding selected users as project members
    const handleAdd = async () => {
        try {
            await addMember({
                projectId,
                body: selectedUsers.map((u) => ({
                    userid: u.id,
                    role: 'member' as const,
                })),
            }).unwrap()
            toast.success(t('addMembersDialog.membersAdded'))
            handleOpenChange(false)
        } catch {
            toast.danger(t('addMembersDialog.membersAddError'))
        }
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            setSearch('')
            setSelectedKeys(new Set())
        }
    }

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>
                            {t('addMembersDialog.title')}
                        </Modal.Heading>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {t('addMembersDialog.description', {
                                project: projectName,
                            })}
                        </p>
                    </Modal.Header>

                    <Modal.Body className="flex flex-col gap-3 p-0.5">
                        <Input
                            placeholder={t(
                                'addMembersDialog.searchPlaceholder',
                            )}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            variant="secondary"
                            autoComplete="off"
                            className="w-full"
                        />

                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedUsers.map((user) => (
                                    <UserChip
                                        key={user.id}
                                        id={user.id}
                                        displayName={
                                            user.fullName ?? user.username
                                        }
                                        onRemove={handleRemoveChip}
                                    />
                                ))}
                            </div>
                        )}

                        <Surface className="rounded-xl">
                            <ListBox
                                aria-label="Users"
                                selectionMode="multiple"
                                selectedKeys={selectedKeys}
                                onSelectionChange={handleSelectionChange}
                            >
                                {filtered.map((user) => (
                                    <UserListItem
                                        key={user.id}
                                        id={user.id}
                                        name={user.fullName ?? user.username}
                                        email={user.email}
                                    />
                                ))}

                                {filtered.length === 0 && (
                                    <ListBox.Item
                                        id="empty"
                                        isDisabled
                                        textValue="empty"
                                    >
                                        <p className="text-muted-foreground text-sm">
                                            {search.trim()
                                                ? t(
                                                      'addMembersDialog.noResults',
                                                  )
                                                : t(
                                                      'addMembersDialog.allMembersAdded',
                                                  )}
                                        </p>
                                    </ListBox.Item>
                                )}
                            </ListBox>
                        </Surface>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">
                            {selectedUsers.length > 0
                                ? t('addMembersDialog.selectedCount', {
                                      count: selectedUsers.length,
                                  })
                                : null}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onPress={() => handleOpenChange(false)}
                            >
                                {t('addMembersDialog.cancel')}
                            </Button>
                            <Button
                                onPress={handleAdd}
                                isDisabled={selectedUsers.length === 0}
                                isPending={isLoading}
                            >
                                {isLoading && (
                                    <Spinner
                                        color="current"
                                        size="sm"
                                        className="mr-2"
                                    />
                                )}
                                <UserPlus size={15} />
                                {t('addMembersDialog.add')}
                                {selectedUsers.length > 0 &&
                                    ` (${selectedUsers.length})`}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}
