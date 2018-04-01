#!/usr/bin/env node

'use strict';

const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');
const path = require('path');
const program = require('caporal');
const request = require('request-promise-native');
const write = require('fs-writefile-promise');

const pkgPath = require.resolve('./package.json');
let pkg = require('./package.json');
pkg.config = pkg.config || {};

let oauth;

function staleComment(issueCommentsUrl, olderThanDays) {
  let options = {
    url: `${issueCommentsUrl}?per_page=1`,
    json: true,
    headers: {
      'User-Agent': 'request',
      'Authorization': `token ${oauth}`
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
    });
}

function _getIssues(url) {
  if (!url) return [];

  url = parseUrl(url, true);
  url.set('query', Object.assign({ per_page: 100 }, url.query));

  let options = {
    url: url.href,
    json: true,
    resolveWithFullResponse: true,
    headers: { 
      'User-Agent': 'request',
      'Authorization': `token ${oauth}`
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
}

function getIssues(url) {
  url = parseUrl(url);
  if (url.hostname.split('.').slice(-2).join('.') != 'github.com') {
    return Promise.reject('Unrecognized URL, expected github.com');
  }
  
  let basename = url.pathname.replace(/\.git$/, '');
  return _getIssues(`https://api.github.com/repos${basename}/issues`)
    .then(issues => {
      let ONE_DAY = 1000 * 60 * 60 * 24;

      let list = issues.map(elem => {
        return {
          number: elem.issue.number,
          numComments: elem.issue.comments,
          age: !elem.comment ? -1 : Math.round(Math.abs((new Date()).getTime() - (new Date(elem.comment.created_at)).getTime())/ONE_DAY),
          title: elem.issue.title
        };
      });

      list.sort((a, b) => {
        if (a.age < 0 && b.age < 0) // if no comments, order by issue #, ascending
          return a.number - b.number;
        if (a.age < 0) return -1;   // order issues without comments...
        if (b.age < 0) return +1;   // ...before issues with comments
        return b.age - a.age;       // if both have comments, order by comment age, descending
      });

      console.log(`Issue\tComments\tAge (days)\tTitle`);
      list.forEach(issue => console.log(`${issue.number}\t${issue.numComments}\t\t${issue.age===-1 ? "--" : issue.age}\t\t${issue.title.substr(0, 60)}`));
      console.log(`\n${issues.length} issues`);
    });
}

program
  .command('oauth', 'Save a token used to communicate with GitHub')
  .argument('<token>', 'GitHub personal access token')
  .action((args, opts, logger) => {
    pkg.config.oauth = args.token;
    return write(pkgPath, JSON.stringify(pkg, null, 2))
      .then(() => logger.info('Saved GitHub OAuth2 token'));
  });

program
  .command('url', 'Save the GitHub issues URL')
  .argument('<url>', 'GitHub issues URL')
  .action((args, opts, logger) => {
    pkg.config.url = args.url;
    return write(pkgPath, JSON.stringify(pkg, null, 2))
      .then(() => logger.info(`Saved URL '${cfg.url}'`));
  });

program
  .action((args, opts, logger) => {
    oauth = process.env.GITHUB_TOKEN || pkg.config.oauth;
    if (!oauth) {
      logger.error(`Error: no GitHub OAuth2 token found.\nRun '${pkg.name} oauth <token>' or set environment variable GITHUB_TOKEN.`);
      return 1;
    }

    const url = pkg.config.url || 'https://github.com/Azure/iot-edge.git';
    return getIssues(url)
      .catch(err => logger.error(err));
  });

program.parse(process.argv);