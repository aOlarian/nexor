// MAP
// §1 filename tests L15-L24
// §2 sync bindings L25-L50
package main

import (
	"os"
	"path/filepath"
	"testing"

	"nexor/storage"
	"nexor/syncbridge"
)

// §1 filename tests
func TestSafeFilename(t *testing.T) {
	if got := safeFilename(`plan: 2026/09`); got != "plan- 2026-09" {
		t.Fatalf("safe filename = %q", got)
	}
	if got := safeFilename(`plan?.json`); got != "plan-.json" {
		t.Fatalf("safe filename = %q", got)
	}
}

// §2 sync bindings
func TestSyncBindings(t *testing.T) {
	dataDir, syncDir := t.TempDir(), t.TempDir()
	app := NewApp(storage.New(dataDir), syncbridge.New(syncDir))
	library := `{"schemaVersion":1,"activeProjectId":"","projects":[]}`
	if err := app.SaveLibrary(library); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(syncDir, "state", "library.json")); err != nil {
		t.Fatal(err)
	}
	name := "change.json"
	if err := os.WriteFile(filepath.Join(syncDir, "pending", name), []byte(`{"schemaVersion":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	changes, err := app.ListSyncChanges()
	if err != nil || len(changes) != 1 {
		t.Fatalf("changes = %#v, %v", changes, err)
	}
	if err := app.CompleteSyncChange(name, "applied", ""); err != nil {
		t.Fatal(err)
	}
	if app.SyncDirectory() != syncDir {
		t.Fatalf("sync directory = %q", app.SyncDirectory())
	}
}
