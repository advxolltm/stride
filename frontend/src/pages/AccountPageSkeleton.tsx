import { Skeleton } from '@heroui/react'

export function AccountPageSkeleton() {
    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
            <Skeleton className="mb-4 h-8 w-16 rounded-lg" />
            <div className="mb-6">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-72 rounded-lg" />
            </div>
            <div className="flex gap-4 border-b pb-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="mt-6 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="flex justify-end gap-3">
                    <Skeleton className="h-9 w-20 rounded-lg" />
                    <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
            </div>
        </div>
    )
}
