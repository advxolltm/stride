package config

import (
	"log"
	"os"
	"strconv"
)


func EnvBool(key string, fallback bool) bool {
	if val, ok := os.LookupEnv(key); ok {
		return val == "true"
	}
	return fallback
}


func EnvInt(key string, fallback int) int {
	if val, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}

func EnvStr(key string, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func EnvStrMust(key string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}

	log.Fatalf("environment variable not set: %s", key)
	return ""
}
