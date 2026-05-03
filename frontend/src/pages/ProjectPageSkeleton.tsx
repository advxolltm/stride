import { Skeleton } from '@heroui/react'

export function ProjectPageSkeleton() {
    return (
        <div className="flex flex-col gap-8 p-6">
            <div className="border-b">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-20 rounded-lg" />
                        <Skeleton className="h-8 w-56 rounded-lg" />
                    </div>

                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-10 rounded-lg" />
                    </div>
                </div>
            </div>

            <div>
                <Skeleton className="mb-4 h-7 w-36 rounded-lg" />

                <div className="max-w-5xl">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <div
                                key={index}
                                className="rounded-xl border p-6"
                            >
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="mt-4 flex flex-col gap-2">
                                    <Skeleton className="h-5 w-28 rounded-lg" />
                                    <Skeleton className="h-4 w-full rounded-lg" />
                                    <Skeleton className="h-4 w-3/4 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
