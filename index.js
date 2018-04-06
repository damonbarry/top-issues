#!/usr/bin/env node

'use strict';

const filterIssues = require('./filter.js');
const getIssues = require('./pages.js');
const parseUrl = require('url-parse');
const program = require('caporal');
const sortIssues = require('./sort.js');
const write = require('fs-writefile-promise');
const Table = require('cli-table2');

const pkgPath = require.resolve('./package.json');
let pkg = require('./package.json');

program
  .command('oauth', 'Save a token used to communicate with GitHub')
  .argument('<token>', 'GitHub personal access token')
  .action((args, opts, logger) => {
    pkg.config.oauth = args.token || null;
    return write(pkgPath, JSON.stringify(pkg, null, 2))
      .then(() => logger.info('Saved GitHub OAuth2 token'));
  });

program
  .command('url', 'Save the GitHub issues URL')
  .argument('<url>', 'GitHub issues URL')
  .action((args, opts, logger) => {
    pkg.config.url = args.url || null;
    return write(pkgPath, JSON.stringify(pkg, null, 2))
      .then(() => logger.info(`Saved URL '${pkg.config.url}'`));
  });

program
  .command('exclude-labels', 'Save labels used to exclude GitHub issues from the results list')
  .argument('<labels>', 'Comma-delimited list of GitHub issues labels', program.LIST)
  .action((args, opts, logger) => {
    let labels = args.labels || null;
    pkg.config.excludeLabels = labels && labels.map(label => label.trim());
    return write(pkgPath, JSON.stringify(pkg, null, 2))
      .then(() => logger.info(`Saved labels '${pkg.config.excludeLabels}'`));
  });

program
  .action((args, opts, logger) => {
    let oauth = process.env.GITHUB_TOKEN || pkg.config.oauth;
    if (!oauth) {
      logger.error(`Error: no GitHub OAuth2 token found.\nRun '${pkg.name} oauth <token>' or set environment variable GITHUB_TOKEN.`);
      return 1;
    }

    let url = process.env.GITHUB_URL || pkg.config.url || pkg.config.defaults.url;
    url = parseUrl(url);
    if (url.hostname.split('.').slice(-2).join('.') !== 'github.com') {
      logger.error('Unrecognized URL, expected github.com');
      return 1;
    }
    let basename = url.pathname.replace(/\.git$/, '');
    url = `https://api.github.com/repos${basename}/issues`;
  
    let excludeLabels = pkg.config.excludeLabels || pkg.config.defaults.excludeLabels;

    return getIssues(url, oauth, logger)
      .then(issues => {
        filterIssues(issues, excludeLabels, oauth, logger)
          .then(filtered => {
            let sorted = sortIssues(filtered);

            const table = new Table({
              head: ['Issue', 'Comments', 'Age (days)', 'Title'],
              colWidths: [,,,60]
            });
          
            sorted.forEach(issue =>
              table.push([ issue.number, issue.numComments, issue.age === -1 ? '--' : `${issue.age}`, issue.title ]));
    
            console.log(`\n${url}\n`);
            console.log(table.toString());
            console.log(`\n${sorted.length} issues`);
          })
          .catch(err => logger.error(err));
      });
  });

program.parse(process.argv);