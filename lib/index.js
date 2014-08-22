
var fs = require('mz/fs')
var path = require('path')
var assert = require('assert')
var semver = require('semver')
var mkdirp = require('mkdirp')
var debug = require('debug')('glitter')
var sh = require('mz/child_process').exec
var Promise = require('native-or-bluebird')
var exec = require('mz/child_process').execFile

module.exports = Glitter

// folder where all the repositories are stored
// make sure you mkdirp this directory yourself
// stored as <folder>/<remote>/<user>/<repo>
Glitter.folder = path.resolve('cache/glitter')
mkdirp.sync(Glitter.folder)
Glitter.clean = function () {
  require('rimraf').sync(Glitter.folder)
  mkdirp.sync(Glitter.folder)
}

// all the supported remotes
Glitter.remotes = require('./remotes')

var progress = Object.create(null)

function Glitter(remote, user, repo) {
  if (!(this instanceof Glitter)) return new Glitter(remote, user, repo)

  if (typeof remote === 'string') {
    assert(this.remote = Glitter.remotes[remote], 'unsupported remote: "' + remote + '"')
  } else {
    this.remote = remote
  }

  // cache folder
  this.folder = path.join(Glitter.folder, this.remote.name, user, repo)
  // location of .git folder
  this.gitfolder = path.join(this.folder, '.git')
  // the remote url
  this.url = this.remote.url(user, repo)

  var self = this
  var opts =  this.execopts = { // default options passed to exec
    encoding: 'utf8',
  }

  // always create the folder otherwise we'll get ENOENTs
  // to avoid a race condition, just always run `.isInstalled()` and `.install()`
  mkdirp(this.folder, function () {
    opts.cwd = self.folder
  })
}

// check whether the repo is installed locally
// glitter doesn't support you deleting repositories
// during runtime!
Glitter.prototype.isInstalled = function () {
  if (this._isInstalled) return Promise.resolve(true)
  var hash = 'is-installed:' + this.folder
  if (progress[hash]) return progress[hash]
  var self = this
  return progress[hash] = fs.stat(this.gitfolder)
    .then(isFolder, returnFalse)
    .then(function (val) {
      delete progress[hash]
      return self._isInstalled = val
    })
}

function isFolder(stats) {
  return stats.isDirectory()
}

function returnFalse() {
  return false
}

// install the repo locally
Glitter.prototype.install = function () {
  if (this._isInstalled) return Promise.resolve(true)
  var hash = 'install:' + this.folder
  if (progress[hash]) return progress[hash]
  return progress[hash]  = exec('git', [
    'clone',
    '--recursive',
    '--no-checkout',
    this.url,
    this.folder,
  ]).then(fin, fin)

  function fin(err) {
    delete progress[hash]
    if (err instanceof Error) throw err
  }
}

// do a `git pull -f` on the repo and update all the local references
Glitter.prototype.update = function () {
  var hash = 'update:' + this.folder
  if (progress[hash]) return progress[hash]
  return progress[hash] = exec('git', ['fetch', '-f', '--all'], this.execopts)
    .then(parseFetch)
    .then(fin, fin)

  function fin(val) {
    delete progress[hash]
    if (val instanceof Error) throw val
    return val
  }
}

// check whether a fetch did anything
// if nothing was updated, it should say "Everything up to date" instead
function parseFetch(out) {
  out = out.shift().trim().replace(/^Fetching origin\s*/, '')
  return !!out
}

// lookup a commit sha via reference
Glitter.prototype.show = function (reference, remote) {
  var self = this
  var promise = exec('git', ['show', '--quiet', reference], this.execopts).then(parseShowHash)
  if (!remote) return promise
  return promise.catch(function () {
    return self.update().then(function () {
      return self.show(reference, false)
    })
  })
}

// untar to a folder
Glitter.prototype.copy = function (reference, folder) {
  var cmd = 'mkdir -p ' + folder + ';'
    + 'git archive ' + reference + ' | '
    + 'tar -x -C ' + folder
  debug('cmd: %s, %o', cmd, this.execopts)
  return sh(cmd, this.execopts)
}

// only returns the first one
function parseShowHash(out) {
  var m = /commit ([a-z0-9]{40})/.exec(out)
  if (m) return m[1]
}

Glitter.prototype.getReferences = function (reference, remote) {
  if (typeof reference === 'boolean') {
    remote = reference
    reference = null
  }
  var args = remote ? ['ls-remote', this.url] : ['show-ref']
  if (typeof reference === 'string') args.push(reference)
  debug('cmd: %o, %o', args, this.execopts)
  return exec('git', args, this.execopts).then(parseReferences)
}

function parseReferences(out) {
  var references = {
    tags: [],
    heads: [],
  }

  out.shift().trim().split('\n').filter(Boolean).forEach(function (line) {
    var stuff = line.split(/\s+/)
    var ref = stuff[1]
    if (ref === 'HEAD') return // ignore HEAD
    var m = /^refs\/(tags|heads)\/(.*)$/.exec(ref)
    if (!m) return
    var type = m[1]
    var name = m[2]
    if (~name.indexOf('^{}')) return // wtf are these???
    references[type].push([name, stuff[0] /* sha */])
  })

  return references
}

Glitter.prototype.getBranches =
Glitter.prototype.getHeads = function (remote) {
  return this.getReferences(remote).then(returnBranchesFromReferences)
}

function returnBranchesFromReferences(refs) {
  return refs.heads
}

Glitter.prototype.getTags = function (remote) {
  return this.getReferences(remote).then(returnTagsFromReferences)
}

function returnTagsFromReferences(refs) {
  return refs.tags
}

Glitter.prototype.getVersions = function (remote) {
  return this.getTags(remote).then(tagsToVersions)
}

Glitter.prototype.getMaxSatisfying = function (range, remote) {
  return this.getVersions(remote).then(function (tags) {
    var version = semver.maxSatisfying(tags.map(toVersion), range)
    // no satisfying
    if (!version) return null
    for (var i = 0; i < tags.length; i++)
      if (tags[i][0] === version)
        return tags[i]
  })
}

function toVersion(tag) {
  return tag[0]
}

function tagsToVersions(tags) {
  return tags.filter(validVersion).sort(rcompare)
}

function validVersion(tag) {
  return semver.valid(tag[0])
}

function rcompare(a, b) {
  return semver.rcompare(a[0], b[0])
}
