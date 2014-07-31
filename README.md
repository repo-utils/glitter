
# glitter

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Gittip][gittip-image]][gittip-url]

A utility to interact with remote repositories seamlessly.
Supports fetching remotes, getting references/tags/branches
from either the remote or the local copy, and copying files.
The purpose of this is as a basis for [normalize-proxy](https://github.com/normalize/proxy.js)
and perhaps could be used for any package management utility.

## API

### Glitter.folder

Where the repositories are cloned to.

### var glitter = new Glitter(remote, user, repo)

Create a new instance. Currently supported remotes are:

- `github` - set your optional GitHub credentials as the `GLITTER_GITHUB` environmental variable

### glitter.install().then( => )

`git clone`

Clone the remote repository locally.
Does not check whether the repository has already been cloned.

### glitter.isInstall().then( !!installed => )

Checks whether a repository is installed.

### glitter.update().then( !!updated => )

`git fetch -f --all`

Update all the branches and references of the local copy.
`updated` is whether any references were updated.

### glitter.show(reference, remote).then( hash'' => )

`git show`

Lookup a commit sha from a reference.
If `remote` is true, will `.update()` from the origin if no references are found.
This requires a local copy of the repository to be installed.

### glitter.copy(reference, folder).then( => )

`git archive <reference> | tar -x -C <folder>`

Copy the repository at `reference` to `folder`.
Requires a local copy.

### glitter.getReferences(remote).then( [refs] => )

`git ls-remote` and `git show-ref`

Gets all `HEAD` and tag references,
References is an array of references of the form `[<name>, <commit sha>]`.
If `remote` is true, gets the references directly from the remote.

### glitter.getHeads(remote).then( [refs] => )

`.getReferences(remote)`, but only HEAD references are returned.

### glitter.getTags(remote).then( [refs] => )

`.getReferences(remote)`, but only tags are returned.

### glitter.getVersions(loose, remote).then( [versions] => )

`.getTags(remote)`, except only valid semantic versions are returned.
Optionally, you may return only `loose` semantic versions.

[npm-image]: https://img.shields.io/npm/v/glitter.svg?style=flat
[npm-url]: https://npmjs.org/package/glitter
[travis-image]: https://img.shields.io/travis/repo-utils/glitter.svg?style=flat
[travis-url]: https://travis-ci.org/repo-utils/glitter
[coveralls-image]: https://img.shields.io/coveralls/repo-utils/glitter.svg?style=flat
[coveralls-url]: https://coveralls.io/r/repo-utils/glitter?branch=master
[gittip-image]: https://img.shields.io/gittip/jonathanong.svg?style=flat
[gittip-url]: https://www.gittip.com/jonathanong/
