/* jshint node: true */
/* jshint esversion: 6 */
'use strict';

const request = require('request-promise-native');
const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');

if (!process.env.GITHUB_TOKEN) {
  console.log('Please set your GitHub OAuth2 token to the environment variable GITHUB_TOKEN.');
  return -1;
}

function noCommentsSince(url, issueNumber, days) {
  let since = new Date();
  since.setDate(since.getDate() - days);
  let commentsUrl = `${url}?since=${since.toISOString()}`;

  let options = {
    url: commentsUrl,
    json: true,
    headers: {
      'User-Agent': 'request',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`
    }
  };

  return request(options)
    .then((body) => !body.length)
    .catch((err) => console.log(err.message));
}

function _getIssues(url, count) {
  if (!url) return 0;

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
    .then((res) => {
      let links = parseLinks(res.headers.link);
      return Promise.all([_getIssues(links && links.next && links.next.url)].concat(
        res.body.map((issue) => {
          var print = () => console.log(`${issue.number}\t${issue.comments}\t${issue.title.substr(0, 60)}`);
          if (issue.labels.find((label) => label.name == 'enhancement')) {
            // ignore issues labeled 'enhancement'
            return 0;
          }
          if (!issue.comments) {
            // print issues that no one has commented on yet
            print();
            return 1;
          }
          return noCommentsSince(issue.comments_url, issue.number, 10)
            .then((noComments) => {
              // print issues no one has commented on in 10 days
              if (noComments) {
                print();
                return 1;
              }
              return 0;
            });
        })
      )).then((arrCounts) => arrCounts.reduce((accum, val) => accum + val));
    })
    .catch((err) => {
      console.log(err.message);
    });
}

function getIssues(url) {
  url = parseUrl(url);
  if (url.hostname.split('.').slice(-2).join('.') != 'github.com') {
    console.log('Unrecognized URL, expected github.com');
    return -1;
  }
  
  console.log(`Issue\tComments\Title`);
  
  _getIssues(`https://api.github.com/repos${url.pathname.replace(/\.git$/, '')}/issues`)
    .then((count) => {
      console.log(`\n${count} issues`);
    });
}

getIssues('https://github.com/Azure/iot-edge.git');
