# Privacy notes

English · [日本語](PRIVACY.ja.md)

Jev Form Fill sends your source text and form field names, context, types, and options to TypeSafe when you click **Create proposals with TypeSafe**. The endpoint is `https://api.typesafe.ai/v1/systemone` and the model is `jev-latest`. Your API key is sent to TypeSafe in the authorization header. API charges may apply; consult TypeSafe’s terms and data policies for its processing.

Existing field values, cookies, the destination page URL, and the full page body are not included in analysis requests. Personal information appearing in field names or headings is part of the metadata sent. Source text is not automatically scrubbed of secrets.

Your API key normally stays in the open popup. Choosing **Save the key in this browser** and applying settings saves it in `chrome.storage.local`. Chrome sync is not used, and content-script access is disabled. This storage is not an OS credential vault. **Delete saved key** removes it. The UI language preference is also stored locally; selecting a language never saves the API key.

The clipboard is read only when you click **Read clipboard**. Source text and diagnostics are not persisted. Diagnostics contain source text and decisions; review them before sharing in a public issue. Plans and undo values are kept in the extension’s isolated world on the page and disappear on page reload or navigation.

Filled values are visible to the destination website. Its input/change handlers may send them to its server before you submit. The extension never submits forms automatically.

There is no analytics or application backend. GitHub distributes the code and does not receive extension analysis requests. The local test server records submitted fictional data under `.local/form-fill-lab/receipts/` on your computer; that directory is excluded from Git.
