package config

import "strings"

type ApplicationMode string

const (
	ApplicationModeClosedNetwork ApplicationMode = "closed_network"
	ApplicationModeClosedAuth    ApplicationMode = "closed_auth"
	ApplicationModeOpenNetwork   ApplicationMode = "open_network"
)

func ApplicationModeFromEnv() ApplicationMode {
	mode := ApplicationMode(strings.ToLower(strings.TrimSpace(
		EnvStr("APPLICATION_MODE", string(ApplicationModeClosedNetwork)),
	)))

	switch mode {
	case ApplicationModeClosedAuth, ApplicationModeOpenNetwork:
		return ApplicationModeClosedAuth
	default:
		return ApplicationModeClosedNetwork
	}
}

func (m ApplicationMode) IsOpenNetwork() bool {
	return m == ApplicationModeClosedAuth || m == ApplicationModeOpenNetwork
}
