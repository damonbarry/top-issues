# top-issues
This simple CLI returns a list of Github issues that:
1. Aren't marked with the 'enhancement' tag, and
2. Have no comments, or haven't had a comment in at least 10 days.

Issues with no comments are at the top of the list, followed by issues with no recent comments, sorted by the number of days since the last comment.

## Install

```
$ npm install -g damonbarry/top-issues
```

## Configure

Give the tool a GitHub OAuth2 token to use like this:

```
$ top-issues oauth <github personal access token>
```

Note that your token will be saved as clear text in the `package.json` file where `top-issues` is installed. You can override the configured token by setting `GITHUB_TOKEN` in your environment.

By default, `top-issues` queries the [iot-edge](https://github.com/Azure/iot-edge.git) repo (because that's the repo I monitor). You can configure the tool to use another URL like this:

```
$ top-issues url <github repository URL>
```

You can override any configured URL by setting `GITHUB_URL` in your environment.

## Run

```
$ top-issues
┌───────┬──────────┬────────────┬────────────────────────────────────────────────────────────┐
│ Issue │ Comments │ Age (days) │ Title                                                      │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 440   │ 0        │ --         │ Precondition failed error on Pi                            │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 445   │ 0        │ --         │ Have config setting that always pulls from docker even if… │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 486   │ 0        │ --         │ Add avoid message lost of nanomsg features by thread mess… │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 520   │ 0        │ --         │ [V1] MQTT segfault after "timed out waiting for CONNACK"   │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 223   │ 6        │ 347        │ LIBCMT linker warnings when building Release config        │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
│ 237   │ 5        │ 338        │ "cmake --build . --target install" always install to /usr… │
├───────┼──────────┼────────────┼────────────────────────────────────────────────────────────┤
...

53 issues
```
