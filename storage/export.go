// MAP
// §1 public validation  L6-L8
// §2 export writer      L9-L15
package storage

// §1 public validation
func ValidateLibrary(data []byte) error { return validate(data) }

// §2 export writer
func WriteExport(path string, data []byte) error {
	if err := validate(data); err != nil {
		return err
	}
	return replaceFile(path, path+".backup", data)
}
