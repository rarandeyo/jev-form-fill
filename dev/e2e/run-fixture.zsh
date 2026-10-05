#!/usr/bin/env zsh
# One browser run of the packaged extension against a local fixture, driven by agent-browser over CDP.
# Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... AGENT_BROWSER_SESSION=... \
#   dev/e2e/run-fixture.zsh <CDP port> <extension id> <fixture name> <page URL> <output dir> [minimum required changes]
# Writes <name>-*.json states, popup messages, diagnostics and two screenshots to the output dir.
# Exit 0 both oracles pass, 1 strong oracle fails, 3 too few fills, 2 the harness itself failed.
set -euo pipefail
port=$1 ext=$2 name=$3 url=$4 out=$5 minimum=${6:-0}
root=${0:A:h:h:h}
: ${CF_ACCOUNT_ID:?} ${CF_API_TOKEN:?} ${AGENT_BROWSER_SESSION:?}
A=(agent-browser --cdp $port)
popup_tab='' form_tab=''
# The popup tab holds the token in its key field, so close both tabs even when a step fails part way.
abort_run() {
  [[ -n $popup_tab ]] && $A tab close $popup_tab >/dev/null 2>&1 || true
  [[ -n $form_tab ]] && $A tab close $form_tab >/dev/null 2>&1 || true
  exit 2
}
trap abort_run ERR
state=$(node $root/dev/e2e/fixture.mjs state $name)
idle="!document.getElementById('analyze').disabled"
# agent-browser --json wraps results; print data.<path>.
data() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s).data;for(const k of process.argv[1].split("."))v=v[k];console.log(v)})' "$1"; }
# A single wait --fn gives up after agent-browser's default timeout; long forms take minutes.
wait_idle() { local tries=0; $A wait 500 >/dev/null; until $A wait --fn "$idle" >/dev/null 2>&1; do (( ++tries < 40 )) || return 4; done; }

$A tab new $url >/dev/null
$A wait --load networkidle >/dev/null
form_tab=$($A tab list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.tabs.find(x=>x.active).targetId))')
$A eval "$state" --json | data result > $out/$name-initial.json

popup_tab=$(node $root/dev/e2e/open-popup.mjs $port $ext $name $url)
$A tab $popup_tab >/dev/null
$A click '#analyze' >/dev/null
wait_idle
$A eval "document.getElementById('settings').open=false;document.getElementById('status').textContent" > $out/$name-status-analyze.txt
$A eval "document.getElementById('diagnostics').value" --json | data result > $out/$name-diagnostics.json
$A screenshot --full $out/$name-popup.png >/dev/null
apply_disabled=$($A eval "document.getElementById('apply').disabled")
if [[ $apply_disabled != true ]]; then $A click '#apply' >/dev/null; wait_idle; fi
$A eval "document.getElementById('status').textContent" > $out/$name-status-apply.txt

$A tab $form_tab >/dev/null
$A wait 1000 >/dev/null
$A eval "$state" --json | data result > $out/$name-filled.json
$A screenshot --full $out/$name-filled.png >/dev/null

$A tab $popup_tab >/dev/null
$A click '#undo' >/dev/null
wait_idle
$A eval "document.getElementById('status').textContent" > $out/$name-status-undo.txt
$A tab close $popup_tab >/dev/null; popup_tab=
$A tab $form_tab >/dev/null
$A eval "$state" --json | data result > $out/$name-undone.json
$A tab close $form_tab >/dev/null || true; form_tab=
trap - ERR
node $root/dev/e2e/fixture.mjs grade $name $out $minimum > $out/$name-grade.json
