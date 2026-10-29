"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifficultySelectV2Interface = void 0;
const UE = require("ue");
const UIHelper_1 = require("../../Library/UIHelper");
const puerts_1 = require("puerts");
const StartMenuVideo_1 = require("./StartMenuVideo");
const MENU_BUTTON_ANIMATION_CLASS_PATH = "/Game/PBZContent/UI/UINew/Common/WB_PBZMenuButton_V2.WB_PBZMenuButton_V2_C";
const LEGACY_FADE_OUT_FRAME_SECONDS = 1 / 20;
const ANIMATION_WATCHDOG_GRACE_MILLISECONDS = 100;
const DIFFICULTY_66_INDEX = 3;
const DIFFICULTY_66_TEXT_UPDATE_DELAY_SECONDS = 10 / 60;
class DifficultySelectV2Interface {
    gameSelectTransitionsEnabled;
    gameSelectFadeOutStartedDelegate;
    gameSelectMenuButtonAnimationClass;
    gameSelectAnimationCompletion;
    gameSelectCompletingFadeOut;
    difficulty66PreviousIndex;
    difficulty66PendingTextIndex;
    difficulty66TextUpdateTimer;
    EnableGameSelectTransitions() {
        this.gameSelectTransitionsEnabled = true;
        this.gameSelectCompletingFadeOut = false;
        this.cancelGameSelectAnimationCompletion();
        if (!this.gameSelectMenuButtonAnimationClass) {
            // 只查不载：它是四个难度按钮（W_MenuButton_V2_SelectedVersion）的父类，难度页存在时已加载（Rule #22）
            this.gameSelectMenuButtonAnimationClass = UE.Class.Find(MENU_BUTTON_ANIMATION_CLASS_PATH);
        }
        if (!this.gameSelectFadeOutStartedDelegate) {
            this.gameSelectFadeOutStartedDelegate = (0, puerts_1.toDelegate)(this, () => {
                this.onGameSelectFadeOutStarted();
            });
            this.BindToAnimationStarted(this.FadeOut, this.gameSelectFadeOutStartedDelegate);
        }
        (0, StartMenuVideo_1.playGameSelectAnimation)(this, StartMenuVideo_1.GameSelectAnimation.NewGameToDifficulty);
    }
    DisableGameSelectTransitions() {
        this.gameSelectTransitionsEnabled = false;
        this.gameSelectCompletingFadeOut = false;
        this.cancelGameSelectAnimationCompletion();
        this.resetDifficulty66FocusVisuals(0);
        this.SetPlaybackSpeed(this.FadeOut, 1);
        if (this.gameSelectFadeOutStartedDelegate) {
            this.UnbindFromAnimationStarted(this.FadeOut, this.gameSelectFadeOutStartedDelegate);
            this.gameSelectFadeOutStartedDelegate = undefined;
        }
    }
    HandleOverrideBackInputAction() {
        this.HideTips();
        if (this.AlreadyFInish)
            return;
        this.resetDifficulty66FocusVisuals(0);
        this.BackInput.Broadcast();
        if (!this.gameSelectTransitionsEnabled) {
            this.DeactivateWidget();
            return;
        }
        this.cancelGameSelectAnimationCompletion();
        let returnAnimation = (0, StartMenuVideo_1.findGameSelectAnimation)(this, StartMenuVideo_1.GameSelectAnimation.NewGameReturn);
        let durationSeconds = (0, StartMenuVideo_1.getAnimationDurationSeconds)(returnAnimation);
        if (!returnAnimation || durationSeconds <= 0) {
            this.DeactivateWidget();
            return;
        }
        this.AlreadyFInish = true;
        this.waitForGameSelectAnimation(this, returnAnimation, durationSeconds, () => this.DeactivateWidget());
        (0, StartMenuVideo_1.playGameSelectAnimation)(this, StartMenuVideo_1.GameSelectAnimation.NewGameReturn);
    }
    cancelGameSelectAnimationCompletion() {
        let completion = this.gameSelectAnimationCompletion;
        this.gameSelectAnimationCompletion = undefined;
        if (!completion)
            return;
        clearTimeout(completion.timer);
        if (completion.owner && UE.KismetSystemLibrary.IsValid(completion.owner)
            && completion.animation && UE.KismetSystemLibrary.IsValid(completion.animation)) {
            completion.owner.UnbindFromAnimationFinished(completion.animation, completion.delegate);
        }
    }
    setDifficulty66MaskOpacity(opacity) {
        (0, StartMenuVideo_1.setStartMenuDifficulty66Focus)(opacity > 0, false);
    }
    cancelDifficulty66TextUpdate() {
        if (this.difficulty66TextUpdateTimer !== undefined)
            clearTimeout(this.difficulty66TextUpdateTimer);
        this.difficulty66TextUpdateTimer = undefined;
        this.difficulty66PendingTextIndex = undefined;
    }
    finishDifficulty66TextUpdate() {
        let pendingIndex = this.difficulty66PendingTextIndex;
        this.cancelDifficulty66TextUpdate();
        if (pendingIndex === undefined || this.difficulty66PreviousIndex !== pendingIndex)
            return;
        this.SelectedButton(pendingIndex);
    }
    stopDifficulty66FocusAnimations() {
        for (let name of [StartMenuVideo_1.GameSelectAnimation.Difficulty66Select, StartMenuVideo_1.GameSelectAnimation.Difficulty66Switch]) {
            let animation = (0, StartMenuVideo_1.findGameSelectAnimation)(this, name);
            if (animation)
                this.QueueStopAnimation(animation);
        }
    }
    resetDifficulty66FocusVisuals(maskOpacity) {
        this.cancelDifficulty66TextUpdate();
        this.stopDifficulty66FocusAnimations();
        if (this.Desc2)
            this.Desc2.SetRenderOpacity(1);
        this.setDifficulty66MaskOpacity(maskOpacity);
    }
    OnDifficulty66Deactivated() {
        this.DisableGameSelectTransitions();
        this.difficulty66PreviousIndex = undefined;
    }
    // 由蓝图选中回调转发；焦点动画必须排队，避免 CommonUI 同帧递归选中回调。
    OnDifficulty66SelectionChanged(index) {
        if (index < 0 || this.AlreadyFInish || !this.Desc2)
            return;
        let previousIndex = this.difficulty66PreviousIndex;
        if (previousIndex === index)
            return;
        this.difficulty66PreviousIndex = index;
        this.cancelDifficulty66TextUpdate();
        if (previousIndex === undefined) {
            this.SelectedButton(index);
            this.Desc2.SetRenderOpacity(1);
            this.setDifficulty66MaskOpacity(index == DIFFICULTY_66_INDEX ? 1 : 0);
            return;
        }
        let crossesDifficulty66 = previousIndex == DIFFICULTY_66_INDEX || index == DIFFICULTY_66_INDEX;
        if (!crossesDifficulty66) {
            this.resetDifficulty66FocusVisuals(0);
            this.SelectedButton(index);
            return;
        }
        let animationName = index == DIFFICULTY_66_INDEX
            ? StartMenuVideo_1.GameSelectAnimation.Difficulty66Select
            : StartMenuVideo_1.GameSelectAnimation.Difficulty66Switch;
        let animation = (0, StartMenuVideo_1.queueDifficulty66FocusAnimation)(this, animationName);
        (0, StartMenuVideo_1.setStartMenuDifficulty66Focus)(index == DIFFICULTY_66_INDEX, true);
        if (!animation) {
            this.SelectedButton(index);
            this.Desc2.SetRenderOpacity(1);
            this.setDifficulty66MaskOpacity(index == DIFFICULTY_66_INDEX ? 1 : 0);
            return;
        }
        this.difficulty66PendingTextIndex = index;
        this.difficulty66TextUpdateTimer = setTimeout(() => {
            this.difficulty66TextUpdateTimer = undefined;
            if (!UE.KismetSystemLibrary.IsValid(this) || this.AlreadyFInish)
                return;
            let pendingIndex = this.difficulty66PendingTextIndex;
            this.difficulty66PendingTextIndex = undefined;
            if (pendingIndex === undefined || this.difficulty66PreviousIndex !== pendingIndex)
                return;
            this.SelectedButton(pendingIndex);
        }, DIFFICULTY_66_TEXT_UPDATE_DELAY_SECONDS * 1000);
    }
    completeGameSelectAnimation(expected, onComplete) {
        if (!this.gameSelectTransitionsEnabled
            || this.gameSelectAnimationCompletion !== expected)
            return;
        this.cancelGameSelectAnimationCompletion();
        onComplete();
    }
    finishGameSelectFadeOut() {
        this.gameSelectCompletingFadeOut = true;
        let completionStartTime = Math.max(this.FadeOut.GetStartTime(), this.FadeOut.GetEndTime() - LEGACY_FADE_OUT_FRAME_SECONDS);
        this.PlayAnimation(this.FadeOut, completionStartTime, 1, UE.EUMGSequencePlayMode.Forward, 1, false);
    }
    waitForGameSelectAnimation(owner, animation, durationSeconds, onComplete) {
        if (!owner || !UE.KismetSystemLibrary.IsValid(owner)
            || !animation || !UE.KismetSystemLibrary.IsValid(animation)
            || durationSeconds <= 0) {
            onComplete();
            return;
        }
        let completion = {};
        completion.owner = owner;
        completion.animation = animation;
        completion.delegate = (0, puerts_1.toDelegate)(this, () => {
            this.completeGameSelectAnimation(completion, onComplete);
        });
        completion.timer = setTimeout(() => {
            if (!UE.KismetSystemLibrary.IsValid(this))
                return;
            this.completeGameSelectAnimation(completion, onComplete);
        }, Math.ceil(durationSeconds * 1000) + ANIMATION_WATCHDOG_GRACE_MILLISECONDS);
        this.gameSelectAnimationCompletion = completion;
        owner.BindToAnimationFinished(animation, completion.delegate);
    }
    onGameSelectFadeOutStarted() {
        if (!this.gameSelectTransitionsEnabled)
            return;
        if (this.gameSelectCompletingFadeOut) {
            this.gameSelectCompletingFadeOut = false;
            return;
        }
        this.finishDifficulty66TextUpdate();
        this.stopDifficulty66FocusAnimations();
        if (this.Desc2)
            this.Desc2.SetRenderOpacity(1);
        this.cancelGameSelectAnimationCompletion();
        let selectedButton = this.FinishButton;
        let nightmareButton = this.Nightmare;
        let selectedNightmare = selectedButton === nightmareButton
            || UE.KismetMathLibrary.EqualEqual_ObjectObject(selectedButton, nightmareButton);
        this.resetDifficulty66FocusVisuals(selectedNightmare ? 1 : 0);
        let chooseDifficultyAnimation = (0, StartMenuVideo_1.playGameSelectAnimation)(this, StartMenuVideo_1.GameSelectAnimation.ChooseDifficulty);
        let difficultyButtons = [this.Easy, this.Normal, this.Hard, this.Nightmare];
        let selectedExitStarted = false;
        let completionOwner = chooseDifficultyAnimation ? this : undefined;
        let completionAnimation = chooseDifficultyAnimation;
        let durationSeconds = (0, StartMenuVideo_1.getAnimationDurationSeconds)(chooseDifficultyAnimation);
        for (let button of difficultyButtons) {
            let isSelectedButton = button === selectedButton
                || UE.KismetMathLibrary.EqualEqual_ObjectObject(button, selectedButton);
            let exitAnimationName = selectedNightmare
                ? (isSelectedButton ? StartMenuVideo_1.GameSelectAnimation.ChooseDifficultySelected : StartMenuVideo_1.GameSelectAnimation.ChooseDifficultyUnselected)
                : (isSelectedButton ? StartMenuVideo_1.GameSelectAnimation.EnterGame : StartMenuVideo_1.GameSelectAnimation.EnterGameUnselected);
            let exitAnimation = (0, StartMenuVideo_1.playGameSelectAnimation)(button, exitAnimationName, { fallbackClass: this.gameSelectMenuButtonAnimationClass });
            if (exitAnimation) {
                let exitDurationSeconds = (0, StartMenuVideo_1.getAnimationDurationSeconds)(exitAnimation);
                if (!completionAnimation || exitDurationSeconds > durationSeconds) {
                    completionOwner = button;
                    completionAnimation = exitAnimation;
                    durationSeconds = exitDurationSeconds;
                }
            }
            if (isSelectedButton)
                selectedExitStarted = !!exitAnimation;
        }
        (0, StartMenuVideo_1.fadeOutStartMenuSound)(this, durationSeconds);
        (0, StartMenuVideo_1.playStartMenuVideoAnimation)(selectedNightmare ? StartMenuVideo_1.GameSelectAnimation.ChooseDifficulty66 : StartMenuVideo_1.GameSelectAnimation.ChooseDifficulty);
        if (!selectedButton || !selectedExitStarted) {
            this.SetPlaybackSpeed(this.FadeOut, 0.5);
            return;
        }
        this.PauseAnimation(this.FadeOut);
        let rootWidget = this.WidgetTree.RootWidget;
        if (rootWidget)
            rootWidget.SetRenderOpacity(1);
        this.waitForGameSelectAnimation(completionOwner, completionAnimation, durationSeconds, () => this.finishGameSelectFadeOut());
    }
    // BP OnButtonPressed 链尾调用本函数（蓝图里为空实现），mixin 覆写为弹极难说明提示。
    ClickNightmareTips() {
        UIHelper_1.default.showTips(this, "UI_SelectDifficutly_19");
    }
    // BP 在切换选项、点击按钮或返回时调用，立即移除当前文字提示。
    HideTips() {
        UIHelper_1.default.hideTips(this);
    }
    // 66 Days Unlocked (mod by Kintaro): replaces the Blueprint function CanSelectNightmare (out parameter CanSelect),
    // which asks PBZGameSystem.CanSelectNightMare whether a finished game has unlocked 66 Days. Always yes, so 66 Days
    // can be chosen from the first new game. Nothing is saved: without the mod the game's lock is back.
    CanSelectNightmare(CanSelect) {
        (0, puerts_1.$set)(CanSelect, true);
    }
}
exports.DifficultySelectV2Interface = DifficultySelectV2Interface;
//# sourceMappingURL=DifficultySelect_V2.js.map