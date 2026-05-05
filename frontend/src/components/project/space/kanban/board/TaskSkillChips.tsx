import { Chip, Tooltip } from '@heroui/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TaskSkill } from '../../../../../store/features/tasks/task.types'

const SKILL_CHIP_GAP = 4
const OVERFLOW_CHIP_WIDTH = 36

function SkillChip({ skill }: { skill: TaskSkill }) {
    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger>
                <Chip className="max-w-30 shrink-0 overflow-hidden">
                    <Chip.Label className="block min-w-0 truncate">
                        {skill.name}
                    </Chip.Label>
                </Chip>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="bottom">
                <Tooltip.Arrow />
                {skill.description || skill.name}
            </Tooltip.Content>
        </Tooltip>
    )
}

export function TaskSkillChips({ skills = [] }: { skills?: TaskSkill[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)
    const [visibleCount, setVisibleCount] = useState(skills.length)
    const skillNames = useMemo(
        () => skills.map((skill) => skill.name).join('|'),
        [skills],
    )

    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return

        function updateVisibleCount() {
            const containerWidth = containerRef.current?.clientWidth ?? 0
            const chipWidths = Array.from(
                measureRef.current?.children ?? [],
            ).map((element) => (element as HTMLElement).offsetWidth)

            for (let count = skills.length; count >= 0; count -= 1) {
                const hiddenCount = skills.length - count
                const visibleWidth = chipWidths
                    .slice(0, count)
                    .reduce((total, width) => total + width, 0)
                const visibleGaps = Math.max(0, count - 1) * SKILL_CHIP_GAP
                const overflowWidth =
                    hiddenCount > 0
                        ? OVERFLOW_CHIP_WIDTH + (count > 0 ? SKILL_CHIP_GAP : 0)
                        : 0

                if (
                    visibleWidth + visibleGaps + overflowWidth <=
                    containerWidth
                ) {
                    setVisibleCount(count)
                    return
                }
            }

            setVisibleCount(0)
        }

        updateVisibleCount()

        const observer = new ResizeObserver(updateVisibleCount)
        observer.observe(container)

        return () => observer.disconnect()
    }, [skills.length, skillNames])

    if (skills.length === 0) return null

    const visibleSkills = skills.slice(0, visibleCount)
    const hiddenSkills = skills.slice(visibleCount)

    return (
        <div
            ref={containerRef}
            className="relative flex w-full flex-row gap-1 overflow-hidden"
        >
            <div
                ref={measureRef}
                aria-hidden="true"
                className="invisible absolute flex gap-1 whitespace-nowrap"
            >
                {skills.map((skill) => (
                    <Chip
                        key={skill.id}
                        className="max-w-30 shrink-0 overflow-hidden"
                    >
                        <Chip.Label className="block min-w-0 truncate">
                            {skill.name}
                        </Chip.Label>
                    </Chip>
                ))}
            </div>

            {visibleSkills.map((skill) => (
                <SkillChip key={skill.id} skill={skill} />
            ))}

            {hiddenSkills.length > 0 && (
                <Tooltip delay={0}>
                    <Tooltip.Trigger>
                        <Chip className="min-w-9 shrink-0 px-2">
                            <Chip.Label className="text-xs">
                                +{hiddenSkills.length}
                            </Chip.Label>
                        </Chip>
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow placement="bottom">
                        <Tooltip.Arrow />
                        {hiddenSkills.map((skill) => skill.name).join(', ')}
                    </Tooltip.Content>
                </Tooltip>
            )}
        </div>
    )
}
