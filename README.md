# Top AI Prompt Gallery

A static GitHub Pages page for collecting reference images and image prompts.

## Add a permanent published entry

1. Upload your image to `assets_images/`.
2. Add a new object to `data/prompts.json`.
3. Commit and push to GitHub Pages.

Example:

```json
{
  "id": "my-new-prompt",
  "title": "My New Prompt",
  "image": "assets_images/my-reference.jpg",
  "prompt": "Your full image prompt...",
  "type": "Product",
  "tags": ["studio", "macro"],
  "notes": "Optional notes",
  "createdAt": "2026-05-02"
}
```

The page also has an Add image button. Items added there are saved in the current browser with `localStorage`. Use Export and Import to move those local entries between browsers or convert them into permanent `data/prompts.json` entries.

## GitHub Pages

In the repository settings, enable Pages from the default branch and root folder. The page will then serve `index.html` automatically.
