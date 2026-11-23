// MAP
// §1 imports                 L9-L21
// §2 constants and types     L22-L33
// §3 public API              L34-L83
// §4 validation              L84-L120
// §5 atomic file operations  L121-L195
package storage

// §1 imports
import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sync"
)

// §2 constants and types
const MaxLibraryBytes int64 = 32 << 20

type Store struct {
	dir string
	mu  sync.Mutex
}

type libraryHeader struct {
	SchemaVersion int `json:"schemaVersion"`
}

// §3 public API
func New(dir string) *Store { return &Store{dir: dir} }

func DefaultDataDir() (string, error) {
	if override := os.Getenv("NEXOR_DATA_DIR"); override != "" {
		return filepath.Clean(override), nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locate application data: %w", err)
	}
	return filepath.Join(base, "Nexor Desktop"), nil
}

func (s *Store) Load() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.libraryPath())
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read library: %w", err)
	}
	if err := validate(data); err != nil {
		return "", fmt.Errorf("library is corrupt: %w", err)
	}
	return string(data), nil
}

func (s *Store) Save(text string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data := []byte(text)
	if err := validate(data); err != nil {
		return err
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return fmt.Errorf("create data directory: %w", err)
	}
	if err := replaceFile(s.libraryPath(), s.backupPath(), data); err != nil {
		return fmt.Errorf("save library: %w", err)
	}
	return nil
}

func (s *Store) LibraryPath() string { return s.libraryPath() }

// §4 validation
func validate(data []byte) error {
	if int64(len(data)) > MaxLibraryBytes {
		return fmt.Errorf("library exceeds %d bytes", MaxLibraryBytes)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	var raw map[string]json.RawMessage
	if err := decoder.Decode(&raw); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	if raw == nil {
		return errors.New("library must be a JSON object")
	}
	if err := ensureEOF(decoder); err != nil {
		return err
	}
	var header libraryHeader
	if err := json.Unmarshal(data, &header); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	if header.SchemaVersion != 1 {
		return fmt.Errorf("unsupported schemaVersion %d", header.SchemaVersion)
	}
	return nil
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("multiple JSON values are not allowed")
		}
		return fmt.Errorf("invalid trailing JSON: %w", err)
	}
	return nil
}

// §5 atomic file operations
func replaceFile(target, backup string, data []byte) error {
	temp, err := os.CreateTemp(filepath.Dir(target), ".library-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if err := writeAndSync(temp, data); err != nil {
		return err
	}

	if _, err := os.Stat(target); err == nil {
		if err := copyBackup(target, backup); err != nil {
			return fmt.Errorf("create backup: %w", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect current library: %w", err)
	}

	if err := installReplacement(tempName, target); err != nil {
		return fmt.Errorf("install replacement: %w", err)
	}
	return syncDirectory(filepath.Dir(target))
}

func copyBackup(source, backup string) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(backup), ".backup-*.tmp")
	if err != nil {
		return err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if err := writeAndSync(temp, data); err != nil {
		return err
	}
	return installReplacement(tempName, backup)
}

func writeAndSync(file *os.File, data []byte) error {
	if _, err := file.Write(data); err != nil {
		file.Close()
		return fmt.Errorf("write temporary file: %w", err)
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return fmt.Errorf("sync temporary file: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close temporary file: %w", err)
	}
	return nil
}

func syncDirectory(dir string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	handle, err := os.Open(dir)
	if err != nil {
		return fmt.Errorf("open data directory for sync: %w", err)
	}
	defer handle.Close()
	if err := handle.Sync(); err != nil && !errors.Is(err, os.ErrInvalid) {
		return fmt.Errorf("sync data directory: %w", err)
	}
	return nil
}

func (s *Store) libraryPath() string { return filepath.Join(s.dir, "library.json") }
func (s *Store) backupPath() string  { return filepath.Join(s.dir, "library.backup.json") }
