# Third-party notices

SweaxBeacon is MIT licensed (see [LICENSE](LICENSE)). It is built on, or ships with, the following work by others. Thank you to their authors.

## Shipped in the installer

| Component | Version | License | Where it is used |
| --- | --- | --- | --- |
| [Electron](https://github.com/electron/electron) | 33.4 | MIT | Application runtime. Electron includes Chromium and Node.js; their licenses are installed next to the app as `LICENSE.electron.txt` and `LICENSES.chromium.html`. |
| [React](https://github.com/facebook/react) and React DOM | 18.3.1 | MIT | Interface, bundled into `dist/` |
| [scheduler](https://github.com/facebook/react/tree/main/packages/scheduler) | 0.23.2 | MIT | Dependency of React DOM, bundled into `dist/` |
| [Onest](https://github.com/simpals/onest), © 2021 The Onest Project Authors | variable | SIL Open Font License 1.1 | Interface type, bundled into `dist/`. License text: [`src/fonts/OFL-Onest.txt`](src/fonts/OFL-Onest.txt) |
| [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans), © 2021 The Pixelify Sans Project Authors | variable | SIL Open Font License 1.1 | Numbers, coordinates and commands, bundled into `dist/`. License text: [`src/fonts/OFL-PixelifySans.txt`](src/fonts/OFL-PixelifySans.txt) |
| [NSIS](https://nsis.sourceforge.io/) (via electron-builder) | | zlib/libpng | The one-click installer and uninstaller |

The font files come from the `@fontsource-variable/onest` (5.3.1) and `@fontsource-variable/pixelify-sans` (5.3.0) packages. The same files are in `docs/fonts/` for the website, and subsets of them are embedded in `docs/art/*.svg`.

`native/bin/sweax-helper.exe` is compiled from [`native/SweaxHelper.cs`](native/SweaxHelper.cs) in this repository with the C# compiler of .NET Framework 4, which comes with Windows.

## Not shipped

Nothing from Minecraft is included. The pixel icons are drawn by [`tools/pixel_icons.py`](tools/pixel_icons.py). Item names in the player's language are read at run time from the language file their own Minecraft launcher downloaded; the list of item ids in `src/data/items.json` was produced with the data generator of the Minecraft 1.21.11 server (`--reports`).

Minecraft is a trademark of Mojang Synergies AB. SweaxBeacon is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.

## Used only to build and test, not shipped

| Component | License | Use |
| --- | --- | --- |
| [Vite](https://github.com/vitejs/vite) and [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT | Bundling the interface |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Building the installer |
| [sharp](https://github.com/lovell/sharp) and [png-to-ico](https://github.com/steambap/png-to-ico) | Apache-2.0, MIT | Drawing the app icon |
| [ws](https://github.com/websockets/ws) | MIT | Test scripts |
| [fontTools](https://github.com/fonttools/fonttools) | MIT | Subsetting fonts into the README artwork |
| [FFmpeg](https://ffmpeg.org/) | LGPL/GPL | Encoding the demo GIFs and videos |
