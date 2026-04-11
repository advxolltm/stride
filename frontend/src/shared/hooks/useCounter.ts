import { useCallback, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from './redux'
import {
    decrement,
    increment,
    incrementAsync,
    incrementByAmount,
    resetCounter,
} from '../../store/features/counter.slice'
import {
    selectCount,
    selectCounterStatus,
    selectIsCounterLoading,
} from '../../store/features/counter.selectors'

export function useCounter() {
    const dispatch = useAppDispatch()
    const count = useAppSelector(selectCount)
    const status = useAppSelector(selectCounterStatus)
    const isLoading = useAppSelector(selectIsCounterLoading)

    const [amount, setAmount] = useState('5')

    const parsedAmount = useMemo(() => Number(amount) || 0, [amount])

    const onIncrement = useCallback(() => {
        dispatch(increment())
    }, [dispatch])

    const onDecrement = useCallback(() => {
        dispatch(decrement())
    }, [dispatch])

    const onReset = useCallback(() => {
        dispatch(resetCounter())
    }, [dispatch])

    const onAddAmount = useCallback(() => {
        dispatch(incrementByAmount(parsedAmount))
    }, [dispatch, parsedAmount])

    const onAddAmountAsync = useCallback(() => {
        dispatch(incrementAsync(parsedAmount))
    }, [dispatch, parsedAmount])

    return {
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
    }
}
