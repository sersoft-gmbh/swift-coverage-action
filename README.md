# Xcode Coverage Conversion

[![Tests](https://github.com/sersoft-gmbh/xcode-coverage-action/actions/workflows/tests.yml/badge.svg)](https://github.com/sersoft-gmbh/-coverage-action/actions/workflows/tsts.yml)

This action converts code coverage files from xcodebuild runs for processing with e.g. codecov.
Note that this action does not run any test. Use `xcodebuild` or [xcodebuild-action](https://github.com/sersoft-gmbh/xcodebuild-action) for that.

## Inputs

### `derived-data`

The path to Xcode's Derived Data folder.<br/>
Default: `$HOME/Library/Developer/Xcode/DerivedData`

### `output`

The path to the output folder. Note that this folder will be deleted / overwritten by this action.
You should probably put it in `.gitignore`.<br/>
Default: `./.xcodecov`

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

Use the following snippet after running tests with Xcode and coverage to convert those coverage files:
```yaml
uses: sersoft-gmbh/xcode-coverage-action@v1
```
