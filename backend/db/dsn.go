package db

import (
	"backend/config"
	"fmt"
)

func PostgresDSNFromEnv() string {
	return fmt.Sprintf(
		"postgresql://%s:%s@%s:%s/%s?sslmode=disable",
		config.EnvStrMust("DB_USER"),
		config.EnvStrMust("DB_PASSWORD"),
		config.EnvStrMust("DB_HOST"),
		config.EnvStrMust("DB_PORT"),
		config.EnvStrMust("DB_NAME"),
	)
}

func RedisDSNFromEnv() string {
	return fmt.Sprintf(
		"%s:%s", 
		config.EnvStrMust("REDIS_HOST"),
		config.EnvStrMust("REDIS_PORT"),
	)
}
