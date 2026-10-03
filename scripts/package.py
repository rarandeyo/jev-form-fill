"""Package only extension runtime files and user documentation (Python 3.9+)."""
import argparse
import json
from pathlib import Path
import zipfile

FILES = ('manifest.json', 'popup.html', 'popup.css', 'popup.js', 'core.js',
         'page.js', 'client.js', 'i18n.js', '_locales/en/messages.json',
         '_locales/ja/messages.json', 'README.md', 'README.ja.md', 'PRIVACY.md', 'PRIVACY.ja.md', 'LICENSE',
         'docs/images/review-proposals.jpg', 'docs/images/filled-form.jpg')

def build(root, output):
    root, output = Path(root), Path(output)
    if output.exists():
        raise FileExistsError(f'Archive already exists: {output}')
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    if manifest['version'] != package['version']:
        raise ValueError('Manifest and package versions differ')
    for name in FILES:
        source = root / name
        if source.is_symlink() or not source.is_file():
            raise ValueError(f'Missing or symbolic-link source: {name}')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            info = zipfile.ZipInfo('jev-form-fill/' + name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (root / name).read_bytes())
    return output

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=root / 'dist/jev-form-fill.zip')
    args = parser.parse_args()
    print(build(root, args.output))
