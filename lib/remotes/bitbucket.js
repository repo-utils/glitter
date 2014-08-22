
var AUTH = process.env.GLITTER_BITBUCKET

module.exports = {
  name: 'bitbucket',
  url: function (user, repo) {
    var url = 'https://'
    if (AUTH) url += AUTH + '@'
    return url + 'bitbucket.org/' + user + '/' + repo
  }
}
