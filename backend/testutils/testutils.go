package testutils

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func RequireEqualDate(t *testing.T, t1 time.Time, t2 time.Time, msg ...string) {
	t1Trunc := t1.In(time.UTC).Truncate(24 * time.Hour)
	t2Trunc := t2.In(time.UTC).Truncate(24 * time.Hour)

	require.Truef(t, t1Trunc.Equal(t2Trunc), "Expected date-part of two times (%s, %s) to be equal: %s", t1Trunc, t2Trunc, strings.Join(msg, ", "))
}

func RequireEqualTime(t *testing.T, t1 time.Time, t2 time.Time, msg ...string) {
	require.Truef(t, t1.Equal(t2), "Expected times (%s, %s) to be equal: %s", t1, t2, strings.Join(msg, ", "))
}

func Map[T, V any](from []T, toFunc func(T) V) []V {
	res := make([]V, 0, len(from))
	for _, e := range from {
		res = append(res, toFunc(e))
	}
	return res
}
