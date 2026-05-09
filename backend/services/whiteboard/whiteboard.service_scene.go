package whiteboard

import (
	"backend/config"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/datatypes"
)

const (
	WhiteboardSceneMessageTypeSync   = "scene:sync"
	WhiteboardSceneMessageTypeUpdate = "scene:update"
	WhiteboardSceneMessageTypeError  = "error"
)

var (
	WhiteboardSceneMessageReadLimit  = int64(config.EnvInt("WHITEBOARD_SCENE_MESSAGE_READ_LIMIT_BYTES", 10*1024*1024))
	defaultWhiteboardSceneFlushDelay = time.Duration(config.EnvInt("WHITEBOARD_SCENE_FLUSH_DELAY_MS", 2000)) * time.Millisecond
	whiteboardSceneFlushLockTTL      = time.Duration(config.EnvInt("WHITEBOARD_SCENE_FLUSH_LOCK_TTL_MS", 10000)) * time.Millisecond
)

type WhiteboardScene struct {
	Elements []json.RawMessage `json:"elements"`
	AppState json.RawMessage   `json:"appState"`
	Files    json.RawMessage   `json:"files"`
}

type WhiteboardSceneSnapshot struct {
	Revision  int64           `json:"revision"`
	Scene     WhiteboardScene `json:"scene"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type WhiteboardSceneClientMessage struct {
	Type  string           `json:"type"`
	Scene *WhiteboardScene `json:"scene"`
}

type WhiteboardSceneServerMessage struct {
	Type      string           `json:"type"`
	Revision  int64            `json:"revision,omitempty"`
	Scene     *WhiteboardScene `json:"scene,omitempty"`
	UpdatedAt *time.Time       `json:"updatedAt,omitempty"`
	Code      string           `json:"code,omitempty"`
}

type WhiteboardSceneStore struct {
	rdb               *redis.Client
	whiteboardService WhiteboardService
	flushDelay        time.Duration
	flushTimersMu     sync.Mutex
	flushTimers       map[uuid.UUID]*time.Timer
}

func NewWhiteboardSceneStore(rdb *redis.Client, whiteboardService WhiteboardService) *WhiteboardSceneStore {
	return NewWhiteboardSceneStoreWithFlushDelay(rdb, whiteboardService, defaultWhiteboardSceneFlushDelay)
}

func NewWhiteboardSceneStoreWithFlushDelay(
	rdb *redis.Client,
	whiteboardService WhiteboardService,
	flushDelay time.Duration,
) *WhiteboardSceneStore {
	return &WhiteboardSceneStore{
		rdb:               rdb,
		whiteboardService: whiteboardService,
		flushDelay:        flushDelay,
		flushTimers:       make(map[uuid.UUID]*time.Timer),
	}
}

func whiteboardSceneKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:%s", projectID)
}

func whiteboardSceneRevisionKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:revision:%s", projectID)
}

func whiteboardSceneDirtyRevisionKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:dirty_revision:%s", projectID)
}

func whiteboardSceneFlushedRevisionKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:flushed_revision:%s", projectID)
}

func whiteboardSceneFlushLockKey(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:flush_lock:%s", projectID)
}

func whiteboardSceneDirtyProjectsKey() string {
	return "whiteboard:scene:dirty_projects"
}

func WhiteboardSceneChannel(projectID uuid.UUID) string {
	return fmt.Sprintf("whiteboard:scene:updates:%s", projectID)
}

func NewWhiteboardSceneSyncMessage(snapshot WhiteboardSceneSnapshot) WhiteboardSceneServerMessage {
	return WhiteboardSceneServerMessage{
		Type:      WhiteboardSceneMessageTypeSync,
		Revision:  snapshot.Revision,
		Scene:     &snapshot.Scene,
		UpdatedAt: &snapshot.UpdatedAt,
	}
}

func NewWhiteboardSceneErrorMessage(code string) WhiteboardSceneServerMessage {
	return WhiteboardSceneServerMessage{
		Type: WhiteboardSceneMessageTypeError,
		Code: code,
	}
}

func emptyWhiteboardScene() WhiteboardScene {
	return WhiteboardScene{
		Elements: []json.RawMessage{},
		AppState: json.RawMessage(`{}`),
		Files:    json.RawMessage(`{}`),
	}
}

func normalizeWhiteboardScene(scene WhiteboardScene) (WhiteboardScene, error) {
	normalized := WhiteboardScene{
		Elements: make([]json.RawMessage, 0, len(scene.Elements)),
	}

	for _, element := range scene.Elements {
		copied, err := copyRawJSONObject(element, "elements")
		if err != nil {
			return WhiteboardScene{}, err
		}
		normalized.Elements = append(normalized.Elements, copied)
	}

	appState, err := copyRawJSONObjectOrDefault(scene.AppState, "appState")
	if err != nil {
		return WhiteboardScene{}, err
	}
	files, err := copyRawJSONObjectOrDefault(scene.Files, "files")
	if err != nil {
		return WhiteboardScene{}, err
	}
	normalized.AppState = appState
	normalized.Files = files

	return normalized, nil
}

func copyRawJSONObjectOrDefault(raw json.RawMessage, field string) (json.RawMessage, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return json.RawMessage(`{}`), nil
	}
	return copyRawJSONObject(trimmed, field)
}

func copyRawJSONObject(raw json.RawMessage, field string) (json.RawMessage, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, fmt.Errorf("%w: %s must be an object", ErrInvalidWhiteboardScene, field)
	}
	if !json.Valid(trimmed) {
		return nil, fmt.Errorf("%w: %s contains invalid json", ErrInvalidWhiteboardScene, field)
	}

	var object map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &object); err != nil {
		return nil, fmt.Errorf("%w: %s must be an object", ErrInvalidWhiteboardScene, field)
	}

	copied := make(json.RawMessage, len(trimmed))
	copy(copied, trimmed)
	return copied, nil
}

func canvasStateIsEmpty(canvasState datatypes.JSON) bool {
	trimmed := bytes.TrimSpace(canvasState)
	return len(trimmed) == 0 || bytes.Equal(trimmed, []byte("{}")) || bytes.Equal(trimmed, []byte("null"))
}

func sceneFromCanvasState(canvasState datatypes.JSON) (WhiteboardScene, bool, error) {
	if canvasStateIsEmpty(canvasState) {
		return WhiteboardScene{}, false, nil
	}

	var scene WhiteboardScene
	if err := json.Unmarshal(canvasState, &scene); err != nil {
		return WhiteboardScene{}, false, fmt.Errorf("%w: %w", ErrInvalidWhiteboardScene, err)
	}

	normalized, err := normalizeWhiteboardScene(scene)
	if err != nil {
		return WhiteboardScene{}, false, err
	}
	return normalized, true, nil
}

func canvasStateFromScene(scene WhiteboardScene) (datatypes.JSON, error) {
	normalized, err := normalizeWhiteboardScene(scene)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(normalized)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidWhiteboardScene, err)
	}

	return datatypes.JSON(payload), nil
}

func (s *WhiteboardSceneStore) LoadSnapshot(
	ctx context.Context,
	userID uuid.UUID,
	projectID uuid.UUID,
) (WhiteboardSceneSnapshot, error) {
	snapshot, ok, err := s.loadRedisSnapshot(ctx, projectID)
	if err != nil {
		return WhiteboardSceneSnapshot{}, err
	}
	if ok {
		return snapshot, nil
	}

	return s.hydrateSnapshot(ctx, userID, projectID)
}

func (s *WhiteboardSceneStore) loadRedisSnapshot(
	ctx context.Context,
	projectID uuid.UUID,
) (WhiteboardSceneSnapshot, bool, error) {
	payload, err := s.rdb.Get(ctx, whiteboardSceneKey(projectID)).Bytes()
	if errors.Is(err, redis.Nil) {
		return WhiteboardSceneSnapshot{}, false, nil
	}
	if err != nil {
		return WhiteboardSceneSnapshot{}, false, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}

	var snapshot WhiteboardSceneSnapshot
	if err := json.Unmarshal(payload, &snapshot); err != nil {
		return WhiteboardSceneSnapshot{}, false, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}

	scene, err := normalizeWhiteboardScene(snapshot.Scene)
	if err != nil {
		return WhiteboardSceneSnapshot{}, false, err
	}
	snapshot.Scene = scene
	return snapshot, true, nil
}

func (s *WhiteboardSceneStore) hydrateSnapshot(
	ctx context.Context,
	userID uuid.UUID,
	projectID uuid.UUID,
) (WhiteboardSceneSnapshot, error) {
	whiteboard, err := s.whiteboardService.GetOrCreateWhiteboardByProjectID(ctx, userID, projectID)
	if err != nil {
		return WhiteboardSceneSnapshot{}, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}

	scene, ok, err := sceneFromCanvasState(whiteboard.CanvasState)
	if err != nil {
		return WhiteboardSceneSnapshot{}, err
	}
	if !ok {
		scene, err = s.sceneFromLegacyElements(ctx, userID, projectID)
		if err != nil {
			return WhiteboardSceneSnapshot{}, err
		}
	}

	revision, err := s.currentRevision(ctx, projectID)
	if err != nil {
		return WhiteboardSceneSnapshot{}, err
	}

	snapshot := WhiteboardSceneSnapshot{
		Revision:  revision,
		Scene:     scene,
		UpdatedAt: time.Now().UTC(),
	}
	if err := s.storeSnapshot(ctx, projectID, snapshot); err != nil {
		return WhiteboardSceneSnapshot{}, err
	}

	return snapshot, nil
}

func (s *WhiteboardSceneStore) sceneFromLegacyElements(
	ctx context.Context,
	userID uuid.UUID,
	projectID uuid.UUID,
) (WhiteboardScene, error) {
	elements, err := s.whiteboardService.GetElements(ctx, userID, projectID)
	if err != nil {
		return WhiteboardScene{}, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}

	sort.Slice(elements, func(i, j int) bool {
		if elements[i].ZIndex == elements[j].ZIndex {
			return elements[i].ID.String() < elements[j].ID.String()
		}
		return elements[i].ZIndex < elements[j].ZIndex
	})

	scene := emptyWhiteboardScene()
	for _, element := range elements {
		if len(bytes.TrimSpace(element.Props)) == 0 {
			continue
		}

		props, err := copyRawJSONObject(json.RawMessage(element.Props), "element.props")
		if err != nil {
			return WhiteboardScene{}, err
		}
		scene.Elements = append(scene.Elements, props)
	}

	return scene, nil
}

func (s *WhiteboardSceneStore) currentRevision(ctx context.Context, projectID uuid.UUID) (int64, error) {
	revision, err := s.rdb.Get(ctx, whiteboardSceneRevisionKey(projectID)).Result()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}

	parsed, err := strconv.ParseInt(revision, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %w", ErrLoadWhiteboardScene, err)
	}
	return parsed, nil
}

func (s *WhiteboardSceneStore) storeSnapshot(
	ctx context.Context,
	projectID uuid.UUID,
	snapshot WhiteboardSceneSnapshot,
) error {
	normalizedScene, err := normalizeWhiteboardScene(snapshot.Scene)
	if err != nil {
		return err
	}
	snapshot.Scene = normalizedScene
	if snapshot.UpdatedAt.IsZero() {
		snapshot.UpdatedAt = time.Now().UTC()
	}

	payload, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrStoreWhiteboardScene, err)
	}

	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, whiteboardSceneKey(projectID), payload, 0)
	pipe.SetNX(ctx, whiteboardSceneRevisionKey(projectID), snapshot.Revision, 0)
	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrStoreWhiteboardScene, err)
	}

	return nil
}

func (s *WhiteboardSceneStore) SaveScene(
	ctx context.Context,
	projectID uuid.UUID,
	scene WhiteboardScene,
) (WhiteboardSceneSnapshot, error) {
	normalized, err := normalizeWhiteboardScene(scene)
	if err != nil {
		return WhiteboardSceneSnapshot{}, err
	}

	revision, err := s.rdb.Incr(ctx, whiteboardSceneRevisionKey(projectID)).Result()
	if err != nil {
		return WhiteboardSceneSnapshot{}, fmt.Errorf("%w: %w", ErrStoreWhiteboardScene, err)
	}

	snapshot := WhiteboardSceneSnapshot{
		Revision:  revision,
		Scene:     normalized,
		UpdatedAt: time.Now().UTC(),
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return WhiteboardSceneSnapshot{}, fmt.Errorf("%w: %w", ErrStoreWhiteboardScene, err)
	}

	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, whiteboardSceneKey(projectID), payload, 0)
	pipe.Set(ctx, whiteboardSceneDirtyRevisionKey(projectID), revision, 0)
	pipe.SAdd(ctx, whiteboardSceneDirtyProjectsKey(), projectID.String())
	_, err = pipe.Exec(ctx)
	if err != nil {
		return WhiteboardSceneSnapshot{}, fmt.Errorf("%w: %w", ErrStoreWhiteboardScene, err)
	}

	s.ScheduleFlush(projectID)
	return snapshot, nil
}

func (s *WhiteboardSceneStore) PublishSnapshot(
	ctx context.Context,
	projectID uuid.UUID,
	snapshot WhiteboardSceneSnapshot,
) error {
	message := NewWhiteboardSceneSyncMessage(snapshot)
	payload, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrPublishWhiteboardScene, err)
	}

	if err := s.rdb.Publish(ctx, WhiteboardSceneChannel(projectID), payload).Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrPublishWhiteboardScene, err)
	}
	return nil
}

func (s *WhiteboardSceneStore) ScheduleFlush(projectID uuid.UUID) {
	if s.flushDelay <= 0 {
		go s.logFlushResult(context.Background(), projectID)
		return
	}

	s.flushTimersMu.Lock()
	defer s.flushTimersMu.Unlock()

	if timer := s.flushTimers[projectID]; timer != nil {
		timer.Reset(s.flushDelay)
		return
	}

	s.flushTimers[projectID] = time.AfterFunc(s.flushDelay, func() {
		s.flushTimersMu.Lock()
		delete(s.flushTimers, projectID)
		s.flushTimersMu.Unlock()

		s.logFlushResult(context.Background(), projectID)
	})
}

func (s *WhiteboardSceneStore) logFlushResult(ctx context.Context, projectID uuid.UUID) {
	if err := s.FlushDirty(ctx, projectID); err != nil {
		slog.Error("failed to flush whiteboard scene", "error", err, "projectID", projectID)
	}
}

func (s *WhiteboardSceneStore) FlushDirty(ctx context.Context, projectID uuid.UUID) error {
	lockToken := uuid.NewString()
	lockAcquired, err := s.rdb.SetNX(ctx, whiteboardSceneFlushLockKey(projectID), lockToken, whiteboardSceneFlushLockTTL).Result()
	if err != nil {
		return fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}
	if !lockAcquired {
		return nil
	}
	defer s.releaseFlushLock(context.Background(), projectID, lockToken)

	dirtyRevision, ok, err := s.redisInt64(ctx, whiteboardSceneDirtyRevisionKey(projectID))
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}

	flushedRevision, ok, err := s.redisInt64(ctx, whiteboardSceneFlushedRevisionKey(projectID))
	if err != nil {
		return err
	}
	if ok && dirtyRevision <= flushedRevision {
		s.clearDirtyRevision(ctx, projectID, dirtyRevision)
		return nil
	}

	snapshot, ok, err := s.loadRedisSnapshot(ctx, projectID)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}

	canvasState, err := canvasStateFromScene(snapshot.Scene)
	if err != nil {
		return err
	}

	if _, err := s.whiteboardService.PersistCanvasState(ctx, projectID, canvasState); err != nil {
		return fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}

	if err := s.rdb.Set(ctx, whiteboardSceneFlushedRevisionKey(projectID), snapshot.Revision, 0).Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}
	s.clearDirtyRevision(ctx, projectID, snapshot.Revision)

	return nil
}

func (s *WhiteboardSceneStore) redisInt64(ctx context.Context, key string) (int64, bool, error) {
	raw, err := s.rdb.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, false, fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}
	return value, true, nil
}

func (s *WhiteboardSceneStore) clearDirtyRevision(ctx context.Context, projectID uuid.UUID, flushedRevision int64) {
	currentDirtyRevision, ok, err := s.redisInt64(ctx, whiteboardSceneDirtyRevisionKey(projectID))
	if err != nil {
		slog.Error("failed to load whiteboard dirty revision", "error", err, "projectID", projectID)
		return
	}
	if ok && currentDirtyRevision > flushedRevision {
		return
	}

	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx, whiteboardSceneDirtyRevisionKey(projectID))
	pipe.SRem(ctx, whiteboardSceneDirtyProjectsKey(), projectID.String())
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Error("failed to clear whiteboard dirty revision", "error", err, "projectID", projectID)
	}
}

func (s *WhiteboardSceneStore) releaseFlushLock(ctx context.Context, projectID uuid.UUID, token string) {
	const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`
	if err := s.rdb.Eval(ctx, releaseLockScript, []string{whiteboardSceneFlushLockKey(projectID)}, token).Err(); err != nil {
		slog.Error("failed to release whiteboard scene flush lock", "error", err, "projectID", projectID)
	}
}

func (s *WhiteboardSceneStore) FlushAllDirty(ctx context.Context) error {
	projectIDs, err := s.rdb.SMembers(ctx, whiteboardSceneDirtyProjectsKey()).Result()
	if err != nil {
		return fmt.Errorf("%w: %w", ErrFlushWhiteboardScene, err)
	}

	var flushErr error
	for _, rawProjectID := range projectIDs {
		projectID, err := uuid.Parse(rawProjectID)
		if err != nil {
			s.rdb.SRem(ctx, whiteboardSceneDirtyProjectsKey(), rawProjectID)
			continue
		}
		if err := s.FlushDirty(ctx, projectID); err != nil && flushErr == nil {
			flushErr = err
		}
	}

	return flushErr
}
