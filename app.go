// MAP
// §1 imports and state    L7-L37
// §2 lifecycle            L38-L78
// §3 frontend bindings    L79-L154
package main

// §1 imports and state
import (
	"context"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"nexor/storage"
	"nexor/syncbridge"
)

type App struct {
	ctx          context.Context
	store        *storage.Store
	sync         *syncbridge.Bridge
	closeAllowed atomic.Bool
	closePending atomic.Bool
}

const closeFallbackDelay = 5 * time.Second

func NewApp(store *storage.Store, bridges ...*syncbridge.Bridge) *App {
	app := &App{store: store}
	if len(bridges) > 0 {
		app.sync = bridges[0]
	}
	return app
}

// §2 lifecycle
func (a *App) startup(ctx context.Context) { a.ctx = ctx }

func (a *App) beforeClose(ctx context.Context) bool {
	if a.closeAllowed.Load() {
		return false
	}
	if !a.closePending.CompareAndSwap(false, true) {
		return true
	}
	runtime.EventsEmit(ctx, "nexor:before-close")
	go a.offerCloseFallback(ctx)
	return true
}

func (a *App) offerCloseFallback(ctx context.Context) {
	timer := time.NewTimer(closeFallbackDelay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return
	case <-timer.C:
	}
	if a.closeAllowed.Load() {
		return
	}
	choice, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Nexor nu a putut confirma salvarea",
		Message:       "Interfața nu a răspuns. Închizi aplicația fără confirmarea salvării?",
		Buttons:       []string{"Rămâi", "Închide fără salvare"},
		DefaultButton: "Rămâi",
		CancelButton:  "Rămâi",
	})
	if err == nil && choice == "Închide fără salvare" {
		a.ConfirmClose()
		return
	}
	a.closePending.Store(false)
}

// §3 frontend bindings
func (a *App) LoadLibrary() (string, error) { return a.store.Load() }

func (a *App) SaveLibrary(text string) error {
	if err := a.store.Save(text); err != nil {
		return err
	}
	if a.sync != nil {
		return a.sync.PublishLibrary(text)
	}
	return nil
}

func (a *App) PublishSyncState(text string) error {
	if a.sync == nil {
		return nil
	}
	return a.sync.PublishLibrary(text)
}

func (a *App) ListSyncChanges() ([]syncbridge.ChangeFile, error) {
	if a.sync == nil {
		return []syncbridge.ChangeFile{}, nil
	}
	return a.sync.Pending()
}

func (a *App) CompleteSyncChange(name, status, reason string) error {
	if a.sync == nil {
		return nil
	}
	return a.sync.Complete(name, status, reason)
}

func (a *App) SyncDirectory() string {
	if a.sync == nil {
		return ""
	}
	return a.sync.Directory()
}

func (a *App) ConfirmClose() {
	a.closeAllowed.Store(true)
	runtime.Quit(a.ctx)
}

func (a *App) ExportJSON(text, title string) (string, error) {
	if err := storage.ValidateLibrary([]byte(text)); err != nil {
		return "", err
	}
	safeTitle := strings.TrimSpace(title)
	if safeTitle == "" {
		safeTitle = "proiect"
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Exportă proiectul Nexor",
		DefaultFilename: safeFilename(safeTitle) + ".json",
		Filters:         []runtime.FileFilter{{DisplayName: "Fișier JSON (*.json)", Pattern: "*.json"}},
	})
	if err != nil || path == "" {
		return path, err
	}
	if err := storage.WriteExport(path, []byte(text)); err != nil {
		return "", fmt.Errorf("export JSON: %w", err)
	}
	return path, nil
}

func safeFilename(title string) string {
	return strings.Map(func(r rune) rune {
		if strings.ContainsRune(`<>:"/\\|?*`, r) || r < 32 {
			return '-'
		}
		return r
	}, title)
}
