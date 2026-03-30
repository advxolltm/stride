import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../store";

const selectCounterState = (state: RootState) => state.counter;

export const selectCount = createSelector(
  [selectCounterState],
  (counter) => counter.value,
);

export const selectCounterStatus = createSelector(
  [selectCounterState],
  (counter) => counter.status,
);

export const selectIsCounterLoading = createSelector(
  [selectCounterStatus],
  (status) => status === "loading",
);
