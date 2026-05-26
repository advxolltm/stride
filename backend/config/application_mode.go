package config

import "strings"

type ApplicationMode string

const (
	ApplicationModeClosedNetwork ApplicationMode = "closed_network"
	ApplicationModeOpenNetwork   ApplicationMode = "open_network"
)

func ApplicationModeFromEnv() ApplicationMode {
	mode := ApplicationMode(strings.ToLower(strings.TrimSpace(
		EnvStr("APPLICATION_MODE", string(ApplicationModeClosedNetwork)),
	)))

	switch mode {
	case ApplicationModeOpenNetwork:
		return ApplicationModeOpenNetwork
	default:
		return ApplicationModeClosedNetwork
	}
}

func (m ApplicationMode) IsOpenNetwork() bool {
	return m == ApplicationModeOpenNetwork
}
