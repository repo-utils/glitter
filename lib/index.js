
var fs = require('mz/fs')
var path = require('path')
var assert = require('assert')
var semver = require('semver')
var mkdirp = require('mkdirp')
var cp = require('mz/child_process')
var debug = require('debug')('glitter')

var sh = cp.exec
var exec = cp.execFile

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

  /**
   * Remote operations do not require `cwd`.
   * You'd want to execute local operations after
   * `.folder` has been created otherwise you'll
   * get ENOENT errors, so `yield glitter.install()`
   */

  this.remoteexecopts = {
    encoding: 'utf8'
  }
  this.localexecopts = {
    encoding: 'utf8',
    cwd: this.folder,
  }
}

/**
 * Always run this before you do any local commands.
 *
 *   yield glitter.install()
 *   var versions = yield glitter.getVersions()
 */

Glitter.prototype.install = function () {
  this.installed = true
  var self = this
  var hash = 'install:' + this.folder
  // installation already in progress
  if (progress[hash]) return progress[hash]
  // if it's already installed, don't do anything
  return fs.stat(this.gitfolder).then(isFolder, returnFalse).then(function (val) {
    // already installed, don't do anything
    if (val) return
    // that was async, so we check if an install is in progress
    if (progress[hash]) return progress[hash]
    // actually install now
    return progress[hash] = exec('git', [
      'clone',
      '--recursive',
      '--no-checkout',
      self.url,
      self.folder,
    ]).then(fin, fin)

    function fin(err) {
      delete progress[hash]
      if (err instanceof Error) {
        if (/\brepository not found\b/i.test(err.message)) err.status = 404
        // i get 403s sometimes on missing repos without any auth, i.e. on travis
        else if (/\binvalid username or password\b/i.test(err.message)) err.status = 403
        throw err
      }
    }
  })
}

function isFolder(stats) {
  return stats.isDirectory()
}

function returnFalse() {
  return false
}

/**
 * Do a `git pull -f` on the repo and update all the local references.
 * You __must__ run `.install()` before running this.
 */

Glitter.prototype.update = function () {
  assert(this.installed)
  var hash = 'update:' + this.folder
  if (progress[hash]) return progress[hash]
  return progress[hash] = exec('git', ['fetch', '-f', '--all'], this.localexecopts)
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

/**
 * Lookup a commit sha via reference.
 * You must __always__ run `.install()` prior.
 */

Glitter.prototype.show = function (reference, remote) {
  assert(this.installed)
  var self = this
  var promise = exec('git', [
    'rev-parse',
    reference
  ], remote
    ? this.remoteexecopts
    : this.localexecopts
  ).then(parseRevSha)
  if (!remote) return promise
  return promise.catch(function () {
    return self.update().then(function () {
      return self.show(reference, false)
    })
  })
}

// not sure what's going on here
function parseRevSha(x) {
  return x.shift().trim()
}

// untar to a folder
Glitter.prototype.copy = function (reference, folder) {
  assert(this.installed)
  var cmd = 'mkdir -p ' + folder + ';'
    + 'git archive ' + reference + ' | '
    + 'tar -x -C ' + folder
  debug('cmd: %s', cmd)
  return sh(cmd, this.localexecopts)
}

Glitter.prototype.getReferences = function (reference, remote) {
  if (typeof reference === 'boolean') {
    remote = reference
    reference = null
  }
  if (!remote) assert(this.installed)
  var args = remote ? ['ls-remote', this.url] : ['show-ref']
  if (typeof reference === 'string') args.push(reference)
  debug('cmd: %o', args)
  return exec('git', args, remote
    ? this.remoteexecopts
    : this.localexecopts
  ).then(parseReferences)
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
  return this.getReferences(null, remote).then(returnBranchesFromReferences)
}

function returnBranchesFromReferences(refs) {
  return refs.heads
}

Glitter.prototype.getTags = function (remote) {
  return this.getReferences(null, remote).then(returnTagsFromReferences)
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
