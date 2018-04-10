'use strict';

const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');
const request = require('./request.js');

function getIssues(url, oauth, logger) {
  url = parseUrl(url, true);
  url.set('query', Object.assign({ per_page: 100 }, url.query));
  return _getIssues(url.href, [], oauth, logger);
}

function _getIssues(url, issues, oauth, logger) {
  if (!url) return Promise.resolve(issues);
  logger.debug(`Requesting issues '${url}'`);
  return request(url, oauth)
    .then(res => {
      let links = parseLinks(res.headers.link);
      let nextUrl = links && links.next && links.next.url;
      return _getIssues(nextUrl, issues.concat(res.body), oauth, logger);
    });
}

module.exports = getIssues;