# Open Analytics Menu Bar

Your site's live visitor count, in the macOS menu bar. Click the icon for a
small popover with today's numbers and a jump into the full dashboard at
[app.getopen.so](https://app.getopen.so).

Built with [Tauri v2](https://v2.tauri.app), so the whole app is a few
megabytes and idles quietly.

## How it signs in

The app talks only to the public Open Analytics API surfaces:

- It registers itself once as a public OAuth client (RFC 7591 dynamic client
  registration), then signs you in with the device flow (RFC 8628): a short
  code, a browser approval, done. No password ever touches the app.
- Tokens are stored in the macOS keychain, never on disk.
- Data comes from the read API (`/v1/read/*`) and the realtime stream, with
  read-only scopes: `site:read analytics:read realtime:read revenue:read`.

Signing out removes the tokens from the keychain.

## Development

Prerequisites: Rust (stable) and the Xcode command line tools.

```sh
# tauri CLI once
cargo install tauri-cli --locked

# run in development
cargo tauri dev

# build the .app and .dmg
cargo tauri build
```

The frontend is static HTML/CSS/JS in `src/`; there is no Node build step.
Icons are generated from code: `node scripts/generate-icons.mjs`.

Point the app at another deployment with `OA_API_URL` and `OA_REALTIME_URL`.

## License

MIT
