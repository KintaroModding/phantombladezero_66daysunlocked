# 66 Days Unlocked

Unlocks the 66 Days difficulty from the start: begin a new game in it without beating the game once.

A mod for Phantom Blade Zero (Unreal Engine 5.7), made with game version `CL-301524_JKS-17219` (Steam build
26266538). This README is for developers. What the mod does, how to install it and its compatibility are in
[openmods.md](openmods.md), the mod page on [openmods](https://openmods.nexus).

## How it works

The game runs much of its menu logic as JavaScript (Puerts). The scripts are loose files in the game's
`ProjectPBZ-Windows.pak`, and each one is a mixin: its methods replace Blueprint functions of the same name.

The difficulty screen (`/Game/PBZContent/UI/Menu/StartMenu/WB_DifficultySelect_V2`) asks its own Blueprint function
`CanSelectNightmare` whether 66 Days may be chosen; that function asks the game's C++ check
`PBZGameSystem.CanSelectNightMare`, which says yes only after a finished game. The mod replaces the game's script for
this screen, `ProjectPBZ/Content/JavaScript/UI/Widget/DifficultySelect_V2.js`, with a copy that has one more method:

```js
CanSelectNightmare(CanSelect) {
    (0, puerts_1.$set)(CanSelect, true);
}
```

Everything else in the file is the game's own code (`git diff` against the first commit shows the change). The mod
writes nothing into the save: without it, the game's lock is back.

The mod replaces the whole script file. A mod that changes the same file conflicts with this one, and a game update
that changes it needs a new build of the mod from the new file.

## Build

Requirements:

- Windows PowerShell 5.1 (part of Windows).
- [repak](https://github.com/trumank/repak/releases) v0.2.3 and [retoc](https://github.com/trumank/retoc/releases)
  v0.1.5. `build.ps1` looks for `_tools\repak\repak.exe` and `_tools\retoc\retoc.exe` in the parent folders of the
  project; set `UE5_TOOLS` to a folder that holds both to use another place.
- Optional: [Node.js](https://nodejs.org/) for the syntax check and the offline test (`tests\test_mod.js`).

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1             # dist\phantombladezero_66daysunlocked_P.pak/.utoc/.ucas
powershell -ExecutionPolicy Bypass -File .\build.ps1 -Deploy     # build, then copy the files to Paks\~mods
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -Wait      # copy the files when the game is closed
```

The build checks every `.js` in `src` with `node --check` and runs `tests\test_mod.js` (it loads the script with
stand-ins for the game's modules and checks that `CanSelectNightmare` answers yes). Then it packs `src` into a `.pak`
(repak, pak version V11, mount point `../../../`), writes an empty IoStore container of the same name (retoc
`to-zen`; an IoStore game can ignore a `.pak` without one), and checks that the pak holds exactly the files of `src`,
byte for byte.

`deploy.ps1` copies the three files to `<game folder>\ProjectPBZ\Content\Paks\~mods`. The game folder comes from
`gameDir` in `_tools\gamedata\phantombladezero\game.json`, else `$env:UE5_GAMES_DIR\PBZ`; `-GameDir` or `-ModsDir`
override it. The running game locks the files, so the script stops (exit code 2) or, with `-Wait`, waits until the
game is closed.

Versioning: every change raises the second number in `mod.json` (1.0 -> 1.1): `python scripts\bump_version.py`.

## Project layout

```
src/                               Mod source: the changed game script at its path in the game's pak
tests/test_mod.js                  Offline test of the script (Node.js)
dist/                              Build output: the .pak/.utoc/.ucas for Paks\~mods (git-ignored)
docs/                              Cover and screenshots for openmods.md
scripts/bump_version.py            Raises the version in mod.json
build.ps1                          Checks and builds dist\ from src\
deploy.ps1                         Copies the build to the game's Paks\~mods folder
mod.json                           Name, version, game, engine and file names
```

## License

MIT, see [LICENSE](LICENSE). The script in `src` is the game's own code with the change above; Phantom Blade Zero
and its files belong to their makers.
