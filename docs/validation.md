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

## Automated checks

Node tests cover exact source slicing, malformed types/probability distributions, missing data, wrong context, explicit blanks/OFF, page order, writeback, Undo, edits during analysis, API failures, and the popup-to-form flow. Model answers and Chrome APIs are mocked; the DOM uses jsdom. Localization tests cover browser defaults, manual overrides, English errors/results, and language changes that preserve source text, unchecked proposals, and key preferences.

Python tests check distribution contents, both locales, bilingual document links, byte-for-byte source identity, ASCII process locales, and archive overwrite protection. Lab tests cover receipt storage, grading, and HTTP boundaries. CI runs these checks without TypeSafe credentials. They do not prove live model accuracy, Chrome compatibility, or Chrome Web Store approval.

Diagnostic source text and received submission histories are excluded from the repository. All public examples and test forms use fictional data.
