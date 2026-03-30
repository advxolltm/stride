import { useCounter } from '../../hooks/useCounter'

const CounterPanel = () => {
    const {
        count,
        status,
        isLoading,
        amount,
        setAmount,
        onIncrement,
        onDecrement,
        onReset,
        onAddAmount,
        onAddAmountAsync,
    } = useCounter()
    return (
        <section className="mx-auto max-w-xl rounded-xl border border-slate-200 p-6 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
                Redux Counter Demo
            </h2>
            <p className="mt-3 text-slate-700">Count: {count}</p>
            <p className="mt-1 text-sm text-slate-500">Status: {status}</p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                    type="button"
                    onClick={onIncrement}
                    className="rounded-md border px-3 py-2"
                >
                    +1
                </button>
                <button
                    type="button"
                    onClick={onDecrement}
                    className="rounded-md border px-3 py-2"
                >
                    -1
                </button>
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-md border px-3 py-2"
                >
                    Reset
                </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <input
                    type="number"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-28 rounded-md border px-2 py-2"
                />
                <button
                    type="button"
                    onClick={onAddAmount}
                    className="rounded-md border px-3 py-2"
                >
                    Add Amount
                </button>
                <button
                    type="button"
                    onClick={onAddAmountAsync}
                    disabled={isLoading}
                    className="rounded-md border px-3 py-2 disabled:opacity-50"
                >
                    {isLoading ? 'Adding...' : 'Add Async'}
                </button>
            </div>
        </section>
    )
}

export default CounterPanel
