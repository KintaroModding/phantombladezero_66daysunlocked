// Offline test of the changed game script, run by build.ps1 when Node.js is installed: node tests/test_mod.js
// It loads src/.../DifficultySelect_V2.js with stand-ins for the modules the game gives it (ue, puerts and the
// game's own libraries) and checks what the mod adds: CanSelectNightmare sets its out parameter CanSelect to true.
"use strict";
const path = require("path");
const Module = require("module");

const script = path.join(__dirname, "..", "src", "ProjectPBZ", "Content", "JavaScript", "UI", "Widget",
    "DifficultySelect_V2.js");

// Puerts passes a Blueprint out parameter as a box: $ref makes one, $set writes it, $unref reads it.
const puerts = {
    $ref: (value) => [value],
    $set: (box, value) => { box[0] = value; },
    $unref: (box) => box[0],
    toDelegate: () => () => {},
};
const stubs = {
    "ue": {},
    "puerts": puerts,
    "../../Library/UIHelper": { default: { showTips() {}, hideTips() {} } },
    "./StartMenuVideo": {},
};
const load = Module._load;
Module._load = function (request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
        return stubs[request];
    }
    return load.call(this, request, parent, isMain);
};

let failed = 0;
function check(name, ok) {
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) {
        failed++;
    }
}

const { DifficultySelectV2Interface } = require(script);
const widget = new DifficultySelectV2Interface();
check("the mixin class has CanSelectNightmare", typeof widget.CanSelectNightmare === "function");
for (const start of [false, true]) {
    const canSelect = puerts.$ref(start);
    if (typeof widget.CanSelectNightmare === "function") {
        widget.CanSelectNightmare(canSelect);
    }
    check(`CanSelectNightmare sets CanSelect to true (was ${start})`, puerts.$unref(canSelect) === true);
}
check("the game's own methods are still there",
    ["ClickNightmareTips", "HideTips", "OnDifficulty66SelectionChanged", "EnableGameSelectTransitions"]
        .every((name) => typeof widget[name] === "function"));

process.exit(failed ? 1 : 0);
