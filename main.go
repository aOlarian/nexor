// MAP
// §1 imports and assets       L6-L24
// §2 application entrypoint   L25-L64
package main

// §1 imports and assets
import (
	"embed"
	"io/fs"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	winoptions "github.com/wailsapp/wails/v2/pkg/options/windows"
	"nexor/storage"
)

//go:embed all:frontend
var assets embed.FS

// §2 application entrypoint
func main() {
	dataDir, err := storage.DefaultDataDir()
	if err != nil {
		log.Fatal(err)
	}
	app := NewApp(storage.New(dataDir), nil)
	frontendAssets, err := fs.Sub(assets, "frontend")
	if err != nil {
		log.Fatal(err)
	}
	if err := wails.Run(&options.App{
		Title:         "Nexor",
		Width:         1440,
		Height:        900,
		MinWidth:      960,
		MinHeight:     640,
		AssetServer:   &assetserver.Options{Assets: frontendAssets},
		Windows:       &winoptions.Options{WebviewUserDataPath: webviewDataDir(dataDir)},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		Bind:          []interface{}{app},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "com.verobots.nexor.desktop",
		},
	}); err != nil {
		log.Fatal(err)
	}
}

func webviewDataDir(dataDir string) string {
	if override := os.Getenv("WEBVIEW2_USER_DATA_FOLDER"); override != "" {
		return filepath.Clean(override)
	}
	return filepath.Join(dataDir, "webview")
}
