'use strict';

const rp = require('request-promise-native');
const pkgName = require('./package.json').name;

function request(url, token) {
  return rp({
    url: url,
    json: true,
    resolveWithFullResponse: true,
    headers: {
      'User-Agent': pkgName,
      'Authorization': `token ${token}`
    }
  });
}

module.exports = request;