package config

import (
	"github.com/caarlos0/env/v11"
	"time"
)

type Config struct {
	ListenAddress   string        `env:"LISTEN_ADDRESS" envDefault:"127.0.0.1:8080"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"5s"`
}

func Load() (Config, error) {
	var cfg Config
	err := env.Parse(&cfg)
	return cfg, err
}
