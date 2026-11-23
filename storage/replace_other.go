// MAP
// §1 atomic replacement L9-L10
//go:build !windows

package storage

import "os"

// §1 atomic replacement
func installReplacement(source, target string) error { return os.Rename(source, target) }
