package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:                    "Sentinel Secure Connect",
		Width:                    980,
		Height:                   760,
		MinWidth:                 680,
		MinHeight:                600,
		Frameless:        true,
		BackgroundColour: &options.RGBA{R: 5, G: 7, B: 14, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:   false,
			DisableWindowIcon:     false,
			Theme:                 windows.Dark,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
