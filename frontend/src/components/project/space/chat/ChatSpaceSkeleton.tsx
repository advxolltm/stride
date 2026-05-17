import { Skeleton } from '@heroui/react'

interface ChatSpaceSkeletonProps {
    variant?: 'page' | 'embedded'
}

export function ChatSpaceSkeleton({
    variant: _variant = 'page',
}: ChatSpaceSkeletonProps) {
    return (
        <div
            className={[
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                'bg-background',
            ].join(' ')}
        >
            <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
                <div className="mb-6 flex justify-center">
                    <Skeleton className="h-7 w-20 rounded-full" />
                </div>

                <div className="mb-6 flex gap-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                    <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                            <Skeleton className="h-3 w-14 rounded-lg" />
                            <Skeleton className="h-3 w-12 rounded-lg" />
                        </div>
                        <Skeleton className="h-14 w-2/5 rounded-2xl" />
                    </div>
                </div>

                <div className="mb-6 flex justify-end">
                    <div className="flex w-1/2 flex-col items-end">
                        <div className="mb-2 flex items-center gap-2">
                            <Skeleton className="h-3 w-12 rounded-lg" />
                            <Skeleton className="h-3 w-10 rounded-lg" />
                        </div>
                        <Skeleton className="h-14 w-full rounded-2xl" />
                    </div>
                </div>

                <div className="mb-6 flex gap-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                    <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                            <Skeleton className="h-3 w-18 rounded-lg" />
                            <Skeleton className="h-3 w-14 rounded-lg" />
                        </div>
                        <Skeleton className="h-20 w-3/4 rounded-2xl" />
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t-2 border-default-200 p-3 px-6">
                <div className="border-default-200 bg-surface flex h-14 items-center rounded-2xl border px-3 shadow-sm">
                    <Skeleton className="h-4 w-32 rounded-lg" />
                    <Skeleton className="ml-auto h-10 w-10 rounded-xl" />
                </div>
            </div>
        </div>
    )
}
