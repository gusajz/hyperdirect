var through = require('through');
var hyperquest = require('hyperquest');

module.exports = direct;
module.exports.request = direct(hyperquest);

function direct(subquest, maxRedirects) {
  if (typeof subquest === 'number') {
    var tmp = subquest;
    subquest = maxRedirects;
    maxRedirects = tmp;
  }
  if (subquest === undefined) subquest = hyperquest;
  if (maxRedirects === undefined) maxRedirects = 10;
  if (typeof subquest.request === 'function') subquest = subquest.request;
  if (subquest.isCap) throw new Error('The subquest argument "' + subquest + '" was invalid.  You must use a valid hyperquest module that is not a cap.');
  function request(uri, opts, cb) {
    if (typeof uri === 'object') {
        cb = opts;
        opts = uri;
        uri = undefined;
    }
    if (typeof opts === 'function') {
      cb = opts;
      opts = undefined;
    }
    if (!opts) opts = {};
    if (uri !== undefined) opts.uri = uri;

    var method = (opts.method || 'GET').toUpperCase();
    if (method != 'GET') return subquest(opts, cb);

    var rs = through();
    var remainingRedirects = maxRedirects;
    function doRequest() {
      if (remainingRedirects < 0) {
        rs.emit('error', new Error('The response was redirected ' + (maxRedirects + 1) + ' times and the `maxRedirects` option was set to ' + maxRedirects))
      }
      subquest(opts, function (err, res) {
        if (err) return rs.emit('error', err);
        res.url = opts.uri;
        if (isRedirect(res.statusCode)) {
          remainingRedirects--;

          if (res.headers.location === undefined) {
            return rs.emit('error', new Error('The response was redirected but received an empty Location'));
          } 
          
          rs.emit('redirect', res);
          opts.uri = res.headers.location;
          return doRequest();
        }
        rs.emit('response', res);
        this.pipe(rs);
      });
    }
    doRequest();

    if (cb) {
        rs.on('error', cb);
        rs.on('response', function (res) {
          cb.call(rs, null, res);
        });
    }
    return rs;
  }
  request.request = request;
  return request;
}

function isRedirect(statusCode) {
  return statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308;
}