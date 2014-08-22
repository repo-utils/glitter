
var fs = require('fs')
var path = require('path')
var assert = require('assert')
var Promise = require('native-or-bluebird')

var Glitter = require('..')
var out = path.join(__dirname, '..', 'cache2')

Glitter.clean()

describe('Glitter', function () {
  describe('GitHub', function () {
    var glitter

    describe('glitter(remove, user, repo)', function () {
      it('.folder, .url', function () {
        glitter = Glitter('gh', 'jonathanong', 'routington')
        assert(glitter.folder)
        assert(glitter.url)
      })

      describe('.install()', function () {
        it('should support double .then()s', function () {
          glitter.install().then(function () {
            assert(fs.existsSync(glitter.folder))
          })

          return glitter.install().then(function () {
            return new Promise(function (resolve) {
              process.nextTick(function () {
                assert(!glitter._installPromise)
                resolve()
              })
            })
          })
        })
      })

      describe('.isInstalled()', function () {
        it('should return true if installed', function () {
          return glitter.isInstalled().then(function (yes) {
            assert(yes)
          })
        })

        it('should return false if not installed', function () {
          return Glitter('gh', 'klajsdlkfjasdf', 'alkjalksdjf').isInstalled(function (yes) {
            assert(!yes)
          })
        })
      })

      describe('.update()', function () {
        it('should return false when there are no updates', function () {
          return glitter.update().then(function (updates) {
            assert(!updates)
          })
        })
      })

      describe('.show', function () {
        it('(sha, remote=false)', function () {
          return glitter.show('08c7518caf83').then(function (sha) {
            assert.equal('08c7518caf831f10c667e91e978c5103349bfd7f', sha)
          })
        })

        it('(branch, remote=false)', function () {
          return glitter.show('master').then(function (sha) {
            assert(/^[a-z0-9]{40}$/.test(sha))
          })
        })

        it('(sha, remote=true)', function () {
          return glitter.show('08c7518caf83', true).then(function (sha) {
            assert.equal('08c7518caf831f10c667e91e978c5103349bfd7f', sha)
          })
        })

        it('(branch, remote=true)', function () {
          return glitter.show('master', true).then(function (sha) {
            assert(/^[a-z0-9]{40}$/.test(sha))
          })
        })

        it('(sha, remote=false) missing', function () {
          // throws an error
          return glitter.show('abcabcabcabc', false).then(function () {
            assert(false)
          }, function () {})
        })

        it('(sha, remote=true) missing', function () {
          // throws an error
          return glitter.show('abcabcabcabc', true).then(function () {
            assert(false)
          }, function () {})
        })
      })

      describe('.getReferences', function () {
        it('(remote=false)', function () {
          return glitter.getReferences(false).then(function (references) {
            assert(references.heads.length)
            assert(references.heads.some(function (reference) {
              return reference[0] === 'master'
            }))
          })
        })

        it('(remote=true)', function () {
          return glitter.getReferences(true).then(function (references) {
            assert(references.heads.length)
            assert(references.heads.some(function (reference) {
              return reference[0] === 'master'
            }))
          })
        })

        it('(reference, remote=false)', function () {
          return glitter.getReferences('1.0.0', false).then(function (references) {
            assert.equal(1, references.tags.length)
          })
        })

        it('(reference, remote=true)', function () {
          return glitter.getReferences('1.0.0', true).then(function (references) {
            assert.equal(1, references.tags.length)
          })
        })
      })

      describe('.getHeads', function () {
        it('(remote=false)', function () {
          return glitter.getHeads(false).then(function (heads) {
            return assert(heads.some(function (head) {
              return head[0] === 'master'
                && /^[a-z0-9]{40}$/.test(head[1])
            }))
          })
        })

        it('(remote=true)', function () {
          return glitter.getHeads(true).then(function (heads) {
            return assert(heads.some(function (head) {
              return head[0] === 'master'
                && /^[a-z0-9]{40}$/.test(head[1])
            }))
          })
        })
      })

      describe('.getTags', function () {
        it('(remote=false)', function () {
          return glitter.getTags(false).then(function (tags) {
            return assert(tags.some(function (tag) {
              return tag[0] === '1.0.0'
                && /^[a-z0-9]{40}$/.test(tag[1])
            }))
          })
        })

        it('(remote=true)', function () {
          return glitter.getTags(true).then(function (tags) {
            return assert(tags.some(function (tag) {
              return tag[0] === '1.0.0'
                && /^[a-z0-9]{40}$/.test(tag[1])
            }))
          })
        })
      })

      describe('.getVersions', function () {
        it('(remote=false)', function () {
          return glitter.getVersions(false).then(function (versions) {
            assert(~versions.indexOf('1.0.0'))
            assert(~versions.indexOf('0.1.3'))
            assert(versions.indexOf('1.0.0') < versions.indexOf('0.1.3'))
          })
        })

        it('(remote=true)', function () {
          return glitter.getVersions(true).then(function (versions) {
            assert(~versions.indexOf('1.0.0'))
            assert(~versions.indexOf('0.1.3'))
            assert(versions.indexOf('1.0.0') < versions.indexOf('0.1.3'))
          })
        })
      })

      describe('.copy(reference, folder)', function () {
        it('should copy', function () {
          var folder = path.join(out, 'routington')
          return glitter.copy('master', folder).then(function () {
            assert(fs.existsSync(path.join(folder, 'package.json')))
          })
        })
      })
    })
  })
})

describe('Cases', function () {
  describe('component/each', function () {
    var glitter = Glitter(Glitter.remotes.github, 'component', 'each')

    it('should install', function () {
      return glitter.install().then(function () {
        return glitter.isInstalled()
      }).then(function (val) {
        assert(val)
      })
    })

    it('should get versions', function () {
      return glitter.getVersions().then(function (versions) {
        assert(~versions.indexOf('0.2.2'))
      })
    })
  })
})
