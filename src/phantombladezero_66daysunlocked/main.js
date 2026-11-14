"use strict";
// 66 Days Unlocked for Phantom Blade Zero: a PBZModLoader mod (ProjectPBZ/PBZModLoader/mods/phantombladezero_66daysunlocked/).
//
// The 66 Days difficulty is open in the difficulty menu of a new game, also before the game was finished once.
//
// The difficulty screen WB_DifficultySelect_V2 asks its Blueprint function CanSelectNightmare (out parameter CanSelect)
// whether 66 Days can be chosen; that function asks PBZGameSystem.CanSelectNightMare, which is true only after a
// finished game. The game's script UI/Widget/DifficultySelect_V2.js exports DifficultySelectV2Interface, the mixin of
// that screen; a mixin method of the same name replaces the Blueprint function (Puerts). The mod adds
// CanSelectNightmare to the mixin's prototype: with Enable it answers yes, without it asks the game's own check, as the
// Blueprint function does. The 66 Days rules stay the game's, and nothing is written into the save: without the mod the
// lock is back.
// Puerts' blueprint.mixin copies the prototype's methods when the screen's class mixes (the first time the screen
// opens), and the game keeps that copy across Alt+F5. So the method looks up its answer in globalThis[HOOKS_KEY] at call
// time, which the running copy fills at start and stop() deletes; with no copy of the mod running it gives the game's own
// answer.
//
// 2.0: the port of 1.0, which added the same method to a replaced copy of DifficultySelect_V2.js in a pak (since the
// game update of 2026-11-04 the game refuses a changed script without a bypass).
//
// PBZModLoader loads this file after the game's MainStart, through the game's module system: "ue", "puerts",
// "Library/TsHelper" and "UI/Widget/DifficultySelect_V2" are the game's modules. Before a reload (Alt+F5) it awaits
// stop(). Settings: phantombladezero_66daysunlocked.txt next to this file (__dirname), "Key=Value" lines (; or # starts a
// comment, the first line of a key wins), read at most every SETTINGS_MS when the screen asks, and written with the
// defaults when missing. With Mods Menu (0.9.0 or later) running, the mod adds its page there and reads the file that
// page saves instead (a page cannot save anywhere else).
const UE = require("ue");
const puerts = require("puerts");
const Ts = require("Library/TsHelper").default;

const MOD_NAME = "66 Days Unlocked";
const MOD_ID = "phantombladezero_66daysunlocked"; // the mod folder's name and Mods Menu's page id
const MOD_VERSION = "2.0";
const SETTINGS_MS = 2000;
const SETTINGS_FILE = MOD_ID + ".txt";
const METHOD = "CanSelectNightmare"; // the Blueprint function of WB_DifficultySelect_V2 (lower-case m)
// Every setting with its default; the shipped settings file holds exactly this text (tests/test_mod.js checks it).
const DEFAULT_TEXT = ["; " + MOD_NAME + " settings. Change a value and save; the difficulty menu takes it the next time it opens.",
    "; Enable: On (66 Days open from the start), or Off (the game's lock: open after a finished game).",
    "Enable=On", ""].join("\r\n");

const run = { stopped: false, path: undefined, readAt: -Infinity, made: false, said: new Set(), told: false,
    settings: { enable: true } };
const wrapped = []; // { proto, name, original, own, wrapper }
const HOOKS_KEY = "__66DaysUnlockedHooks";
const hooks = {};

// The Mods Menu page (optional): one row per setting, the same keys and defaults as DEFAULT_TEXT.
const page = () => ({ id: MOD_ID, title: MOD_NAME, version: MOD_VERSION, file: SETTINGS_FILE, store: "saved",
    description: "The 66 Days difficulty is open from the first new game.",
    settings: [
        { key: "Enable", type: "toggle", label: "Enable", default: true, help: "Off: the game's lock (66 Days opens after a finished game)." },
    ],
    onChange: () => { run.readAt = -Infinity; } }); // read again when the screen next asks
// PBZModLoader starts its mods after Mods Menu's, so a running Mods Menu has its registry object here by now. Without it
// nothing is pushed: an array left for a Mods Menu that starts later would give a page that saves another file.
const menu = { on: false };
{
    const mm = globalThis.PBZModsMenu;
    if (mm && typeof mm === "object" && !Array.isArray(mm) && typeof mm.push === "function"
        && typeof mm.settingsPath === "function" && mm.api && typeof mm.api.has === "function"
        && mm.api.has("settingsPath") && mm.api.has("store.saved")) {
        try {
            mm.push(page());
            menu.on = typeof mm.settingsPath(MOD_ID) === "string";
        }
        catch (e) {
            console.warn(`[${MOD_NAME}] no Mods Menu page: ${e}`);
        }
    }
}

const note = (message) => console.log(`[PBZMOD] [${MOD_NAME}] ${message}`);
function warnOnce(message) {
    if (run.said.has(message))
        return;
    run.said.add(message);
    console.warn(`[${MOD_NAME}] ${message}`);
}

// ---- Settings ------------------------------------------------------------------------------------------------------

// The settings file: the one Mods Menu's page saves, else the one next to this main.js.
function settingsPath() {
    if (menu.on) {
        const path = globalThis.PBZModsMenu.settingsPath(MOD_ID);
        if (typeof path === "string" && path)
            return path;
    }
    return UE.KismetSystemLibrary.ConvertToAbsolutePath(String(__dirname).replace(/[\\/]+$/, "") + "/" + SETTINGS_FILE);
}
// The value of `key` in the settings text, in lower case ("" when the key is missing).
function readKey(text, key) {
    const re = new RegExp("^[ \\t]*" + key + "[ \\t]*=[ \\t]*([^;#\\r\\n]*?)[ \\t]*(?:[;#][^\\r\\n]*)?$", "i");
    for (const line of text.split(/\r?\n/)) {
        const m = re.exec(line);
        if (m)
            return m[1].toLowerCase();
    }
    return "";
}
// The settings, read at most every SETTINGS_MS (when the screen asks). A file that cannot be read keeps the last ones.
function settings() {
    if (Math.abs(Date.now() - run.readAt) < SETTINGS_MS)
        return run.settings;
    run.readAt = Date.now();
    try {
        run.path = run.path || settingsPath();
        let text = "";
        if (UE.BlueprintPathsLibrary.FileExists(run.path)) { // check first: EasyCsv logs an error for a missing file
            const out = puerts.$ref("");
            if (!UE.EasyCsv.LoadStringFromLocalFile(run.path, out))
                return run.settings; // locked mid-save: keep the last settings
            text = String(puerts.$unref(out)).replace(/^﻿/, "");
        }
        else if (!run.made) {
            run.made = true; // once a session, and never over an existing file
            UE.EasyCsv.SaveStringToFileWithFullPath(DEFAULT_TEXT, run.path);
        }
        run.settings = { enable: !["off", "0", "no", "false"].includes(readKey(text, "Enable")) };
    }
    catch (e) {
        warnOnce(`settings not read: ${e}`);
    }
    return run.settings;
}

// ---- The difficulty screen -----------------------------------------------------------------------------------------

// The game's own answer, as the Blueprint function gives it: PBZGameSystem.CanSelectNightMare (a finished game).
function gameAnswer(screen) {
    const system = Ts.getWorldSubsystem(screen, UE.PBZGameSystem.StaticClass());
    return !!(system && system.CanSelectNightMare());
}
// The screen asks whether 66 Days can be chosen (CanSelect: an out parameter).
function canSelect(original, args) {
    const s = settings();
    if (!s.enable)
        return typeof original === "function" ? original.apply(this, args) : puerts.$set(args[0], gameAnswer(this));
    puerts.$set(args[0], true);
    if (!run.told) {
        run.told = true;
        note("the difficulty menu asked: 66 Days is open");
    }
    return undefined;
}

// ---- Start and stop ------------------------------------------------------------------------------------------------

// Puts METHOD on the screen's mixin. Its wrapper looks up the replacement in globalThis[HOOKS_KEY] at call time; with
// none it runs the method that was there before (an older mod's), or gives the game's own answer. stop() puts the old
// method back, or removes the one the mod added.
function wrap(proto, name, replacement) {
    const original = proto[name];
    const own = Object.prototype.hasOwnProperty.call(proto, name);
    const key = "DifficultySelectV2Interface." + name;
    const wrapper = function (...args) {
        const all = globalThis[HOOKS_KEY];
        const current = all ? all[key] : undefined;
        if (typeof current === "function")
            return current.call(this, original, args);
        if (typeof original === "function")
            return original.apply(this, args);
        puerts.$set(args[0], gameAnswer(this));
        return undefined;
    };
    proto[name] = wrapper;
    if (proto[name] !== wrapper)
        throw new Error(`DifficultySelectV2Interface.${name} cannot be replaced`);
    hooks[key] = replacement;
    wrapped.push({ proto, name, original, own, wrapper });
}
function unwrapAll() {
    if (globalThis[HOOKS_KEY] === hooks)
        delete globalThis[HOOKS_KEY];
    for (const w of wrapped.splice(0).reverse()) {
        if (w.proto[w.name] !== w.wrapper)
            continue;
        if (w.own)
            w.proto[w.name] = w.original;
        else
            delete w.proto[w.name];
    }
}
try {
    if (!puerts.argv.getByName("GameInstance"))
        throw new Error("the GameInstance is missing");
    const Screen = require("UI/Widget/DifficultySelect_V2").DifficultySelectV2Interface;
    if (!Screen || !Screen.prototype)
        throw new Error("UI/Widget/DifficultySelect_V2 has no DifficultySelectV2Interface");
    if (!UE.PBZGameSystem || typeof UE.PBZGameSystem.StaticClass !== "function")
        throw new Error("this game build has no PBZGameSystem");
    wrap(Screen.prototype, METHOD, canSelect);
    globalThis[HOOKS_KEY] = hooks;
    run.path = settingsPath();
    console.log(`[PBZMOD] [${MOD_NAME}] ${MOD_VERSION} started; settings: ${run.path}` + (menu.on ? " (Mods Menu's page)" : ""));
}
catch (e) {
    run.stopped = true;
    unwrapAll();
    console.warn(`[${MOD_NAME}] not started: ${e}`);
    throw e;
}

exports.stop = function () {
    run.stopped = true;
    unwrapAll();
    console.log(`[PBZMOD] [${MOD_NAME}] stopped`);
};
