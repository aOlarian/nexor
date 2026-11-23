// MAP
// §1 imports              L8-L9
// §2 atomic replacement   L11-L22
//go:build windows

package storage

// §1 imports
import "golang.org/x/sys/windows"

// §2 atomic replacement
func installReplacement(source, target string) error {
	from, err := windows.UTF16PtrFromString(source)
	if err != nil {
		return err
	}
	to, err := windows.UTF16PtrFromString(target)
	if err != nil {
		return err
	}
	return windows.MoveFileEx(from, to, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH)
}
