
var fs = require('mz/fs')
var path = require('path')
var assert = require('assert')
var semver = require('semver')
var debug = require('debug')('glitter')
var sh = require('mz/child_process').exec
var Promise = require('native-or-bluebird')
var exec = require('mz/child_process').execFile

module.exports = Glitter

// folder where all the repositories are stored
// make sure you mkdirp this directory yourself
// stored as <folder>/<remote>/<user>/<repo>
Glitter.folder = path.resolve('cache/glitter')
Glitter.clean = function (rimraf) {
  if (rimraf !== false) require('rimraf').sync(Glitter.folder)
  require('mkdirp').sync(Glitter.folder)
}
Glitter.clean(false)

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

  this.folder = path.join(Glitter.folder, this.remote.name, user, repo)
  this.gitfolder = path.join(this.folder, '.git')
  this.url = this.remote.url(user, repo)

  this.execopts = { // default options passed to exec
    cwd: this.folder,
    encoding: 'utf8',
  }
}

// check whether the repo is installed locally
// this needs to be more robust
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
  return progress[hash]  = exec('git', ['clone', '--recursive', '--no-checkout', this.url, this.folder]).then(fin, fin)
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

Glitter.prototype.copy = function (reference, folder) {
  return sh('mkdir -p ' + folder + ';'
    + 'git archive ' + reference + ' | '
    + 'tar -x -C ' + folder, this.execopts)
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

Glitter.prototype.getVersions = function (loose, remote) {
  return this.getTags(remote).then(function (tags) {
    return tags.map(toTagName).filter(function (version) {
      return semver.valid(version, loose)
    }).sort(semver.rcompare) // descending versions
  })
}

function toTagName(x) {
  return x[0]
}
