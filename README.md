# Nexor

A local Windows editor for project maps and workflows. Draw nodes and connections, group related items, and export your work as JSON for sharing and backups. Maps are stored on your device.

## Get started

1. Download the Windows installer from [Releases](../../releases) and run it. Open Nexor from Start. Microsoft Edge WebView2 Runtime is required.
2. Open the example map, or create a project. Add a node, then drag a connection from one of its ports to another node.
3. Save your work, and use the export action to write a copy as JSON. The import action can open a map from a different library.

## Build and test

Use Windows, Go and Node.js. The desktop binary embeds the frontend assets.

```powershell
go test ./...
npm --prefix frontend test
go build -tags desktop,production -trimpath -ldflags '-H windowsgui' -o Nexor.exe .
makensis install.nsi
```

## License

[MIT](LICENSE). The bundled Wails runtime includes its [license](WAILS-LICENSE.txt). WebView2 is distributed separately under Microsoft's terms.
