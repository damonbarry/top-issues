#!/usr/bin/env node

'use strict';

const parseLinks = require('parse-link-header');
const parseUrl = require('url-parse');
const path = require('path');
const program = require('caporal');
const request = require('request-promise-native');
const write = require('fs-writefile-promise');
const Table = require('cli-table2');

const pkgPath = require.resolve('./package.json');
let pkg = require('./package.json');
pkg.config = pkg.config || {};

function options(url, oauth) {
  return {
    url: url,
    json: true,
    resolveWithFullResponse: true,
    headers: {
      'User-Agent': pkg.name,
      'Authorization': `token ${oauth}`
    }
  };
}

function staleComment(issueCommentsUrl, olderThanDays, oauth, logger) {
  let opts = options(`${issueCommentsUrl}?per_page=1`, oauth);
  logger.debug(`Requesting '${opts.url}'`);

  return request(opts)
    .then(res => {
      if (!res.body.length) return null;

      let comment = res.body[0];
      let staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - olderThanDays);
      let commentDate = new Date(comment.created_at);
      return commentDate < staleDate ? comment : null;
    });
}

function _getIssues(url, oauth, logger) {
  if (!url) return [];

  url = parseUrl(url, true);
  url.set('query', Object.assign({ per_page: 100 }, url.query));

  let opts = options(url.href, oauth);
  logger.debug(`Requesting '${opts.url}'`);

  return request(opts)
    .then(res => {
      let links = parseLinks(res.headers.link);
      return Promise.all(_getIssues(links && links.next && links.next.url, oauth, logger).concat(
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
          return staleComment(issue.comments_url, 10, oauth, logger)
            .then(comment => comment ? { issue: issue, comment: comment } : null);
        })
      )).then(issues => issues.filter(issue => issue));
    })
}

function getIssues(url, oauth, logger) {
  url = parseUrl(url);
  if (url.hostname.split('.').slice(-2).join('.') != 'github.com') {
    return Promise.reject('Unrecognized URL, expected github.com');
  }
  
  let basename = url.pathname.replace(/\.git$/, '');
  return _getIssues(`https://api.github.com/repos${basename}/issues`, oauth, logger)
    .then(issues => {
      const oneDay = 1000 * 60 * 60 * 24;

      let processed = issues.map(elem => {
        return {
          number: elem.issue.number,
          numComments: elem.issue.comments,
          age: !elem.comment ? -1 : Math.round(Math.abs((new Date()).getTime() - (new Date(elem.comment.created_at)).getTime())/oneDay),
          title: elem.issue.title
        };
      });

      processed.sort((a, b) => {
        if (a.age < 0 && b.age < 0) // if no comments, order by issue #, ascending
          return a.number - b.number;
        if (a.age < 0) return -1;   // order issues without comments...
        if (b.age < 0) return +1;   // ...before issues with comments
        return b.age - a.age;       // if both have comments, order by comment age, descending
      });

      return processed;
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
      .then(() => logger.info(`Saved URL '${pkg.config.url}'`));
  });

program
  .action((args, opts, logger) => {
    let oauth = process.env.GITHUB_TOKEN || pkg.config.oauth;
    if (!oauth) {
      logger.error(`Error: no GitHub OAuth2 token found.\nRun '${pkg.name} oauth <token>' or set environment variable GITHUB_TOKEN.`);
      return 1;
    }

    const url = process.env.GITHUB_URL || pkg.config.url || 'https://github.com/Azure/iot-edge.git';
    return getIssues(url, oauth, logger)
      .then(issues => {
        const table = new Table({
          head: ['Issue', 'Comments', 'Age (days)', 'Title'],
          colWidths: [,,,60]
        });
      
        issues.forEach(issue =>
          table.push([ issue.number, issue.numComments, issue.age === -1 ? '--' : `${issue.age}`, issue.title ]));

        console.log(table.toString());
        console.log(`\n${issues.length} issues`);
      })
      .catch(err => logger.error(err));
  });

program.parse(process.argv);