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

## Cloudflare Workers AI thresholds (Clef and Clef Flash)

As of 2026-10-05, version 0.2.0. Cloudflare Workers AI offers two models. Clef (`clef`, the default) uses the Jev thresholds unchanged. Clef Flash (`clef-flash`) uses them except confidence, which is 0.70 instead of 0.75. For both, p ≥ 0.85, the gap to the second option ≥ 0.2, and the whole-source check (noul ≥ 0.9) are the Jev values.

### Tuning (Node)

`node dev/measure-thresholds.mjs <runs> tuning <model>` ran each tuning fixture through each model with confidence 0 and the other thresholds unchanged, recorded every decision, and replayed confidence values from 0.75 down to 0 on those decisions. The fixtures are `examples/demo-form.html`, `examples/github-app-form.html` and the Japanese contact form `examples/contact-form-ja.html`; expected values are in `dev/forms.mjs`. Copied text often has no trailing newline, and that shifts Clef's confidences, so sources ending in a newline were measured both ways. Repeated Node runs returned identical answers.

| Fixture | Required changes | Clef at 0.75 … 0 | Clef Flash at 0.75 | Clef Flash at 0.70 … 0 | Wrong fills |
| --- | ---: | ---: | ---: | ---: | ---: |
| demo-form | 6 | 6 | 5 | 5 | 0 |
| github-app (both sources) | 7 | 7 | 4 | 4 | 0 |
| contact-ja, source ending in a newline | 5 | 4 | 3 | 3 | 0 |
| contact-ja, no final newline | 5 | 4 | 2 | 3 | 0 |

Each model's value is the highest on a 0.05 grid that reaches the most fills with no wrong fill on these fixtures. For Clef no value from 0.75 down to 0 changed any fill, so it keeps 0.75. On the Japanese and English observation fixtures below, Clef would fill 2 more required fields at 0.70 and 5 more at 0.60 (counting both forms of each source), all correct; those fixtures observe behavior and do not choose thresholds. For Clef Flash, the only decision accepted below 0.75 is the contact form's email `taro@example.com` without the final newline: its range end token had confidence 0.7411 (0.75 with the newline).

Clef's misses: the contact form's email (range start confidence 0.64, p 0.82). Its whole-source check also stopped GitHub App's Webhook URL blank and Meta OFF, which the source leaves as they are. Clef Flash's misses are stopped by gates that were not changed. The whole-source check rejected the demo newsletter OFF (0.76), GitHub App Expire/Active OFF and Contents “Read and write” (0.86–0.87). The contact form's フリガナ range failed p (0.83/0.84). Two rejections prevented wrong fills: the contact form's 氏名 picked the 用件 line and the whole-source check gave it 0.11, and GitHub App's unlisted field was proposed for clearing with p 0.83. Relaxing p to 0.83 would have cleared that field.

### Browser run (verification)

The `npm run package` ZIP, with `http://127.0.0.1/*` added to a test-only copy of the manifest, was loaded into headless Chrome 151 and driven with agent-browser (`dev/e2e/`). The fixture's source text was entered byte for byte, including its trailing newline. Each form was analyzed once, then filled, read back and undone.

With Clef, the default (confidence 0.75):

| Form | Filled correctly | Wrong fills | Undo |
| --- | --- | ---: | --- |
| demo-form | 6 of 6 required; telephone left unchanged | 0 | all restored |
| contact-ja-nonl (no final newline) | 4 of 5 required, plus prefecture 東京都; email skipped | 0 | all restored |
| jp-list | 12 of 15 required | 0 | all restored |
| jp-quoted | 21 of 23 required | 0 | all restored |
| en-list | 3 of 6 required | 0 | all restored |
| lab | normal 27/28, protected 18/18, stress 1/8 (lab grader) | 0 | all restored; the later page edit to Delayed alias kept |

The diagnostics recorded `model: clef`. jp-list filled one field more than Node: Clef's range start for 備考 scored 0.78 in the browser and 0.72 in Node, so Clef's answers are not exactly repeatable. Lab misses were City in the billing address and the stress cases other than the misleading notification email, which Clef filled correctly.

With Clef Flash (confidence 0.70):

| Form | Filled correctly | Wrong fills | Undo |
| --- | --- | ---: | --- |
| demo-form | 5 of 6 required; telephone left unchanged; newsletter OFF rejected by the whole-source check | 0 | all 5 restored |
| contact-ja | 3 of 5 required, plus prefecture 東京都; 氏名 and フリガナ skipped | 0 | all restored |
| contact-ja-nonl (no final newline) | 3 of 5 required, plus prefecture 東京都; the email is filled only because of 0.70 | 0 | all restored |
| lab | normal 25/28, protected 18/18, stress 0/8 (lab grader) | 0 | 25 restored; the later page edit to Delayed alias kept |

Apart from contact-ja-nonl, whose email range end scored 0.7411 as in Node, every accepted row cleared 0.75. Lab misses were 参加方法, the explicit blank for Middle name, and newsletter OFF. Stress cases include the misleading notification email that TypeSafe filled in the 0.1.3 trial.

The browser run replaces `chrome.tabs.query` in the popup tab and grants host access to the local server, so it does not test the production permission path (toolbar click granting activeTab and the popup finding the page's window).

### Limits

The values were fitted on three small fictional forms (18 required changes) and checked on one lab form. They are not calibrated probabilities or accuracy figures. Repeated Node runs of either model gave identical answers, so they add no independent evidence. Clef's browser run of jp-list differed from Node in one field (備考). The replay assumes an answer does not depend on which other questions share a request; the browser runs gave the same fills as the replay for demo-form and contact-ja.

## Japanese application forms and English forms with Japanese text (Clef and Clef Flash)

As of 2026-10-05, version 0.2.0, Cloudflare Workers AI at the thresholds above (Clef 0.75, Clef Flash 0.70), with leading symbol-only tokens such as 〒 dropped from extracted values. These fixtures observe behavior; they did not change any threshold. Forms: `examples/jp-application-form.html` (family/given name, katakana, hiragana, a 3+4 postal code, prefecture select, city/street/building, year/month/day selects, a 3-part phone number, gender and contact radios, half-width and full-width fields, consent checkbox, notes) and `examples/en-signup-form.html` (first/last/full name, email, phone, company, address lines, city, state, postal code, country select). Expected values and known limits are in `dev/forms.mjs`; the Node run is `node dev/measure-thresholds.mjs 1 japan <model>`, which also runs each source without its final newline.

“Required” counts fields whose value the source determines and the extension can write. Known limits are fields the source determines but the extension cannot write, because the value is not an exact source substring it can isolate (Japanese runs such as 東京都渋谷区神南1-2-3 form one token, and 150-0041 or 090-1234-5678 cannot be split into boxes) or needs width conversion or romanization. Leaving a known-limit field unchanged counts as correct. Optional fields accept either the value or no change: a prefecture implied only by an address, the English address lines, and Japanese names in First name / Last name (an English form usually wants romanized names, which the extension cannot produce).

Required fields filled, source ending in a newline (no wrong fill with either model, with or without the newline):

| Source (file) | Form | Clef | Clef Flash | Known limits left unchanged |
| --- | --- | ---: | ---: | --- |
| item: value list (`jp-source-list.txt`) | Japanese | 11/15 | 5/15 | postal code ×2, phone ×3, city, street |
| one paragraph (`jp-source-prose.txt`) | Japanese | 5/7 | 4/7 | family/given name, postal code, phone, city, street |
| full-width digits and symbols (`jp-source-zenkaku.txt`) | Japanese | 6/7 | 2/7 | postal code, phone, city, street, full-width email |
| Japanese era date 平成2年 (`jp-source-wareki.txt`) | Japanese | 6/8 | 4/8 | phone ×3 |
| each value in 「」 (`jp-source-quoted.txt`) | Japanese | 21/23 | 14/23 | none (the source is split per box) |
| Japanese item: value list (`en-source-ja-list.txt`) | English | 3/6 | 3/6 | city, state |
| Japanese paragraph (`en-source-ja-prose.txt`) | English | 2/4 | 1/4 | names, company, city, state |
| romanized values in 「」 with Japanese item names (`en-source-ja-quoted.txt`) | English | 11/12 | 10/12 | none |
| total, with the newline / without | | 65/82, 65/82 | 43/82, 43/82 | |

With Clef the final newline changed two sources in opposite directions: jp-zenkaku 6/7 with it and 5/7 without, en-list 3/6 with it and 4/6 without.

With Clef, the fields still missed were mostly unquoted text: the list's 姓 (confidence 0.62), email and notes; the paragraph's building and email; the era date's birth year (平成2年 not converted); and the English form's Full name (0.747), email and postal code. With 「」 Clef filled everything except two phone boxes, stopped by the whole-source check (0.89, 0.74), and on the romanized English source everything except Address line 1 (0.87). The browser runs of jp-list, jp-quoted and en-list with Clef are in the table above.

The Clef Flash browser runs of jp-list, jp-prose, jp-quoted, en-list, en-prose and en-quoted, made before 〒 was dropped, produced the same fills as Node then, and Undo restored every changed field. The first browser attempt of jp-quoted ended with “The API did not respond in time” and changed nothing; the second attempt succeeded.

What Clef Flash filled and what stopped:

- Closed choices were filled most often. Birth month and day were filled from all four unquoted Japanese sources, the contact radio and consent wherever the source stated them, and the prefecture from the list and the paragraph (the full-width source stopped at the whole-source check, 0.88). Country was filled only from the Japanese paragraph; the whole-source check stopped it at 0.85 (en-list) and 0.68 (en-quoted). The birth year was filled from the paragraph (1990年) but not from the list, the full-width source or the era date; 平成2年 was not converted.
- Unquoted text values go through a token-range step, and Clef's answers there were weak: most of 姓, セイ, email, company, notes and building in the list source stopped at the range start/end or value step (confidence 0.18–0.64, p 0.52–0.82, with the final newline). In Node, every source gave the same fills at 0.70 with and without its final newline.
- Quoting each value with 「」 sends it as a whole candidate. jp-quoted then filled 14 of 23, including the split postal code and phone boxes, city and street. The rest stopped at the whole-source check (0.79–0.90: 姓, メイ, ふりがな, postal code back half, last phone box, birth month, gender) or at the choice gates (birth year, day).
- English form: no Japanese name was put into First name, Last name or Full name in any run; those fields were skipped. Romanized, quoted values (en-quoted) filled 10 of 12; First name (0.88) and Country (0.68) stopped at the whole-source check. Wrong candidates were stopped with little margin: en-list State / Prefecture proposed the whole address `〒150-0041 東京都渋谷区神南1-2-3 みなもビル4F` (range start confidence 0.65, p 0.83), en-prose ZIP / Postal code proposed `〒150-0041` before 〒 was dropped (confidence 0.72, p just under 0.85), and jp-zenkaku's first postal-code box proposed the full-width `１５０` (confidence 0.61, p 0.82). On the Japanese form, jp-list 建物名 proposed the whole address line, stopped far below the gates (confidence 0.18).
- Three decisions here were accepted only because Clef Flash's confidence is 0.70 rather than 0.75: jp-zenkaku birth day (0.7375), jp-wareki セイ (0.7023) and en-list phone (0.7301). All three were correct.

**The 〒 fill.** Before leading symbols were dropped, Clef Flash put `〒150-0041` into en-list's ZIP / Postal code from `住所：〒150-0041 東京都…`: the range start chose the 〒 token (confidence 0.77, p 0.90), the end chose 150-0041 (0.81, 0.92) and the whole-source check accepted it (0.94). An extracted or quoted value now starts after any leading marker token (Unicode category So such as 〒, ☎ or ☎️ with its variation selector; enclosed CJK and letterlike symbols such as ㈱ and № are kept, except ℡) and stays a slice of the source; a value of markers only is skipped. With that, Clef Flash fills `150-0041` there, and neither model made a wrong fill.

Limits: one fictional Japanese form and one English form, eight sources with and without a final newline, one run per model. The expected tables are the author's reading of each source; whether 東京都 should fill a prefecture from an address, or whether `〒150-0041` is acceptable in a postal-code field, are judgment calls recorded in `dev/forms.mjs`.

## Automated checks

Node tests cover exact source slicing, malformed types/probability distributions, missing data, wrong context, explicit blanks/OFF, page order, writeback, Undo, edits during analysis, API failures, and the popup-to-form flow. Model answers and Chrome APIs are mocked; the DOM uses jsdom. Localization tests cover browser defaults, manual overrides, English errors/results, and language changes that preserve source text, unchecked proposals, and key preferences.

Python tests check distribution contents, both locales, bilingual document links, byte-for-byte source identity, ASCII process locales, and archive overwrite protection. Lab tests cover receipt storage, grading, and HTTP boundaries. CI runs these checks without TypeSafe credentials. They do not prove live model accuracy, Chrome compatibility, or Chrome Web Store approval.

Diagnostic source text and received submission histories are excluded from the repository. All public examples and test forms use fictional data.
