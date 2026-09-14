# Before You Post

A privacy-first photo metadata checker and cleaner that runs entirely in the browser.

## What it does

- Checks JPEG, PNG, and WebP images for common EXIF, XMP, location, timestamp, and device metadata signatures.
- Re-encodes the photo locally to create a clean copy without hidden metadata.
- Never uploads the selected photo or requires an account.

## Development

```bash
pnpm install
pnpm dev
```

Every push to `main` is built and deployed automatically with GitHub Pages.
