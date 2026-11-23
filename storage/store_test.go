// MAP
// §1 imports and fixtures  L7-L18
// §2 persistence tests     L19-L69
// §3 failure tests         L70-L121
package storage

// §1 imports and fixtures
import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

const firstLibrary = `{"schemaVersion":1,"activeProjectId":"a"}`
const secondLibrary = `{"schemaVersion":1,"activeProjectId":"b"}`

// §2 persistence tests
func TestSaveLoadAndBackup(t *testing.T) {
	store := New(t.TempDir())
	if got, err := store.Load(); err != nil || got != "" {
		t.Fatalf("empty load = %q, %v", got, err)
	}
	if err := store.Save(firstLibrary); err != nil {
		t.Fatal(err)
	}
	if err := store.Save(secondLibrary); err != nil {
		t.Fatal(err)
	}
	got, err := store.Load()
	if err != nil || got != secondLibrary {
		t.Fatalf("load = %q, %v", got, err)
	}
	backup, err := os.ReadFile(filepath.Join(store.dir, "library.backup.json"))
	if err != nil || string(backup) != firstLibrary {
		t.Fatalf("backup = %q, %v", backup, err)
	}
}

func TestDefaultDataDirOverride(t *testing.T) {
	want := filepath.Join(t.TempDir(), "isolated")
	t.Setenv("NEXOR_DATA_DIR", want)
	got, err := DefaultDataDir()
	if err != nil || got != want {
		t.Fatalf("data dir = %q, %v", got, err)
	}
}

func TestConcurrentSavesRemainValid(t *testing.T) {
	store := New(t.TempDir())
	values := []string{firstLibrary, secondLibrary}
	var group sync.WaitGroup
	for _, value := range values {
		group.Add(1)
		go func() {
			defer group.Done()
			if err := store.Save(value); err != nil {
				t.Errorf("save: %v", err)
			}
		}()
	}
	group.Wait()
	got, err := store.Load()
	if err != nil || (got != firstLibrary && got != secondLibrary) {
		t.Fatalf("serialized load = %q, %v", got, err)
	}
}

// §3 failure tests
func TestCorruptLibraryIsReportedAndNotReplaced(t *testing.T) {
	store := New(t.TempDir())
	if err := store.Save(firstLibrary); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store.LibraryPath(), []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Load(); err == nil || !strings.Contains(err.Error(), "corrupt") {
		t.Fatalf("expected corruption error, got %v", err)
	}
	if err := store.Save("not json"); err == nil {
		t.Fatal("invalid save succeeded")
	}
	got, _ := os.ReadFile(store.LibraryPath())
	if string(got) != "{" {
		t.Fatalf("corrupt file was overwritten: %q", got)
	}
}

func TestSaveRejectsWrongSchemaAndUnwritableLocation(t *testing.T) {
	if err := New(t.TempDir()).Save(`{"schemaVersion":2}`); err == nil {
		t.Fatal("wrong schema accepted")
	}
	blocker := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocker, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := New(filepath.Join(blocker, "child")).Save(firstLibrary); err == nil {
		t.Fatal("write failure was not returned")
	}
}

func TestBackupFailurePreservesCurrentLibrary(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "library.json")
	backup := filepath.Join(dir, "blocked-backup")
	if err := os.WriteFile(target, []byte(firstLibrary), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(backup, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := replaceFile(target, backup, []byte(secondLibrary)); err == nil {
		t.Fatal("replacement unexpectedly succeeded")
	}
	got, err := os.ReadFile(target)
	if err != nil || string(got) != firstLibrary {
		t.Fatalf("current library changed after failure: %q, %v", got, err)
	}
}
