# Jev Form Fill

**Copy notes. Review proposals. Fill the right fields.**

[English](README.md) · [日本語](README.ja.md)
[![Checks](https://github.com/takasek/jev-form-fill/actions/workflows/ci.yml/badge.svg)](https://github.com/takasek/jev-form-fill/actions/workflows/ci.yml) [![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A Chrome extension that matches your clipboard text to form fields with **TypeSafe Jev**. Review the proposed values, choose which fields to change, and fill them in page order. Fields without a supported value stay unchanged. Explicit blanks, checkboxes, radio buttons, and selects are supported. Undo restores the last fill. You submit the form yourself.

**Preview v0.2.0 · Chrome 116+ · Bring your TypeSafe API key, or a Cloudflare Workers AI API token and Account ID.** Creating proposals sends your source text and field metadata to the provider you select; API charges may apply. Read the [privacy notes](PRIVACY.md).

## See it in action

![Jev Form Fill reviewing registration form proposals in Chrome](docs/images/review-proposals.jpg)

**1. Copy** notes or settings. **2. Review** the proposed field values. **3. Fill** only the fields you choose.

![The registration form after filling with Jev Form Fill](docs/images/filled-form.jpg)

These screenshots use the actual Chrome extension and a fictional registration form. The source text is ordinary English; values are copied exactly rather than rewritten. The telephone field has no supplied value and stays untouched, the reference code keeps its leading zeros, and the newsletter is explicitly switched off.

Example source:

```text
Full name: `Mika Arai`
Work email: `mika.arai@example.test`
Company: `Minamo Research Lab`
Meal preference: Vegetarian
Reference code: `004207`
Do not subscribe to the newsletter.
The telephone number is unknown; leave it unchanged.
```

## Install

No build step or Node.js is required to use the extension.

1. Download this repository using **Code → Download ZIP**, or clone it.
2. Extract it, then open `chrome://extensions`.
3. Turn on **Developer mode** and choose **Load unpacked**.
4. Select the folder containing `manifest.json`.
5. Open **Jev Form Fill** from Chrome’s extensions menu. Pin it if you use it often.

A packaged extension ZIP, when available, contains a `jev-form-fill` folder; load that folder. From the source repository, `npm run package` builds `dist/jev-form-fill.zip`; extract it and load the `jev-form-fill` folder inside. To update, replace the contents of your loaded folder and reload the extension in `chrome://extensions`.

## Use

1. Copy your notes and open the target page.
2. Open Jev Form Fill and click **Read clipboard**, or paste into **Source text**.
3. Under **Connection settings**, choose the model provider (TypeSafe or Cloudflare Workers AI) and enter its key. Cloudflare Workers AI needs an API token and your 32-character Account ID. Keys stay in this popup unless you explicitly choose to save them in this browser.
4. Click **Create proposals with TypeSafe** (or **Create proposals with Cloudflare Workers AI**). Keep the popup open while it works.
5. Review the values, uncheck fields you want to keep, and click **Fill selected fields**. Selected proposals can replace existing values.
6. Check the result in the popup and on the page, then submit the form yourself. **Undo last fill** restores the most recent write while preserving later manual edits.

The UI follows your browser language (English or Japanese). Use the **Language** selector to override it. Changing UI language does not translate your source text, field labels, or values.

Failures appear **inside the popup**, with counts and a reason for each field. “The page did not accept the value” and “The page changed the value after filling” indicate failures. Closing the popup loses that display; no markers are added to the form. After applying, “0 proposals” means there are no unapplied proposals remaining.

When new fields appear after a selection, create proposals again. Fields edited manually or changed since analysis are skipped. Page navigation, reload, or extension reload clears plans and undo data.

## What it handles

| Supported | Top-level input fields: text, email, tel, url, search, number, date, time, datetime-local, checkbox, radio; textarea; single-select |
| --- | --- |
| Left alone | Password, file, hidden, month/week/range/color, disabled/readonly, submit buttons, multi-select, iframe, shadow DOM, contenteditable, widgets without native form controls |
| Limits | 12,000 source characters, 120 source lines, 160 fields per analysis; unquoted range extraction up to 240 tokens per line |
| Values | Exact quoted values or ranges from one source line; no paraphrasing, multi-line synthesis, or date calculations |

Native `details` are opened for scanning and then restored. Open other collapsed sections yourself. Radio groups are handled only when the entire same-name group in the same form can be operated on. Credential/payment-looking text fields are excluded heuristically; secrets in the source text are not automatically removed.

Readback checks run after writes and again 650ms after the entire fill. There is no ongoing monitor after that. Jev judgments can vary between runs, so always review the proposals and the final values. Model thresholds are application policy, not measured accuracy.

## Privacy, permissions, and cost

Requests go directly to `https://api.typesafe.ai/v1/systemone`, using `jev-latest`. The source text, field names, headings, types, and options are sent. Existing field values, cookies, the page URL, and the full page body are not included in analysis requests. Names/headings themselves may contain personal information. There is no analytics or application backend.

With Cloudflare Workers AI selected, requests go to `https://api.cloudflare.com/client/v4/accounts/{Account ID}/ai/run/@cf/cloudflare/clef-flash` using Clef (`clef-flash`), with the same content. Keys are kept per provider, and only the selected provider’s key is sent.

Fields are analyzed in batches of eight, with 1–4 API requests per batch. HTTP failures are not retried automatically. Saved API keys use `chrome.storage.local`, not Chrome sync or an OS credential vault. See [PRIVACY.md](PRIVACY.md) for details.

Permissions: `activeTab`, `scripting`, `storage`, `clipboardRead`, and the TypeSafe and Cloudflare API hosts. Form input events may cause the destination site to transmit values before you submit.

## Try the demo and run tests

Development commands require the [source repository](https://github.com/takasek/jev-form-fill), not just the packaged extension ZIP. Run them at the repository root with Node.js 22+.

```sh
npm ci --ignore-scripts
npm test
node lab/server.js --port 0
```

Open the printed URL in Chrome. The lab binds only to `127.0.0.1` and saves fictional results under the Git-ignored `.local/form-fill-lab/receipts/`. See the [lab guide](https://github.com/takasek/jev-form-fill/blob/main/lab/README.md) and [validation notes](https://github.com/takasek/jev-form-fill/blob/main/docs/validation.md). A compact form used for the screenshots is in [examples/](https://github.com/takasek/jev-form-fill/tree/main/examples).

In one real Chrome/API run of v0.1.3, normal inputs matched **28/28** and protected fields remained correct **18/18**. Stress tests matched **1/8**, with unsupported cases documented. A second analysis filled the dynamic dietary field and displayed both page-rejection failures; that second run was not fully graded. This is a fixture result, not a claim of compatibility with every website. The live GitHub App creation page is unverified.

Tests use mocked model answers/Chrome APIs and jsdom; they do not call TypeSafe. Build the distribution ZIP with Python 3.9+:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run package
```

The ZIP includes runtime files, bilingual installation/privacy notes, screenshots, and the license. It excludes tests, server data, dependencies, and API keys. Existing ZIPs are never overwritten by the packaging script.

## How it works

Jev selects candidate source passages and exact quoted values. A whole-source Noul check must support a proposed value before it becomes fillable. Unquoted values use start/end token choices to slice the original text. Explicit blanks and OFF instructions are checked separately from missing information. Page writes use native setters and input/change events, then readback. All form submission stays under your control.

[TypeSafe API](https://docs.typesafe.ai/api) · [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) · [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) · [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)

MIT License. An independent project, not an official TypeSafe product.
