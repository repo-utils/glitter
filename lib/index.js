
var fs = require('mz/fs')
var path = require('path')
var assert = require('assert')
var semver = require('semver')
var sh = require('mz/child_process').exec
var exec = require('mz/child_process').execFile

module.exports = Glitter

// folder where all the repositories are stored
// make sure you mkdirp this directory yourself
// stored as <folder>/<remote>/<user>/<repo>
Glitter.folder = path.join(__dirname, '..', 'cache')

// all the supported remotes
Glitter.remotes = require('./remotes')

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

  this._unsetInstallPromise = this._unsetInstallPromise.bind(this)
}

// check whether the repo is installed locally
// this needs to be more robust
Glitter.prototype.isInstalled = function () {
  return fs.stat(this.gitfolder).then(isFolder, returnFalse)
}

function isFolder(stats) {
  return stats.isDirectory()
}

function returnFalse() {
  return false
}

// install the repo locally
Glitter.prototype.install = function () {
  // we keep the install promise for race conditions
  if (this._installPromise) return this._installPromise
  var promise =
  this._installPromise = exec('git', ['clone', '--recursive', this.url, this.folder])
  var unset = this._unsetInstallPromise
  return promise.then(unset, unset)
}

Glitter.prototype._unsetInstallPromise = function () {
  this._installPromise = null
}

// do a `git pull -f` on the repo and update all the local references
Glitter.prototype.update = function () {
  return exec('git', ['fetch', '-f', '--all'], this.execopts).then(parseFetch)
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
  if (remote) promise.catch(function () {
    return self.update().then(function () {
      return self.show(reference, false)
    })
  })
  return promise
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

Glitter.prototype.getVersions = function (remote, strict) {
  return this.getTags(remote).then(function (tags) {
    return tags.map(toTagName).filter(function (version) {
      return semver.valid(version, strict)
    }).sort(semver.rcompare) // descending versions
  })
}

function toTagName(x) {
  return x[0]
}
