# Third-party notices

SweaxPanel is MIT licensed (see [LICENSE](LICENSE)). It is built on, or ships with, the following work by others. Thank you to their authors.

## Shipped in the installer

| Component | Version | License | Where it is used |
| --- | --- | --- | --- |
| [Electron](https://github.com/electron/electron) | 33.4 | MIT | Application runtime. Electron includes Chromium and Node.js; their licenses are installed next to the app as `LICENSE.electron.txt` and `LICENSES.chromium.html`. |
| [React](https://github.com/facebook/react) and React DOM | 18.3.1 | MIT | Interface, bundled into `dist/` |
| [scheduler](https://github.com/facebook/react/tree/main/packages/scheduler) | 0.23.2 | MIT | Dependency of React DOM, bundled into `dist/` |
| [NSIS](https://nsis.sourceforge.io/) (via electron-builder) | | zlib/libpng | The one-click installer and uninstaller |

The app uses the system fonts Segoe UI, Consolas and Segoe UI Emoji that come with Windows. They are not redistributed.

## Website and artwork (`docs/`)

| Component | License | Where it is used |
| --- | --- | --- |
| [Instrument Sans](https://github.com/Instrument/instrument-sans), © 2022 The Instrument Sans Project Authors | SIL Open Font License 1.1 | `docs/fonts/`, and subsets embedded in `docs/art/*.svg`. License text: [`docs/fonts/OFL-InstrumentSans.txt`](docs/fonts/OFL-InstrumentSans.txt) |
| [Martian Mono](https://github.com/evilmartians/mono), © 2020 The Martian Mono Project Authors | SIL Open Font License 1.1 | `docs/fonts/`, and subsets embedded in `docs/art/*.svg`. License text: [`docs/fonts/OFL-MartianMono.txt`](docs/fonts/OFL-MartianMono.txt) |

The font files were taken from the `@fontsource-variable/instrument-sans` and `@fontsource-variable/martian-mono` packages, version 5.3.0.

## Used only to build, not shipped

| Component | License | Use |
| --- | --- | --- |
| [Vite](https://github.com/vitejs/vite) and [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT | Bundling the interface |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Building the installer |
| [sharp](https://github.com/lovell/sharp) | Apache 2.0 | Rendering the app icon (`build/make-icon.mjs`) |
| [png-to-ico](https://github.com/steambap/png-to-ico) | MIT | Writing `build/icon.ico` |
| [ws](https://github.com/websockets/ws) | MIT | Listed as a dev dependency; not used by the app or the scripts in this repository |
| [fontTools](https://github.com/fonttools/fonttools) | MIT | Subsetting fonts for `docs/art` (`tools/art.py`) |
| [Pillow](https://github.com/python-pillow/Pillow) | MIT-CMU | Resizing the icon for `docs/art` (`tools/art.py`) |
| [FFmpeg](https://ffmpeg.org/) | LGPL 2.1+ / GPL | Encoding `docs/media/demo.mp4` and `demo.gif` (`tools/media/encode-film.cjs`) |

## Protocol

The RCON client in `electron/rcon.cjs` implements the [Source RCON protocol](https://developer.valvesoftware.com/wiki/Source_RCON_Protocol) published by Valve, which Minecraft Java Edition servers use for remote console access.

## Trademarks

Minecraft is a trademark of Mojang Synergies AB. SweaxPanel is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft. Windows is a trademark of Microsoft Corporation.
