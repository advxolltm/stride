package testutils

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func compareDate(t1 time.Time, t2 time.Time) bool {
	y1, m1, d1 := t1.Date()
	y2, m2, d2 := t2.Date()
	return y1 == y2 && m1 == m2 && d1 == d2
}

func RequireEqualDate(t *testing.T, t1 time.Time, t2 time.Time, msg ...string) {
	if !compareDate(t1, t2) {
		require.FailNowf(t, "Date-Part of time not equal:\nexpected: %s\nactual: %s\nMessages %s", t1.Format(time.DateOnly), t2.Format(time.DateOnly), strings.Join(msg, ", "))
	}
}

func Map[T, V any](from []T, toFunc func(T) V) []V {
	res := make([]V, 0, len(from))
	for _, e := range from {
		res = append(res, toFunc(e))
	}
	return res
}
