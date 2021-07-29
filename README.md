# Swift Coverage Conversion

[![Tests](https://github.com/sersoft-gmbh/swift-coverage-action/actions/workflows/tests.yml/badge.svg)](https://github.com/sersoft-gmbh/swift-coverage-action/actions/workflows/tests.yml)

This action converts code coverage files from `swift test` or `xcodebuild` runs for processing with e.g. codecov.
Note that this action does not run any test. Use `swift test`, `xcodebuild` or [xcodebuild-action](https://github.com/sersoft-gmbh/xcodebuild-action) for that.

## Inputs

### `search-paths`

A list of search paths (one per line) that should be used for searching coverage data.<br/>
Default: 
```
./.build
$HOME/Library/Developer/Xcode/DerivedData
```

### `output`

The path to the output folder. Note that this folder will be deleted / overwritten by this action.
You should probably put it in `.gitignore`.<br/>
Default: `./.swiftcov`

### `format`

The format to write the coverage files in. Can be 'txt' or 'lcov'.<br/>
Default: `txt`

### `target-name-filter`

A regular expression that is used to filter coverage files by their target names.

### `ignore-conversion-failures`

If `true`, conversion failures are ignored. If `fail-on-empty-output` is also set to `true`, the action might still fail if all conversions fail.<br/>
Default: `'false'`

### `fail-on-empty-output`

If `true`, the action fails if no coverage files were found (output is still set to an empty array).<br/>
Default: `'false'`

## Outputs

### `files`

The JSON encoded array of (absolute) file paths that were written. They are all contained inside the directory specified in the `output` input.

## Example Usage

Use the following snippet after running tests with Swift or Xcode to convert those coverage files:
```yaml
uses: sersoft-gmbh/swift-coverage-action@v2
```
