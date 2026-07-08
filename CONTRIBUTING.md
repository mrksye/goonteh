# Contributing

Found a bug? Please open an issue and let me know — I'll fix it on my end.

Want a feature? Please open an issue — I know there's still a lot missing, so I'd love to hear what you need.

If you'd rather fix it yourself, open an issue and send a PR — I'll usually merge it in.

## `null` vs `undefined`

Default to `undefined` for "nothing there". Use `null` only when you deliberately put it there, or
when the DOM/a framework hands it to you (e.g. `elementFromPoint`, React refs, `render(null)` to
unmount). So a `null` in this code is always on purpose.
