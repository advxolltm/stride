# Notification Quick Guide

Use injected `NotificationService`.

## `sendNotification`

Real method: `SendNotification(ctx context.Context, userID uuid.UUID, objectType string, objectID uuid.UUID, message string) error`

What it does:

- Creates one unread notification for one user.
- Frontend can see it in `GET /notifications` and live on `GET /ws/notifications`.
- Redis keeps the latest 100 stream entries per user and refreshes a 30-day TTL on write.

Examples:

```go
err := notificationService.SendNotification(ctx, assigneeID, "task", taskID, "Task assigned to you")
if err != nil {
	return err
}
```

```go
err := notificationService.SendNotification(ctx, ownerID, "project", projectID, "Project archived")
if err != nil {
	return err
}
```

## `sendBulk`

Real method: `SendBulkNotification(ctx context.Context, userIDs uuid.UUIDs, objectType string, objectID uuid.UUID, message string) error`

What it does:

- Creates one unread notification per unique user ID.
- Ignores duplicate user IDs.
- Redis keeps the latest 100 stream entries per user and refreshes a 30-day TTL on write.

Examples:

```go
err := notificationService.SendBulkNotification(ctx, uuid.UUIDs{userA, userB}, "task", taskID, "Task moved to In Progress")
if err != nil {
	return err
}
```

```go
err := notificationService.SendBulkNotification(ctx, memberIDs, "project", projectID, "Project deadline changed")
if err != nil {
	return err
}
```

## Frontend Payload

REST `GET /notifications` returns `[]Notification`.

WebSocket `GET /ws/notifications` first sends a snapshot:

```json
{
  "type": "notifications.snapshot",
  "payload": {
    "new": [],
    "old": [],
    "new_count": 0,
    "old_count": 0
  }
}
```

Then it sends live updates:

```json
{
  "type": "notifications.new",
  "payload": {
    "id": "uuid-string",
    "user_id": "uuid-string",
    "edit_type": "string",
    "object_type": "string",
    "object_id": "uuid-string",
    "message": "string",
    "read": false
  }
}
```

Field names and types:

- `type`: `notifications.snapshot`, `notifications.new`, or `notifications.old`
- `payload.id`: `string` (UUID)
- `payload.user_id`: `string` (UUID)
- `payload.edit_type`: `string`
- `payload.object_type`: `string`
- `payload.object_id`: `string` (UUID)
- `payload.message`: `string`
- `payload.read`: `bool`

Notes:

- `SendNotification` and `SendBulkNotification` always create notifications with `read = false`.
- `PATCH /notifications/:id/read` writes a read update, so live WS sends `type = "notifications.old"` for that notification.
- These two send methods do not set `edit_type`.
