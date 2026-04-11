'use client'

import {
    Button,
    FieldError,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
} from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AVAILABLE_PROJECT_SKILLS } from '../../shared/data/mockProjectsData'
import { SkillsAutocomplete } from '../shared/SkillsAutocomplete'

interface CreateProjectDialogProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    onCreate?: (project: {
        title: string
        description: string
        skills: string[]
    }) => void
}

const EMPTY_FORM = {
    title: '',
    description: '',
    skills: [] as string[],
}

export function CreateProjectDialog({
    isOpen,
    setIsOpen,
    onCreate,
}: Readonly<CreateProjectDialogProps>) {
    const { t } = useTranslation(['project', 'common'])
    const [title, setTitle] = useState(EMPTY_FORM.title)
    const [description, setDescription] = useState(EMPTY_FORM.description)
    const [skills, setSkills] = useState<string[]>(EMPTY_FORM.skills)

    const resetForm = () => {
        setTitle(EMPTY_FORM.title)
        setDescription(EMPTY_FORM.description)
        setSkills(EMPTY_FORM.skills)
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
            resetForm()
        }
    }

    const handleCreateProject = () => {
        onCreate?.({
            title: title.trim(),
            description: description.trim(),
            skills,
        })

        handleOpenChange(false)
    }

    const isCreateDisabled =
        !title.trim() || !description.trim() || skills.length === 0

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog>
                    <Modal.CloseTrigger />

                    <Modal.Header>
                        <Modal.Heading>{t('createDialog.title')}</Modal.Heading>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="flex flex-col gap-4 p-1">
                            <p className="text-sm text-[var(--muted)]">
                                {t('createDialog.description')}
                            </p>

                            <TextField
                                value={title}
                                onChange={setTitle}
                                className="w-full"
                            >
                                <Label>{t('createDialog.fields.title')}</Label>
                                <Input
                                    variant="secondary"
                                    placeholder={t(
                                        'createDialog.placeholders.title',
                                    )}
                                />
                                <FieldError />
                            </TextField>

                            <TextField
                                value={description}
                                onChange={setDescription}
                                className="w-full"
                            >
                                <Label>
                                    {t('createDialog.fields.description')}
                                </Label>
                                <TextArea
                                    variant="secondary"
                                    rows={4}
                                    placeholder={t(
                                        'createDialog.placeholders.description',
                                    )}
                                />
                                <FieldError />
                            </TextField>

                            <SkillsAutocomplete
                                label={t('createDialog.fields.skills')}
                                placeholder={t(
                                    'createDialog.placeholders.skills',
                                )}
                                searchPlaceholder={t(
                                    'createDialog.placeholders.skillsSearch',
                                )}
                                options={AVAILABLE_PROJECT_SKILLS}
                                selectedSkills={skills}
                                onChange={setSkills}
                            />
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            variant="outline"
                            onPress={() => handleOpenChange(false)}
                        >
                            {t('common:actions.cancel')}
                        </Button>

                        <Button
                            variant="primary"
                            onPress={handleCreateProject}
                            isDisabled={isCreateDisabled}
                        >
                            {t('createDialog.actions.create')}
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}
