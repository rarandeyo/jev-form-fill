# Form Fill Lab

English · [日本語](README.ja.md)

A local page for trying Jev Form Fill on a form other than GitHub. It grades 28 normal inputs, 18 protected fields, and eight stress cases separately. All data is fictional.

## Try it

```sh
node lab/server.js --port 0
```

1. Open the printed URL in Chrome.
2. Click **情報記載プロンプトをコピー** (copy source prompt), read the clipboard in Jev Form Fill, review proposals, and fill the form.
3. Analyze again to fill Dietary details after it appears dynamically.
4. Click **結果を送信して採点** (submit and grade). Wait for delayed resets before grading.

The adversarial fixture uses Japanese and English labels. The server listens only on `127.0.0.1`. Startup metadata is written to `.local/form-fill-lab/server.json`; receipts go to `.local/form-fill-lab/receipts/`. Results are available at `/api/results` on the same server. Use **初期状態からやり直す** (reset) to start again.

## What makes it difficult

- Repeated name/email labels across participant, billing, shipping, and recovery forms. Fields without supplied information should retain their initial values.
- Explicit blanks/OFF, negative checkbox labels, leading zeros, dates, punctuation, and options whose displayed labels differ from internal values.
- Collapsed permission sections and dynamically added fields.
- Misleading page instructions, immediate/delayed input rejection, and length constraints.
- Custom comboboxes, iframe, and shadow DOM test current limitations. A perfect stress score is not required for ordinary input success.

Grading checks the submitted state, not who filled it, popup warnings, or Undo. Receipts include ordinary form data, excluded-field preservation, and input/change events. Analyzing the form sends source text and field metadata to TypeSafe. This fixture does not register with a real service.

## Tests

```sh
npm ci --ignore-scripts
npm test
```

Tests cover grading, receiving/storing/readback, foreign-origin rejection, and avoiding a false pass before delayed restoration. They verify the fixture, not actual Chrome/Jev filling success.
