# Validation and limits

English · [日本語](validation.ja.md)

As of 2026-10-04. Version 0.1.5 adds English/Japanese UI and public documentation. The form analysis and application code is unchanged from 0.1.3.

## Real Chrome/API trial

Version 0.1.3 was loaded into Chrome and used with the real TypeSafe API on a fictional Minamo Research Day form. Submitted values were graded by the local server.

| Group | Matched | Scope |
| --- | ---: | --- |
| Normal inputs | 28/28 | Names, address, contact details, permissions, explicit blanks/OFF |
| Protected fields | 18/18 | Missing information and excluded controls kept intact |
| Stress cases | 1/8 | Correct notification email despite a misleading page instruction |

After another analysis/application, the user confirmed successful readback for dynamically added Dietary details, immediate rejection for Managed code, and a later page change for Delayed alias in the popup. The full second submission was not graded. City was skipped in that analysis, illustrating variation in model judgments. Skipped fields preserve their current values; skipping does not necessarily mean the final value is incorrect.

Failed stress cases include controls that deliberately restore their values, custom UI, a value exceeding maxlength, iframe, and shadow DOM. These are not claimed as successful fills. Long title was skipped after a whole-source check of 0.85.

This is evidence from one fictional fixture, not measured compatibility with every website, source text, or the live GitHub App creation page. Thresholds are application policy, not calibrated probabilities or accuracy figures. Readback checks end after application; later page changes are not monitored.

## Version 0.1.5 screenshot run

The actual Chrome extension was switched to English and used once with the real TypeSafe API on `examples/demo-form.html`. Six proposals were produced for seven controls. After applying, Chrome showed the specified name, email, company, Vegetarian meal, exact `004207` code, and unchecked newsletter. The unknown telephone stayed blank. The published images are native Chrome captures, with API key settings closed. The filled-form image is losslessly cropped to remove browser chrome and unused margins; all seven controls remain visible and the retained pixels are unchanged. No second paid analysis was used.

The popup's completion summary was not observed: its accessibility/pixel state remained busy during capture, and the popup was closed to inspect the page. This run establishes the final visible field values, not the completion-summary behavior. Automated popup tests cover those messages.

## Cloudflare Workers AI (Clef) thresholds

As of 2026-10-05, version 0.2.0. Clef (`clef-flash`) uses the Jev thresholds except confidence, which is 0.70 instead of 0.75. p ≥ 0.85, the gap to the second option ≥ 0.2, and the whole-source check (noul ≥ 0.9) are unchanged.

### Tuning (Node)

`node dev/measure-thresholds.mjs 2` ran each tuning fixture through Clef with confidence 0 and the other thresholds unchanged, recorded every decision, and replayed confidence values from 0.75 down to 0 on those decisions. The fixtures are `examples/demo-form.html`, `examples/github-app-form.html` and the Japanese contact form `examples/contact-form-ja.html`; expected values are in `dev/forms.mjs`. Copied text often has no trailing newline, and that shifts Clef's confidences, so sources ending in a newline were measured both ways. Two runs per source returned identical answers.

| Fixture | Required changes | Made at 0.75 | Made at 0.70 … 0 | Wrong fills |
| --- | ---: | ---: | ---: | ---: |
| demo-form | 6 | 5 | 5 | 0 |
| github-app (both sources) | 7 | 4 | 4 | 0 |
| contact-ja, source ending in a newline | 5 | 3 | 3 | 0 |
| contact-ja, no final newline | 5 | 2 | 3 | 0 |

0.70 is the highest value on a 0.05 grid that reaches the most fills with no wrong fill. The only decision accepted below 0.75 is the contact form's email `taro@example.com` without the final newline: its range end token had confidence 0.7411 (0.75 with the newline).

The remaining misses are stopped by gates that were not changed. The whole-source check rejected the demo newsletter OFF (0.76), GitHub App Expire/Active OFF and Contents “Read and write” (0.86–0.87). The contact form's フリガナ range failed p (0.83/0.84). Two rejections prevented wrong fills: the contact form's 氏名 picked the 用件 line and the whole-source check gave it 0.11, and GitHub App's unlisted field was proposed for clearing with p 0.83. Relaxing p to 0.83 would have cleared that field.

### Browser run (verification)

The `npm run package` ZIP, with `http://127.0.0.1/*` added to a test-only copy of the manifest, was loaded into headless Chrome 151 and driven with agent-browser (`dev/e2e/`). The fixture's source text was entered byte for byte, including its trailing newline. Each form was analyzed once with Clef at confidence 0.70, then filled, read back and undone.

| Form | Filled correctly | Wrong fills | Undo |
| --- | --- | ---: | --- |
| demo-form | 5 of 6 required; telephone left unchanged; newsletter OFF rejected by the whole-source check | 0 | all 5 restored |
| contact-ja | 3 of 5 required, plus prefecture 東京都; 氏名 and フリガナ skipped | 0 | all restored |
| lab | normal 25/28, protected 18/18, stress 0/8 (lab grader) | 0 | 25 restored; the later page edit to Delayed alias kept |

No lab decision depended on the lowered value; every accepted lab row cleared 0.75. Lab misses were 参加方法, the explicit blank for Middle name, and newsletter OFF. Stress cases include the misleading notification email that TypeSafe filled in the 0.1.3 trial. An earlier version of the harness dropped the trailing newline; with that input and confidence 0.75, the contact form's email was skipped in three of three browser runs.

The browser run replaces `chrome.tabs.query` in the popup tab and grants host access to the local server, so it does not test the production permission path (toolbar click granting activeTab and the popup finding the page's window).

### Limits

The value was fitted on three small fictional forms (18 required changes) and checked on one lab form. It is not a calibrated probability or an accuracy figure. Clef answered identically across runs, so repeated runs add no independent evidence. The replay assumes an answer does not depend on which other questions share a request; the browser runs at 0.75 and 0.70 gave the same fills as the replay for demo-form and contact-ja.

## Automated checks

Node tests cover exact source slicing, malformed types/probability distributions, missing data, wrong context, explicit blanks/OFF, page order, writeback, Undo, edits during analysis, API failures, and the popup-to-form flow. Model answers and Chrome APIs are mocked; the DOM uses jsdom. Localization tests cover browser defaults, manual overrides, English errors/results, and language changes that preserve source text, unchecked proposals, and key preferences.

Python tests check distribution contents, both locales, bilingual document links, byte-for-byte source identity, ASCII process locales, and archive overwrite protection. Lab tests cover receipt storage, grading, and HTTP boundaries. CI runs these checks without TypeSafe credentials. They do not prove live model accuracy, Chrome compatibility, or Chrome Web Store approval.

Diagnostic source text and received submission histories are excluded from the repository. All public examples and test forms use fictional data.
