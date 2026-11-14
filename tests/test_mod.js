// Offline test of the mod, run by build.ps1: node tests/test_mod.js
// It loads src/phantombladezero_66daysunlocked/main.js as PBZModLoader does (a module whose __dirname is the mod's
// folder) with stand-ins for the modules the game gives it (ue, puerts, Library/TsHelper and the game's
// UI/Widget/DifficultySelect_V2, whose DifficultySelectV2Interface the mod adds CanSelectNightmare to), the game's check
// PBZGameSystem.CanSelectNightMare, an optional running Mods Menu and the settings file. Like Puerts' blueprint.mixin,
// the screen's class takes a copy of the prototype's methods when it mixes and keeps that copy across a reload; the
// screen asks the copy's CanSelectNightmare with an out parameter, as the Blueprint event graph does.
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");

const FOLDER = path.join(__dirname, "..", "src", "phantombladezero_66daysunlocked");
const SCRIPT = path.join(FOLDER, "main.js");
const SETTINGS = path.join(FOLDER, "phantombladezero_66daysunlocked.txt");
const SETTINGS_PATH = FOLDER.replace(/[\\/]+$/, "") + "/phantombladezero_66daysunlocked.txt";
const MENU_PATH = "C:/Game/ProjectPBZ/Saved/PBZModsMenu/Settings/phantombladezero_66daysunlocked.txt";
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mod.json"), "utf8")).version;
const HOOKS_KEY = "__66DaysUnlockedHooks";

let failed = 0;
function check(name, ok) {
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) {
        failed++;
    }
}

// The game's script module: the screen's mixin, with methods of its own (none named CanSelectNightmare).
function newScreenModule() {
    class DifficultySelectV2Interface {
        ClickNightmareTips() { return "tips"; }
        HideTips() { return "hide"; }
    }
    return { DifficultySelectV2Interface };
}
// The screen's class mixes: a copy of the prototype's methods at this moment.
function mix(mod) {
    const P = mod.DifficultySelectV2Interface.prototype;
    const copy = {};
    for (const name of Object.getOwnPropertyNames(P))
        if (name !== "constructor" && typeof P[name] === "function")
            copy[name] = P[name];
    return copy;
}

function boot(options = {}) {
    const game = options.game || { finished: false, systemCalls: 0 };
    const screenModule = options.screenModule || newScreenModule();
    const w = { game, screenModule, now: 1000000, files: new Map(), saved: [], warnings: [], logs: [], pushed: [], loadError: undefined };
    for (const [file, text] of Object.entries(options.files || {}))
        w.files.set(file, text);
    const gameInstance = { path: "/Engine/Transient.GameInstance" };
    const system = { CanSelectNightMare() { game.systemCalls++; return game.finished; } };
    const ue = {
        KismetSystemLibrary: { ConvertToAbsolutePath: (p) => { if (options.badPath) throw new Error("no path"); return p; } },
        BlueprintPathsLibrary: { FileExists: (p) => w.files.has(p) },
        EasyCsv: {
            LoadStringFromLocalFile(p, out) { out[0] = w.files.get(p); return true; },
            SaveStringToFileWithFullPath(text, p) { w.saved.push([p, text]); w.files.set(p, text); return true; },
        },
        PBZGameSystem: options.noGameSystem ? undefined : { StaticClass: () => "PBZGameSystem" },
    };
    const puerts = {
        $ref: (value) => [value],
        $unref: (box) => box[0],
        $set: (box, value) => { box[0] = value; },
        argv: { getByName: (name) => (name == "GameInstance" && !options.noGameInstance ? gameInstance : undefined) },
    };
    const ts = { default: { getWorldSubsystem: (ctx, cls) => (cls === "PBZGameSystem" ? system : undefined) } };
    const stubs = { "ue": ue, "puerts": puerts, "Library/TsHelper": ts, "UI/Widget/DifficultySelect_V2": screenModule };
    const load = Module._load;
    const hooked = function (request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(stubs, request))
            return stubs[request];
        return load.call(this, request, parent, isMain);
    };
    const realNow = Date.now, realWarn = console.warn, realLog = console.log;
    const enter = () => {
        Module._load = hooked;
        Date.now = () => w.now;
        console.warn = (message) => w.warnings.push(String(message));
        console.log = (message) => w.logs.push(String(message));
    };
    const leave = () => {
        Module._load = load;
        Date.now = realNow;
        console.warn = realWarn;
        console.log = realLog;
    };
    globalThis.PBZModsMenu = options.menu === "array" ? [] : options.menu ? {
        api: { has: (f) => !(options.menuMissing || []).includes(f) },
        push(...mods) { w.pushed.push(...mods); return w.pushed.length; },
        settingsPath: (id) => (w.pushed.some((m) => m.id == id) ? MENU_PATH : undefined),
    } : undefined;
    w.menuGlobal = globalThis.PBZModsMenu;
    if (options.beforeLoad)
        options.beforeLoad(screenModule);
    delete require.cache[require.resolve(SCRIPT)];
    enter();
    try {
        w.exports = require(SCRIPT);
    }
    catch (e) {
        w.loadError = e;
    }
    finally {
        leave();
    }
    // the screen (an object of the mixed class: its methods are the copy) asks: true, false, or undefined (not set)
    w.ask = (copy) => {
        enter();
        try {
            const screen = Object.create(copy);
            const box = [undefined];
            if (typeof screen.CanSelectNightmare !== "function")
                return "blueprint";
            screen.CanSelectNightmare(box);
            return box[0];
        }
        finally {
            leave();
        }
    };
    w.mix = () => mix(screenModule);
    w.wait = (ms) => { w.now += ms; };
    w.set = (text) => { w.files.set(SETTINGS_PATH, text); w.now += 2000; };
    w.stop = () => {
        enter();
        try {
            w.exports.stop();
        }
        finally {
            leave();
        }
    };
    return w;
}

// The module as PBZModLoader loads it.
{
    const w = boot();
    const P = w.screenModule.DifficultySelectV2Interface.prototype;
    check("no error at load; stop() exported", !w.loadError && typeof w.exports.stop == "function");
    check("one start line for loader.log, naming the settings file in the mod's folder",
        w.logs.length == 1 && w.logs[0] == `[PBZMOD] [66 Days Unlocked] ${VERSION} started; settings: ${SETTINGS_PATH}`);
    check("CanSelectNightmare added to the screen's mixin (no game script replaced); the screen's own methods untouched",
        typeof P.CanSelectNightmare == "function" && P.ClickNightmareTips() == "tips" && typeof globalThis[HOOKS_KEY] == "object");
    check("no Mods Menu: no page pushed anywhere", globalThis.PBZModsMenu === undefined && w.pushed.length == 0);
    w.stop();
}

// The difficulty menu asks.
{
    const w = boot();
    const copy = w.mix(); // the screen opens for the first time: its class mixes now
    check("a profile that never finished the game: 66 Days open (CanSelect true)", w.ask(copy) === true && w.game.systemCalls == 0);
    check("a line for loader.log the first time, once", w.logs.filter((l) => l == "[PBZMOD] [66 Days Unlocked] the difficulty menu asked: 66 Days is open").length == 1
        && (w.ask(copy), w.logs.length == 2));
    check("a missing settings file is written once with the defaults; the shipped file is exactly that text (CRLF)",
        w.saved.length == 1 && w.saved[0][0] == SETTINGS_PATH && w.saved[0][1] == fs.readFileSync(SETTINGS, "utf8")
        && fs.readFileSync(SETTINGS, "utf8").includes("\r\n"));
    w.set("Enable=Off\r\n");
    check("Enable=Off: the game's own check answers (not finished: locked)", w.ask(copy) === false && w.game.systemCalls == 1);
    w.game.finished = true;
    w.wait(2000);
    check("... a finished game: open, by the game's check", w.ask(copy) === true && w.game.systemCalls == 2);
    w.game.finished = false;
    w.set("Enable=On\r\n");
    check("Enable=On again: open", w.ask(copy) === true);
    check("no warning", w.warnings.length == 0);
    w.stop();
}

// stop(), a reload with the copy the game kept, an older method already there.
{
    const game = { finished: false, systemCalls: 0 };
    const w = boot({ game });
    const copy = w.mix();
    const P = w.screenModule.DifficultySelectV2Interface.prototype;
    w.stop();
    check("stop(): the method removed from the mixin, the hook table gone, a line for loader.log",
        !("CanSelectNightmare" in P) && globalThis[HOOKS_KEY] === undefined && w.logs[w.logs.length - 1] == "[PBZMOD] [66 Days Unlocked] stopped");
    check("... the copy the game kept answers as the game does (not finished: locked)", w.ask(copy) === false && game.systemCalls == 1);
    const again = boot({ game, screenModule: w.screenModule });
    check("a second copy (the reload): the copy the game kept reaches it: open", !again.loadError && w.ask(copy) === true);
    const fresh = again.mix();
    check("... a class mixed later uses its wrapper the same way", again.ask(fresh) === true);
    again.stop();
    check("... its stop(): the game's answer again", w.ask(copy) === false && w.ask(fresh) === false);
    const blueprint = boot({ game });
    blueprint.stop();
    check("a screen class mixed after the last stop(): no method, the Blueprint function runs", blueprint.ask(blueprint.mix()) === "blueprint");
    const older = boot({ game, beforeLoad: (mod) => { mod.DifficultySelectV2Interface.prototype.CanSelectNightmare = function (box) { box[0] = "older"; }; } });
    const oc = older.mix();
    older.set("Enable=Off\r\n");
    check("a CanSelectNightmare already on the mixin (an older mod): Enable=Off runs it", older.ask(oc) === "older");
    older.stop();
    check("... stop() puts it back", typeof older.screenModule.DifficultySelectV2Interface.prototype.CanSelectNightmare == "function"
        && older.ask(older.mix()) === "older");
}

// Mods Menu: optional.
{
    const m = boot({ menu: true, files: { [MENU_PATH]: "Enable=Off\r\n" } });
    const page = m.pushed[0];
    const keys = (text) => [...text.matchAll(/^(\w+)=/gm)].map((x) => x[1]).sort().join();
    check("Mods Menu running: one page with the mod's id, version, file, store \"saved\" and name",
        m.pushed.length == 1 && page.id == "phantombladezero_66daysunlocked" && page.version == VERSION
        && page.file == "phantombladezero_66daysunlocked.txt" && page.store == "saved" && page.title == "66 Days Unlocked");
    check("... its rows are the shipped file's settings, with the same defaults",
        page.settings.map((s) => s.key).sort().join() == keys(fs.readFileSync(SETTINGS, "utf8")) && page.settings[0].default === true);
    check("... the mod reads the file the page saves (Enable=Off there: the game's lock)",
        m.logs[0].endsWith(`settings: ${MENU_PATH} (Mods Menu's page)`) && m.ask(m.mix()) === false);
    m.files.set(MENU_PATH, "Enable=On\r\n");
    page.onChange();
    check("... a change on the page is read the next time the menu asks", m.ask(m.mix()) === true);
    m.stop();
    const a = boot({ menu: "array" });
    check("Mods Menu not started yet (a plain array): nothing pushed, the mod's own file", a.menuGlobal.length == 0
        && a.logs[0].endsWith(`settings: ${SETTINGS_PATH}`));
    a.stop();
    const o = boot({ menu: true, menuMissing: ["store.saved"] });
    check("an older Mods Menu without store \"saved\": no page", o.pushed.length == 0);
    o.stop();
}

// A failed start.
{
    const n = boot({ noGameInstance: true });
    check("no GameInstance: the load throws (PBZModLoader logs the mod as failed), nothing added",
        !!n.loadError && !("CanSelectNightmare" in n.screenModule.DifficultySelectV2Interface.prototype) && globalThis[HOOKS_KEY] === undefined);
    const b = boot({ screenModule: {} });
    check("a game build without DifficultySelectV2Interface: the load throws naming it", !!b.loadError && /DifficultySelectV2Interface/.test(String(b.loadError)));
    const g = boot({ noGameSystem: true });
    check("a game build without PBZGameSystem: the load throws, nothing added", !!g.loadError && /PBZGameSystem/.test(String(g.loadError))
        && !("CanSelectNightmare" in g.screenModule.DifficultySelectV2Interface.prototype));
    const late = boot({ badPath: true });
    check("a start that fails after the method was added: the method taken off again, no hook table", !!late.loadError
        && !("CanSelectNightmare" in late.screenModule.DifficultySelectV2Interface.prototype) && globalThis[HOOKS_KEY] === undefined);
}

process.exit(failed ? 1 : 0);
