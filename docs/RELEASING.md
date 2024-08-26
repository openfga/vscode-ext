# Release Process

## Bump version number

- Update the `version` number in `package.json`
- Run `npm install` to update `package-lock.json`

## Update the CHANGELOG

You will need to;
- update the [CHANGELOG.md](/CHANGELOG.md)

## When ready, push a new tag

`git tag -a -s v[0-9]+.[0-9]+.[0-9]+`
