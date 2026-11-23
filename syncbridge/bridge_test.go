// MAP
// §1 bridge lifecycle L11-L58
package syncbridge

import (
	"os"
	"path/filepath"
	"testing"
)

// §1 bridge lifecycle
const validLibrary = `{"schemaVersion":1,"activeProjectId":"","theme":"light","sidebarWidth":270,"categories":[],"projects":[]}`

func TestPublishPendingAndComplete(t *testing.T) {
	dir := t.TempDir()
	bridge := New(dir)
	if err := bridge.PublishLibrary(validLibrary); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "state", "library.json")); err != nil {
		t.Fatal(err)
	}
	pending := filepath.Join(dir, "pending", "001-change.json")
	if err := os.WriteFile(pending, []byte(`{"schemaVersion":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	changes, err := bridge.Pending()
	if err != nil || len(changes) != 1 || changes[0].Name != "001-change.json" {
		t.Fatalf("pending = %#v, %v", changes, err)
	}
	if err := bridge.Complete(changes[0].Name, "applied", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "applied", changes[0].Name)); err != nil {
		t.Fatal(err)
	}
}

func TestRejectAndTraversalProtection(t *testing.T) {
	dir := t.TempDir()
	bridge := New(dir)
	if err := bridge.Ensure(); err != nil {
		t.Fatal(err)
	}
	name := "bad.json"
	if err := os.WriteFile(filepath.Join(dir, "pending", name), []byte(`{`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := bridge.Complete(name, "rejected", "invalid JSON"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "rejected", name+".error.txt")); err != nil {
		t.Fatal(err)
	}
	if err := bridge.Complete(`..\library.json`, "applied", ""); err == nil {
		t.Fatal("path traversal was accepted")
	}
}
