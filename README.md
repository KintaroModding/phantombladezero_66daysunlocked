# 66 Days Unlocked

Unlocks the 66 Days difficulty from the start: begin a new game in it without beating the game once. A PBZModLoader mod; no game file replaced, nothing written into the save.

A [PBZModLoader](https://github.com/KintaroModding/phantombladezero_pbzmodloader) mod for Phantom Blade Zero (Unreal Engine
5.7), made with game version `CL-302256_JKS-17280` and PBZModLoader 2.1.0. This README is for developers.
What the mod does, how to install it and its compatibility are in [openmods.md](openmods.md), the mod page on
[openmods](https://openmods.nexus).

## How it works

The game runs much of its logic in JavaScript (Puerts). PBZModLoader loads every folder in
`ProjectPBZ/PBZModLoader/mods/` that has a `main.js`, through the game's own module system, after the game's
`MainStart`; `require("ue")`, `require("puerts")` and `require("Library/TsHelper")` are the game's modules, and
`puerts.argv.getByName("GameInstance")` gives the game instance. Before a reload (Alt+F5) the loader awaits the mod's
`stop()`, which must give back everything the mod changed.

The difficulty screen `/Game/PBZContent/UI/Menu/StartMenu/WB_DifficultySelect_V2` (New Game and New Game Plus) asks
its Blueprint function `CanSelectNightmare` (lower-case m, out parameter `CanSelect`) whether 66 Days can be chosen;
that function calls the C++ `PBZGameSystem.CanSelectNightMare`, true only after a finished game (the account-wide flag
`bCanSelectNightMare`). `MainStart.js` mixes the game's `UI/Widget/DifficultySelect_V2.js` (`DifficultySelectV2Interface`)
into that screen with `blueprint.mixin`, and a mixin method of the same name replaces the Blueprint function (the screen
calls it by name, as it calls the mixin's `ClickNightmareTips`).

`main.js` adds `CanSelectNightmare(CanSelect)` to `DifficultySelectV2Interface.prototype` at start: with `Enable` it
sets `CanSelect` to true (`puerts.$set`), without it asks the game's check (`TsHelper.getWorldSubsystem(screen,
PBZGameSystem).CanSelectNightMare()`), as the Blueprint function does. The 66 Days rules stay the game's; nothing is
written into the save.

Puerts' `blueprint.mixin` copies the prototype's methods when the screen's class mixes (the first time the screen opens,
after the mod started), and the game keeps that copy across Alt+F5. So the added method looks up its answer in
`globalThis.__66DaysUnlockedHooks` at call time (the running copy fills it, `stop()` deletes it); with no copy of the mod
running it gives the game's own answer. `stop()` removes the method from the prototype again (or puts back one that was
there before). The first answer of a session writes `the difficulty menu asked: 66 Days is open` into `loader.log`.

2.0 is the port of 1.0 (2026-10-29), which added the same method to a replaced copy of `DifficultySelect_V2.js` in a
pak; since the game update of 2026-11-04 the game refuses a changed script without a bypass.

`tests/test_mod.js` runs the script in Node.js against a stand-in screen class that mixes like Puerts (a copy of the
methods, kept across a reload) and the game's check (29 checks).

- **Settings file:** `phantombladezero_66daysunlocked.txt` next to `main.js` (`__dirname`, the mod's folder as a full path), read every
  2 s with `EasyCsv.LoadStringFromLocalFile` and written with the defaults when missing. The shipped file is exactly the
  script's default text (`tests/test_mod.js` checks it).
- **Mods Menu, optional:** PBZModLoader starts its mods after Mods Menu's, so a running Mods Menu (0.9.0 or later) has
  its registry object in `globalThis.PBZModsMenu` by then. Only when it has the features `settingsPath` and
  `store.saved`, the mod pushes its page (id `phantombladezero_66daysunlocked`, `store: "saved"`) and reads the file the page saves
  (`PBZModsMenu.settingsPath(id)`, in Mods Menu's Saved folder): a registered page cannot save anywhere else.
- **Log:** `console.log` lines that start with `[PBZMOD]` and the game's warnings reach `ProjectPBZ/PBZModLoader/loader.log`.

## Check and deploy

Requirements: Windows PowerShell 5.1 and [Node.js](https://nodejs.org/) (for `node --check` and the offline test).

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1             # node --check, tests\test_mod.js
powershell -ExecutionPolicy Bypass -File .\build.ps1 -Deploy     # the checks, then deploy.ps1
powershell -ExecutionPolicy Bypass -File .\deploy.ps1            # copy src\phantombladezero_66daysunlocked to the game
```

`deploy.ps1` mirrors `src\phantombladezero_66daysunlocked\` to `<game folder>\ProjectPBZ\PBZModLoader\mods\phantombladezero_66daysunlocked\`. The
settings file that is already there is the tester's and stays; `-ResetConfig` copies the shipped one. The game folder
comes from `gameDir` in `_tools\gamedata\phantombladezero\game.json`, else `$env:UE5_GAMES_DIR\PBZ`; `-GameDir` or
`-ModsDir` override it. It stops when PBZModLoader is not installed (its start file
`ProjectPBZ\Content\JavaScript\PBZModLoader\bootstrap.js` is missing).

The GitHub release zip holds the mod folder at `ProjectPBZ/PBZModLoader/mods/phantombladezero_66daysunlocked/`, so players unpack it
into the game folder.

Versioning: every change raises the second number in `mod.json` and `main.js` (1.0 -> 1.1): `python scripts\bump_version.py`.

## Project layout

```
src/phantombladezero_66daysunlocked/   The mod folder: main.js and the shipped settings file
tests/test_mod.js     Offline test of main.js (Node.js, stand-ins for the game)
docs/                 Cover and screenshots
scripts/              bump_version.py, check_openmods.py, publish.ps1
build.ps1, deploy.ps1 Checks; copy into the game
mod.json              Name, version, game, kind pbzmodloader, modsPath
```

## License

MIT, see [LICENSE](LICENSE).
