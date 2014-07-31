
var AUTH = process.env.GLITTER_GITHUB

module.exports = {
  name: 'github',
  url: function (user, repo) {
    var url = 'https://'
    if (AUTH) url += AUTH + '@'
    return url + 'github.com/' + user + '/' + repo
  }
}
