# Development scripts

These files are not part of the extension ZIP. Both scripts call Cloudflare Workers AI and need `CF_ACCOUNT_ID` and `CF_API_TOKEN` in the environment. Keep the token out of logs, screenshots and commits.

## Threshold measurement

```sh
node dev/measure-thresholds.mjs 2
node dev/measure-thresholds.mjs 1 japan
```

Runs the tuning fixtures defined in `dev/forms.mjs` through Clef and prints how many required changes and wrong fills each confidence value gives. Raw decisions go to the Git-ignored `.local/thresholds/`. Results and limits are in [docs/validation.md](../docs/validation.md).

## Browser run

Loads the packaged extension into headless Chrome and drives the popup with [agent-browser](https://github.com/vercel-labs/agent-browser) over CDP. Branded Chrome ignores `--load-extension`, so `dev/e2e/launch.mjs` loads it with CDP `Extensions.loadUnpacked`. In a tab the popup would target itself, so `dev/e2e/open-popup.mjs` replaces `chrome.tabs.query` in that tab only. The test copy adds `http://127.0.0.1/*` to the manifest; the release manifest is unchanged. This does not cover the production permission path (toolbar click and activeTab).

Run each block in zsh after the previous one succeeded. Build the test copy (this runs the packaging script itself):

```sh
WORK=$(mktemp -d)
node dev/e2e/prepare.mjs "$WORK/ext"
mkdir "$WORK/out"
```

Start Chrome, the example server and the lab server, each in its own terminal. `launch.mjs` prints the extension id, uses a throwaway Chrome profile and deletes it when it exits:

```sh
node dev/e2e/launch.mjs "$WORK/ext/jev-form-fill" 9343
```

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory examples
```

```sh
node lab/server.js --port 8766
```

Run the fixtures. Credentials are passed to the popup over CDP, not on command lines. The last argument is the minimum number of required changes (for the lab, normal inputs passed by the lab grader), taken from docs/validation.md. Exit 0 means both oracles passed, 1 a failed analysis, wrong fill or failed Undo, 3 too few fills, 2 a harness failure:

```sh
export AGENT_BROWSER_SESSION=$(agent-browser session id --scope worktree --prefix jev-e2e)
EXT=<extension id printed by launch.mjs>
dev/e2e/run-fixture.zsh 9343 $EXT demo-form http://127.0.0.1:8765/demo-form.html "$WORK/out" 5
dev/e2e/run-fixture.zsh 9343 $EXT contact-ja http://127.0.0.1:8765/contact-form-ja.html "$WORK/out" 3
dev/e2e/run-fixture.zsh 9343 $EXT lab http://127.0.0.1:8766/ "$WORK/out" 25
```

`contact-ja-nonl` is contact-ja without the final newline, the case Clef's confidence of 0.70 changes (the email is filled). The Japanese and English observation fixtures in the `japan` set of `dev/forms.mjs` (for example `jp-list` or `en-list` on `jp-application-form.html` / `en-signup-form.html`) run the same way; their minimums are the Node results in docs/validation.md, and en-list is expected to exit 1 because of the recorded postal-code wrong fill:

```sh
dev/e2e/run-fixture.zsh 9343 $EXT contact-ja-nonl http://127.0.0.1:8765/contact-form-ja.html "$WORK/out" 3
dev/e2e/run-fixture.zsh 9343 $EXT jp-quoted http://127.0.0.1:8765/jp-application-form.html "$WORK/out" 14
```

Each run writes the initial, filled and undone field states, popup messages, diagnostics, a grade and two screenshots to the output directory. Finally stop the three servers (Ctrl-C), run `agent-browser close`, and delete `$WORK`.
