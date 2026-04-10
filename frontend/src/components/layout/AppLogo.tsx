import { Zap } from 'lucide-react'

export function Logo() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.6rem] bg-(--accent)">
                <Zap size={18} strokeWidth={2} color="white" />
            </div>
            <span className="text-lg leading-none font-bold tracking-[0.16em] text-(--foreground)">
                STRIDE
            </span>
        </div>
    )
}
