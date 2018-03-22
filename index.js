/* jshint esversion: 6 */

const request = require('request-promise-native');
const parseLinks = require('parse-link-header');
const urlTrim = require('url-trim');

if (!process.env.GITHUB_TOKEN) {
  console.log("Please set your GitHub OAuth2 token to the environment variable GITHUB_TOKEN.");
  return 1;
}

function noCommentsSince(url, issueNumber, days) {
  let since = new Date();
  since.setDate(since.getDate() - days);
  let commentsUrl = `${urlTrim(url)}/${issueNumber}/comments?since=${since.toISOString()}`;

  let options = {
    url: commentsUrl,
    json: true,
    headers: {
      'User-Agent': 'request',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`
    }
  };

  return request(options)
    .then((body) => {
      return !body.length;
    })
    .catch((err) => {
      console.log(err.message);
    });
}

function getIssues(url) {
  if (!url) return Promise.resolve();

  let options = {
    url: url,
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
      return Promise.all([getIssues(links.next && links.next.url)].concat(
        res.body.map((issue) => {
          var print = () => console.log(`${issue.number}\t${issue.comments}\t${issue.title.substr(0, 60)}`);
          if (issue.labels.find((label) => label.name == 'enhancement')) {
            // ignore issues labeled 'enhancement'
            return Promise.resolve();
          }
          if (!issue.comments) {
            // print issues that no one has commented on yet
            print();
            return Promise.resolve();
          }
          return noCommentsSince(url, issue.number, 10)
            .then((noComments) => {
              // print issues no one has commented on in 10 days
              if (noComments) print();
            });
        })
      ));
    })
    .catch((err) => {
      console.log(err.message);
    });
}

console.log(`Issue\tComments\Title`);

getIssues('https://api.github.com/repos/Azure/iot-edge/issues')
  .then(() => {
    console.log("\nDone.");
  });
