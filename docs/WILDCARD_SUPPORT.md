# Wildcard Module Path Support

This document outlines the wildcard module path support implementation for the OpenFGA VS Code extension.

## Overview

The extension now supports wildcard patterns in `fga.mod` files, allowing you to include multiple module files using glob patterns like `model/**/*.fga`.

## Features Implemented

1. **Wildcard Pattern Resolution**: The extension can resolve glob patterns in fga.mod contents to actual file paths
2. **File Watching**: The existing file watcher automatically detects when new .fga files are added that match wildcard patterns
3. **Cross-Platform Support**: Works in both Node.js and browser environments (with limitations in browser)

## Example Usage

### fga.mod with wildcards:
```yaml
schema: '1.2'
contents:
  - model/core.fga
  - model/**/*.fga
```

This will include:
- `model/core.fga` (explicit file)
- All `.fga` files recursively under the `model/` directory

### File Structure:
```
project/
├── fga.mod
└── model/
    ├── core.fga
    ├── jira/
    │   ├── projects.fga
    │   └── tickets.fga
    └── confluence/
        └── pages.fga
```

## Implementation Details

### Server-side Changes:
- `server.common.ts`: Added `resolveWildcardPatterns` function parameter to `startServer`
- `wildcard-utils.node.ts`: Node.js implementation using the `glob` library
- `wildcard-utils.browser.ts`: Browser fallback (limited wildcard support)
- `validateFgaMod`: Updated to resolve wildcards before processing files

### Client-side Changes:
- `extension.common.ts`: Added glob support for the transform command
- `extension.node.ts`: Pass glob function to transform command

### File Watching:
- Existing pattern `**/?(fga.mod|*.{fga.yaml,fga,openfga,openfga.yaml,yaml,json,csv})` already watches for .fga files
- When new files are added, the language server automatically revalidates all open documents

## Testing

Test cases include:
1. Basic wildcard pattern resolution
2. Recursive directory matching
3. Mixed explicit and wildcard patterns
4. Error handling for invalid patterns

## Limitations

1. **Browser Environment**: Full wildcard support requires Node.js environment; browser version treats wildcards as literal filenames
2. **Performance**: Large directory trees with many files may impact performance
3. **Pattern Syntax**: Uses Node.js glob patterns, following standard glob syntax

## Future Enhancements

1. **Enhanced File Watching**: Could add more intelligent watching of directories that match wildcard patterns
2. **Pattern Validation**: Could validate glob patterns in fga.mod files
3. **Performance Optimization**: Could cache wildcard resolution results