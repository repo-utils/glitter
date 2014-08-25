
# glitter

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]
[![Gittip][gittip-image]][gittip-url]

A utility to interact with remote repositories seamlessly.
Supports fetching remotes, getting references/tags/branches
from either the remote or the local copy, and copying files.

## Adding Custom Remotes

By default, this library supports `GitHub` and `BitBucket` git remotes.
Adding remotes is pretty trivial since all it really needs is a URL.

First you need to create a custom remote object.
View [lib/remotes/github.js](lib/remotes/github.js) for an example.
All it needs is a `.name` and a `.url( user, repo => URL)` function.

Then you need to set this remote to `glitter.remotes[name]=`.
See [lib/remotes/index.js](lib/remotes/index.js).
For example:

```js
var local = {
  name: 'local',
  url: function (user, repo) {
    // ignores the `user` field,
    // though you could optionally just use the `user` field
    // as the repo.
    return 'https://localhost:8080/' + repo;
  }
};

Glitter.remotes.local =
Glitter.remotes.someAlias = local;

var glitter = Glitter('local', null, 'module');
```

And you're set!

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

### glitter.getVersions(remote).then( [versions] => )

`.getTags(remote)`, except only valid semantic versions are returned.
It returns an array of `[<tag>, <sha>]`.

### glitter.getMaxSatisfying(range, remote).then( version => )

Same like `.getVersions()`, but you pass a semver range,
and it will return the max satisfying range.
It returns a single `[<tag>, <sha>]` unless `null`.

[npm-image]: https://img.shields.io/npm/v/glitter.svg?style=flat-square
[npm-url]: https://npmjs.org/package/glitter
[github-tag]: http://img.shields.io/github/tag/repo-utils/glitter.svg?style=flat-square
[github-url]: https://github.com/repo-utils/glitter/tags
[travis-image]: https://img.shields.io/travis/repo-utils/glitter.svg?style=flat-square
[travis-url]: https://travis-ci.org/repo-utils/glitter
[coveralls-image]: https://img.shields.io/coveralls/repo-utils/glitter.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/repo-utils/glitter?branch=master
[david-image]: http://img.shields.io/david/repo-utils/glitter.svg?style=flat-square
[david-url]: https://david-dm.org/repo-utils/glitter
[license-image]: http://img.shields.io/npm/l/glitter.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/glitter.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/glitter
[gittip-image]: https://img.shields.io/gittip/jonathanong.svg?style=flat-square
[gittip-url]: https://www.gittip.com/jonathanong/
