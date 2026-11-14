# Developer guide

## Build tooling

A hand-rolled Vite build (`scripts/build.mjs`) with three outputs: the popup/dashboard HTML apps, `background.js` and `content.js`.
Why not `@crxjs/vite-plugin`: `chrome.scripting.executeScript({ files: ['content.js'] })` needs a stable, self-contained classic script whose completion value is the result; a small explicit build keeps that predictable and avoids coupling to a plugin's Vite compatibility.

## Content script result

`content.js` is built as an IIFE with a footer (`content;`) so the extracted snapshot is the script's completion value, which `executeScript` returns.
