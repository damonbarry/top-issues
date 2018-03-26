/* jshint node: true */
/* jshint esversion: 6 */
'use strict';

const request = require('request-promise-native');
const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');

if (!process.env.GITHUB_TOKEN) {
  console.log('Please set your GitHub OAuth2 token to the environment variable GITHUB_TOKEN.');
  return 1;
}

function staleComment(issueCommentsUrl, olderThanDays) {
  let options = {
    url: `${issueCommentsUrl}?per_page=1`,
    json: true,
    headers: {
      'User-Agent': 'request',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`
    }
  };

  return request(options)
    .then(body => {
      if (!body.length) return null;

      let comment = body[0];
      let staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - olderThanDays);
      let commentDate = new Date(comment.created_at);
      return commentDate < staleDate ? comment : null;
    })
    .catch(err => console.log(err.message));
}

function _getIssues(url, count) {
  if (!url) return [];

  url = parseUrl(url, true);
  url.set('query', Object.assign({ per_page: 100 }, url.query));

  let options = {
    url: url.href,
    json: true,
    resolveWithFullResponse: true,
    headers: { 
      'User-Agent': 'request',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`
    }
  };

  return request(options)
    .then(res => {
      let links = parseLinks(res.headers.link);
      return Promise.all(_getIssues(links && links.next && links.next.url).concat(
        res.body.map(issue => {
          if (issue.labels.find(label => label.name == 'enhancement')) {
            // ignore issues labeled 'enhancement'
            return null;
          }

          if (!issue.comments) {
            // keep issues no one has commented on yet
            return { issue: issue, comment: null };
          }

          // keep issues no one has commented on in 10+ days
          return staleComment(issue.comments_url, 10)
            .then(comment => comment ? { issue: issue, comment: comment } : null);
        })
      )).then(issues => issues.filter(issue => issue));
    })
    .catch(err => {
      console.log(err.message);
    });
}

function getIssues(url) {
  url = parseUrl(url);
  if (url.hostname.split('.').slice(-2).join('.') != 'github.com') {
    console.log('Unrecognized URL, expected github.com');
    return 1;
  }
  
  console.log(`Issue\tComments\tAge (days)\tTitle`);
  
  let basename = url.pathname.replace(/\.git$/, '');
  _getIssues(`https://api.github.com/repos${basename}/issues`)
    .then(issues => {
      issues.forEach(issue => {
        let ONE_DAY = 1000 * 60 * 60 * 24;
        let number = issue.issue.number;
        let numComments = issue.issue.comments;
        let title = issue.issue.title;
        let age = !issue.comment ? "<none>"
          : Math.round(Math.abs((new Date()).getTime() - (new Date(issue.comment.created_at)).getTime())/ONE_DAY);

        console.log(`${number}\t${numComments}\t\t${age}\t\t${title.substr(0, 60)}`);
      });
      console.log(`\n${issues.length} issues`);
    });
}

getIssues('https://github.com/Azure/iot-edge.git');
