package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

type AvatarURLMap struct {
	Small    string `json:"300"`
	Medium   string `json:"600"`
	Original string `json:"original"`
}

func (a *AvatarURLMap) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("AvatarURLMap.Scan: expected []byte, got %T", value)
	}
	return json.Unmarshal(bytes, a)
}

func (a AvatarURLMap) Value() (driver.Value, error) {
	return json.Marshal(a)
}
