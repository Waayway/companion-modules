# companion-config

`convert.mjs` turns a Companion export that drives the old "Generic HTTP + mangocompanion.py" setup into
one that uses the `linux-media` and `mangohud` modules.

```
node tools/companion-config/convert.mjs old.companionconfig new.companionconfig
node --test tools/companion-config/
```

What it changes (the run prints a report of every change):

- The generic-http `bridge` connection is replaced by two connections, labelled `media` (linux-media) and
  `mangohud` (mangohud).
- HTTP actions become module actions: `/music/play-pause|next|previous|shuffle|loop|vol-up|vol-down` to the
  media actions, `/preset/<n>` and `/preset/cycle` to MangoHud `set_preset` / `cycle_preset`.
- `$(custom:mp_title)` and friends become `$(media:title)` / `$(mangohud:...)`, in button text, in
  `variable_value` feedbacks and in feedback style overrides. The 21 custom variables are removed.
- Buttons that need system audio (system volume, system mute, mic mute) are removed: the modules do not
  support them. The cell stays empty.
- The gamemode "req" feedback is dropped (the module only reports on/off).
- Credentials of other connections (the Discord client secret and tokens) are removed from the output. The
  Discord connection and its buttons stay; enter the Discord client id and secret again after importing.
- Pages, navigation, surfaces, the image library and every other button are copied unchanged.

The input file is never committed (it contains credentials); the converted output is.

Import in Companion: Import / Export, "Import" the file, choose to reset the whole configuration or to import
the pages, and make sure the developer modules path is set (see the repository README).

## The converted config in this repo

`config/wdesktop.companionconfig` is the output for the owner's own export (three pages: MUSIC,
MUSIC+CALL, GAMING). It was imported into a real headless Companion 5.1.3 with both modules loaded and every
music and MangoHud button was pressed against fake backends: 23 of 23 checks passed
(`tools/smoke/verify-config.sh config/wdesktop.companionconfig`). The Discord buttons are carried over but the
Discord connection has no credentials: enter its client id and secret after importing. The system-audio
buttons are gone on purpose (cells left empty).

## add-racing.mjs

Adds the sim racing pages to an export (for example the converted one):

```
node tools/companion-config/add-racing.mjs in.companionconfig out.companionconfig
```

- Adds a `buttonbox` connection (module `buttonbox`), or reuses the existing one.
- Adds page `RACING` (buttons 1-12 on rows 0-2, keys 1-4) and `RACING 2` (buttons 13-16 on row 0), each with the
  pageup/pagenum/pagedown column. Existing pages with those names are replaced, so running it twice is safe.
- Hold buttons (START, FLASH, HORN, LOOK BACK, RADIO) send `press` on down and `release` on up and have a
  different background colour; the others send `tap` on down.
- Button style is cloned from the first GAMING button (without its icon). Other pages, connections and surfaces are
  not touched.
