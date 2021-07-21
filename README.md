# Xcode Coverage Conversion

[![Deploy](https://github.com/sersoft-gmbh/xcode-coverage-action/actions/workflows/main-deploy.yml/badge.svg)](https://github.com/sersoft-gmbh/-coverage-action/actions/workflows/main-deploy.yml)

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

## Example Usage

Use the following snippet after running tests with Xcode and coverage to convert those coverage files:
```yaml
uses: sersoft-gmbh/xcode-coverage-action@v1
```
