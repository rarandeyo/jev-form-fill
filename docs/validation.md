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
| contact-ja-nonl (no final newline) | 3 of 5 required, plus prefecture 東京都; the email is filled only because of 0.70 | 0 | all restored |
| lab | normal 25/28, protected 18/18, stress 0/8 (lab grader) | 0 | 25 restored; the later page edit to Delayed alias kept |

Apart from contact-ja-nonl, whose email range end scored 0.7411 as in Node, every accepted row cleared 0.75. Lab misses were 参加方法, the explicit blank for Middle name, and newsletter OFF. Stress cases include the misleading notification email that TypeSafe filled in the 0.1.3 trial.

The browser run replaces `chrome.tabs.query` in the popup tab and grants host access to the local server, so it does not test the production permission path (toolbar click granting activeTab and the popup finding the page's window).

### Limits

The value was fitted on three small fictional forms (18 required changes) and checked on one lab form. It is not a calibrated probability or an accuracy figure. Clef answered identically across runs, so repeated runs add no independent evidence. The replay assumes an answer does not depend on which other questions share a request; the browser runs gave the same fills as the replay for demo-form and contact-ja.

## Japanese application forms and English forms with Japanese text (Clef)

As of 2026-10-05, version 0.2.0, Cloudflare Workers AI at the thresholds above. These fixtures observe behavior; they did not change any threshold. Forms: `examples/jp-application-form.html` (family/given name, katakana, hiragana, a 3+4 postal code, prefecture select, city/street/building, year/month/day selects, a 3-part phone number, gender and contact radios, half-width and full-width fields, consent checkbox, notes) and `examples/en-signup-form.html` (first/last/full name, email, phone, company, address lines, city, state, postal code, country select). Expected values and known limits are in `dev/forms.mjs`; the Node run is `node dev/measure-thresholds.mjs 1 japan`. Clef returned the same answers on a repeated run.

“Required” counts fields whose value the source determines and the extension can write. Known limits are fields the source determines but the extension cannot write, because the value is not an exact source substring it can isolate (Japanese runs such as 東京都渋谷区神南1-2-3 form one token, and 150-0041 or 090-1234-5678 cannot be split into boxes), needs width conversion or romanization, or is not uniquely determined for an English address form. Leaving a known-limit field unchanged counts as correct.

| Source (file) | Form | Required filled | Wrong fills | Known limits left unchanged |
| --- | --- | ---: | ---: | --- |
| item: value list (`jp-source-list.txt`) | Japanese | 6/16 | 0 | postal code ×2, phone ×3, city, street |
| one paragraph (`jp-source-prose.txt`) | Japanese | 5/8 | 0 | family/given name, postal code, phone, city, street |
| full-width digits and symbols (`jp-source-zenkaku.txt`) | Japanese | 2/8 | 0 | postal code, phone, city, street, full-width email |
| Japanese era date 平成2年 (`jp-source-wareki.txt`) | Japanese | 4/8 | 0 | phone ×3 |
| each value in 「」 (`jp-source-quoted.txt`) | Japanese | 14/23 | 0 | none (the source is split per box) |
| Japanese item: value list (`en-source-ja-list.txt`) | English | 1/6 | **1** | first/last name, city, state, address lines |
| Japanese paragraph (`en-source-ja-prose.txt`) | English | 1/4 | 0 | names, company, city, state, address lines |
| romanized values in 「」 with Japanese item names (`en-source-ja-quoted.txt`) | English | 10/12 | 0 | none |

The browser run (headless Chrome, `dev/e2e/`) of jp-list, jp-prose, jp-quoted, en-list, en-prose and en-quoted produced the same fills as Node, and Undo restored every changed field. The first browser attempt of jp-quoted ended with “The API did not respond in time” and changed nothing; the second attempt succeeded.

What was filled and what stopped:

- Closed choices were filled most often. Birth month and day were filled from all four unquoted Japanese sources, the contact radio and consent wherever the source stated them, and the prefecture from the list and the paragraph (the full-width source stopped at the whole-source check, 0.88). Country was filled only from the Japanese paragraph; the whole-source check stopped it at 0.85 (en-list) and 0.68 (en-quoted). The birth year was filled from the paragraph (1990年) but not from the list, the full-width source or the era date; 平成2年 was not converted.
- Unquoted text values go through a token-range step, and Clef's answers there were weak: most of 姓, セイ, email, company, notes and building in the list source stopped at the range start/end or value step (confidence 0.18–0.64, p 0.49–0.84).
- Quoting each value with 「」 sends it as a whole candidate. jp-quoted then filled 14 of 23, including the split postal code and phone boxes, city and street. The rest stopped at the whole-source check (0.79–0.90: 姓, メイ, ふりがな, postal code back half, last phone box, birth month, gender) or at the choice gates (birth year, day).
- English form: no Japanese name was put into First name, Last name or Full name in any run; those fields were skipped. Romanized, quoted values (en-quoted) filled 10 of 12; First name (0.88) and Country (0.68) stopped at the whole-source check.
- Three decisions here were accepted only because Clef's confidence is 0.70 rather than 0.75: jp-zenkaku birth day (0.7375), jp-wareki セイ (0.7023) and en-list phone (0.7301). All three were correct.

**Wrong fill.** In en-list the ZIP / Postal code field received `〒150-0041` from `住所：〒150-0041 東京都…`. The range start chose the 〒 token (confidence 0.77, p 0.90), the end chose 150-0041 (0.81, 0.92) and the whole-source check accepted it (0.94), so every gate passed above the Jev thresholds as well. Reproduce with `node dev/measure-thresholds.mjs 1 en-list` or `dev/e2e/run-fixture.zsh … en-list …`; the diagnostics are in the popup's decision details. Possible fixes, not applied: tell the range question to exclude markers such as 〒 and TEL as it already excludes labels and quotes; drop leading symbol-only tokens (Unicode category So) from an extracted range; or include the field's `autocomplete`/`inputmode` in the field description so verification can reject a value that does not fit a postal code.

Limits: one fictional Japanese form and one English form, eight sources, single runs (answers were identical on repetition). The expected tables are the author's reading of each source; whether 東京都 should fill a prefecture from an address, or whether `〒150-0041` is acceptable in a postal-code field, are judgment calls recorded in `dev/forms.mjs`.

## Automated checks

Node tests cover exact source slicing, malformed types/probability distributions, missing data, wrong context, explicit blanks/OFF, page order, writeback, Undo, edits during analysis, API failures, and the popup-to-form flow. Model answers and Chrome APIs are mocked; the DOM uses jsdom. Localization tests cover browser defaults, manual overrides, English errors/results, and language changes that preserve source text, unchecked proposals, and key preferences.

Python tests check distribution contents, both locales, bilingual document links, byte-for-byte source identity, ASCII process locales, and archive overwrite protection. Lab tests cover receipt storage, grading, and HTTP boundaries. CI runs these checks without TypeSafe credentials. They do not prove live model accuracy, Chrome compatibility, or Chrome Web Store approval.

Diagnostic source text and received submission histories are excluded from the repository. All public examples and test forms use fictional data.
