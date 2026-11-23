// MAP
// §1 imports and types L8-L29
// §2 directory setup L30-L52
// §3 state publication L53-L64
// §4 pending changes L65-L131
package syncbridge

// §1 imports and types
import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"nexor/storage"
)

type Bridge struct{ dir string }

type ChangeFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func New(dir string) *Bridge { return &Bridge{dir: filepath.Clean(dir)} }

// §2 directory setup
func DefaultDir() (string, error) {
	if override := os.Getenv("NEXOR_SYNC_DIR"); override != "" {
		return filepath.Clean(override), nil
	}
	executable, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("locate executable: %w", err)
	}
	return filepath.Join(filepath.Dir(executable), "Nexor Sync"), nil
}

func (b *Bridge) Directory() string { return b.dir }

func (b *Bridge) Ensure() error {
	for _, name := range []string{"pending", "state", "applied", "rejected"} {
		if err := os.MkdirAll(filepath.Join(b.dir, name), 0o700); err != nil {
			return fmt.Errorf("create sync directory %s: %w", name, err)
		}
	}
	return nil
}

// §3 state publication
func (b *Bridge) PublishLibrary(text string) error {
	if err := b.Ensure(); err != nil {
		return err
	}
	path := filepath.Join(b.dir, "state", "library.json")
	if err := storage.WriteExport(path, []byte(text)); err != nil {
		return fmt.Errorf("publish sync state: %w", err)
	}
	return nil
}

// §4 pending changes
func (b *Bridge) Pending() ([]ChangeFile, error) {
	if err := b.Ensure(); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(filepath.Join(b.dir, "pending"))
	if err != nil {
		return nil, fmt.Errorf("read pending changes: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	result := make([]ChangeFile, 0, min(len(entries), MaxPendingFiles))
	for _, entry := range entries {
		if len(result) == MaxPendingFiles {
			break
		}
		if entry.IsDir() || !strings.EqualFold(filepath.Ext(entry.Name()), ".json") || !safeName(entry.Name()) {
			continue
		}
		path := filepath.Join(b.dir, "pending", entry.Name())
		info, statErr := entry.Info()
		if statErr != nil {
			return nil, fmt.Errorf("inspect pending change %s: %w", entry.Name(), statErr)
		}
		if info.Size() > MaxChangeBytes {
			return nil, fmt.Errorf("pending change %s exceeds %d bytes", entry.Name(), MaxChangeBytes)
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil, fmt.Errorf("read pending change %s: %w", entry.Name(), readErr)
		}
		result = append(result, ChangeFile{Name: entry.Name(), Content: string(data)})
	}
	return result, nil
}

func (b *Bridge) Complete(name, status, reason string) error {
	if !safeName(name) || !strings.EqualFold(filepath.Ext(name), ".json") {
		return errors.New("invalid sync filename")
	}
	if status != "applied" && status != "rejected" {
		return errors.New("invalid sync status")
	}
	if err := b.Ensure(); err != nil {
		return err
	}
	source := filepath.Join(b.dir, "pending", name)
	destination := filepath.Join(b.dir, status, name)
	if _, err := os.Stat(destination); err == nil {
		destination = filepath.Join(b.dir, status, fmt.Sprintf("%d-%s", time.Now().UnixNano(), name))
	}
	if err := os.Rename(source, destination); err != nil {
		return fmt.Errorf("archive sync change: %w", err)
	}
	if status == "rejected" && reason != "" {
		if len(reason) > MaxReasonBytes {
			reason = reason[:MaxReasonBytes]
		}
		if err := os.WriteFile(destination+".error.txt", []byte(reason), 0o600); err != nil {
			return fmt.Errorf("write rejection reason: %w", err)
		}
	}
	return nil
}

func safeName(name string) bool {
	return name != "" && name == filepath.Base(name) && !strings.ContainsAny(name, `/\\`)
}
