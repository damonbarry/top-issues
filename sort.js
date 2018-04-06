'use strict';

function sortIssues(issues) {
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
}

module.exports = sortIssues;