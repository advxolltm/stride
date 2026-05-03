# Notification Quick Guide

Use injected `NotificationService`.

## `sendNotification`

Real method: `SendNotification(ctx context.Context, userID uuid.UUID, objectType string, objectID uuid.UUID, message string) error`

What it does:

- Creates one unread notification for one user.
- Frontend can see it in `GET /notifications` and live on `GET /ws/notifications`.

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

WebSocket `GET /ws/notifications` sends:

```json
{
  "type": "notification",
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

- `type`: `string`
- `payload.id`: `string` (UUID)
- `payload.user_id`: `string` (UUID)
- `payload.edit_type`: `string`
- `payload.object_type`: `string`
- `payload.object_id`: `string` (UUID)
- `payload.message`: `string`
- `payload.read`: `bool`

Notes:

- `SendNotification` and `SendBulkNotification` always create notifications with `read = false`.
- These two methods do not set `edit_type`.
