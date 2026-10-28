# Cipherline

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

**Live app:** https://marcus-mok-gh.github.io/cipherline/

A paper-faithful steganography lab for Pollinations quest [#18367](https://github.com/pollinations/pollinations/issues/18367).

It re-runs the experiment from [*How does Fable 5.1 hide messages in images?*](https://www.lesswrong.com/posts/WHEQps5PK8LrrcTAb/how-does-fable-5-1-hide-messages-in-images):

1. **Hider** — Claude Fable 5.1 (or Astra / GPT-5.4) draws an SVG that hides your secret using only visual structure — no metadata, comments, or invisible text.
2. **Screenshot** — the SVG is rendered to a bitmap, optionally JPEG-reencoded to simulate screenshot loss.
3. **Seeker** — a fresh multimodal call sees only the image and must recover the message with the paper’s decode prompt.
4. **Grading** — ≥90% normalized string similarity counts as recovered, matching the paper.

## Why this beats metadata toys

- Uses the **exact hide/seek prompts** from the paper, not SVG `<metadata>` tags.
- Tests **screenshot survival** (the paper’s actual setting).
- Classifies the **five scheme families** (height, Morse, rotation, colour, acrostic).
- Includes a **deterministic offline height-encoding demo** (the family Fable used in 33/50 images).
- Real **Bring Your Own Pollen** — your key pays for the model calls.

## Use it

1. Open the [live app](https://marcus-mok-gh.github.io/cipherline/).
2. Click **Connect with Pollen** or paste a key from [enter.pollinations.ai](https://enter.pollinations.ai).
3. Enter a short secret → **Hide it**.
4. Read the seeker’s `FINAL ANSWER` and the similarity score.

## Local

Static site — any HTTP server works (ES modules need a server, not `file://`):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Files

| File | Role |
|------|------|
| `index.html` | UI |
| `app.js` | Lab orchestration |
| `stego.js` | Paper prompts, SVG extract, grading |
| `pollen.js` | BYOP auth + chat completions |
| `demo.js` | Offline height skyline encode/decode |
| `styles.css` | Theme |

## Licence

MIT
