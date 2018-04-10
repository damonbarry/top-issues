'use strict';

const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');
const Promise = require('bluebird');
const request = require('./request.js');

function filterIssues(issues, excludeLabels, oauth, logger) {
  return Promise.map(issues, issue => {
    if (issue.labels.some(label => excludeLabels.some(exclude => exclude === label.name))) {
      // ignore issues with labels found in config.excludeLabels
      return null;
    }

    if (!issue.comments) {
      // keep issues no one has commented on yet
      return { issue: issue, comment: null };
    }

    // keep issues no one has commented on in 10+ days
    return staleComment(issue.comments_url, 10, oauth, logger)
      .then(comment => comment ? { issue: issue, comment: comment } : null);
  }).then(issues => issues.filter(issue => issue));
}

function staleComment(issueCommentsUrl, olderThanDays, oauth, logger) {
  let url = parseUrl(issueCommentsUrl, true);
  url.set('query', Object.assign({ per_page: 100 }, url.query));
  logger.debug(`Requesting comments '${url.href}'`);

  return request(url.href, oauth)
    .then(res => {
      if (!res.body.length) return null;

      // if this isn't the last page of links then request it
      let links = parseLinks(res.headers.link);
      if (links && links.last && links.last.url) {
        return staleComment(links.last.url, 10, oauth, logger);
      }

      let comment = res.body[res.body.length - 1];
      let staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - olderThanDays);
      let commentDate = new Date(comment.created_at);
      return commentDate < staleDate ? comment : null;
    });
}

module.exports = filterIssues;