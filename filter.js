'use strict';

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
  const url = `${issueCommentsUrl}?per_page=1`;
  logger.debug(`Requesting comments '${url}'`);

  return request(url, oauth)
    .then(res => {
      if (!res.body.length) return null;

      let comment = res.body[0];
      let staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - olderThanDays);
      let commentDate = new Date(comment.created_at);
      return commentDate < staleDate ? comment : null;
    });
}

module.exports = filterIssues;