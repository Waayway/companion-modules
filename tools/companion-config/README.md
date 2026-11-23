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
