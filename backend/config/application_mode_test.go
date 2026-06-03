package config

import "testing"

func TestApplicationModeFromEnv(t *testing.T) {
	t.Run("defaults to closed network", func(t *testing.T) {
		t.Setenv("APPLICATION_MODE", "")

		if got := ApplicationModeFromEnv(); got != ApplicationModeClosedNetwork {
			t.Fatalf("expected %q, got %q", ApplicationModeClosedNetwork, got)
		}
	})

	t.Run("recognizes closed auth", func(t *testing.T) {
		t.Setenv("APPLICATION_MODE", "closed_auth")

		got := ApplicationModeFromEnv()
		if got != ApplicationModeClosedAuth {
			t.Fatalf("expected %q, got %q", ApplicationModeClosedAuth, got)
		}
		if !got.IsOpenNetwork() {
			t.Fatal("expected closed_auth to require authenticated user creation")
		}
	})

	t.Run("keeps open network as legacy alias", func(t *testing.T) {
		t.Setenv("APPLICATION_MODE", "open_network")

		got := ApplicationModeFromEnv()
		if got != ApplicationModeClosedAuth {
			t.Fatalf("expected legacy open_network to normalize to %q, got %q", ApplicationModeClosedAuth, got)
		}
		if !got.IsOpenNetwork() {
			t.Fatal("expected open_network legacy alias to require authenticated user creation")
		}
	})
}
