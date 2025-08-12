import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { ConnectionStatusAction } from "./actions/connection-status";
import { ZoomButtonAction } from "./actions/zoom-button";
import { CameraSwitchAction } from "./actions/camera-switch";
import { LEDToggleAction } from "./actions/led-toggle";
import { MicToggleAction } from "./actions/mic-toggle";
import { StopRestartButtonAction } from "./actions/stop-restart-button";
import { ExposureButtonAction } from "./actions/exposure-button";
import { AutofocusButtonAction } from "./actions/autofocus-button";
import { FocusModeButtonAction } from "./actions/focus-mode-button";
import { WBModeButtonAction } from "./actions/wb-mode-button";
import { ExposureLockButtonAction } from "./actions/exposure-lock-button";
import { WBLockButtonAction } from "./actions/wb-lock-button";
import { BatteryStatusAction } from "./actions/battery-status";
import { ZoomControlAction } from "./actions/zoom-control";
import { ExposureControlAction } from "./actions/exposure-control";

streamDeck.logger.setLevel(LogLevel.DEBUG);

streamDeck.actions.registerAction(new ConnectionStatusAction());
streamDeck.actions.registerAction(new ZoomButtonAction());
streamDeck.actions.registerAction(new CameraSwitchAction());
streamDeck.actions.registerAction(new LEDToggleAction());
streamDeck.actions.registerAction(new MicToggleAction());
streamDeck.actions.registerAction(new StopRestartButtonAction());
streamDeck.actions.registerAction(new ExposureButtonAction());
streamDeck.actions.registerAction(new AutofocusButtonAction());
streamDeck.actions.registerAction(new FocusModeButtonAction());
streamDeck.actions.registerAction(new WBModeButtonAction());
streamDeck.actions.registerAction(new ExposureLockButtonAction());
streamDeck.actions.registerAction(new WBLockButtonAction());
streamDeck.actions.registerAction(new BatteryStatusAction());
streamDeck.actions.registerAction(new ZoomControlAction());
streamDeck.actions.registerAction(new ExposureControlAction());

streamDeck.connect();