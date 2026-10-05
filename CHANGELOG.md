# Changelog

## 0.2.0

- Cloudflare Workers AI as a second model provider, selectable next to TypeSafe in the popup settings, with two models: Clef (`clef`, default) and Clef Flash (`clef-flash`). Both share one API token and Account ID; the chosen model is saved, and an existing Cloudflare setup without one uses Clef.
- API keys are stored per provider; a saved legacy TypeSafe key moves to the new storage on first open.
- Switching provider or model discards existing proposals. Diagnostics record the provider, model and decision thresholds used.
- Clef uses the Jev decision thresholds; Clef Flash uses them except confidence (0.70), measured on fictional forms; see docs/validation.md.
- An extracted value no longer starts with a symbol-only token such as 〒 or ☎; a range of symbols only is skipped.

## 0.1.5

- English and Japanese UI, following the browser language with an explicit override.
- Localized progress, errors, proposal reasons, and fill/undo results.
- English README and privacy notes with Japanese editions.
- Actual Chrome screenshots and a compact fictional registration demo.


## 0.1.4

- 公開用の名称、インストール説明、データの扱い、検証結果を整理。
- 架空フォームの試験サーバー、CI、配布ZIPの作成手順を同梱。
- 試験の保存先をチェックアウト内のGit管理対象外フォルダに変更。
- フォーム解析・適用の動作は0.1.3と同じ。

## 0.1.3

- 完全な引用値を全文の裏付け確認へ渡し、確認を通った候補だけ入力可能にする。
- 根拠と値の選択確率を診断に表示。

## 0.1.0–0.1.2

- 初期の非公開試作。標準フォームの解析、候補確認、明示空欄・オフ、読戻し、Undo。
- セクション文脈と引用値の選択を改善。
