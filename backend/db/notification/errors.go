package notification

import "errors"

var (
	ErrAppendNotificationToRedisStream		= errors.New("append notification to redis stream")
	ErrReadNotificationsFromRedisStream		= errors.New("read notifications from redis stream")
	ErrParseNotificationFromStreamEntry		= errors.New("parse notification from redis stream entry")
	ErrCreateRedisStreamConsumerGroup		= errors.New("create redis stream consumer group")
	ErrRedisIsNil							= errors.New("redis client is nil")
)