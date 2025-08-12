import streamDeck, { action, DialDownEvent, DialUpEvent, DialRotateEvent, WillAppearEvent, KeyDownEvent, SingletonAction, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { nanoid } from 'nanoid';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface ExposureControlSettings {
  ipAddress?: string;
  port?: number;
  sensitivity?: number;
  [key: string]: any;
}

@action({ UUID: 'works.nantoka.droidcam.exposure-control' })
export class ExposureControlAction extends SingletonAction<ExposureControlSettings> {
  private api?: DroidCamAPI;
  private currentExposure: number = 0.0;
  private minExposure: number = -24.0;
  private maxExposure: number = 24.0;
  private readonly actionId = 'exposure-control';
  private readonly instanceId = `exposure-control-${nanoid(6)}`;
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<ExposureControlAction>();
  private readonly logger = streamDeck.logger.createScope('ExposureControl');

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    ExposureControlAction.pollingInstances.add(this);
    
    if (!ExposureControlAction.pollingTimer) {
      this.logger.info(`[${this.instanceId}] Starting API polling for ExposureControl`);
      ExposureControlAction.pollingTimer = setInterval(() => {
        ExposureControlAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (ExposureControlAction.pollingInstances.size === 0) return;
    
    const firstInstance = Array.from(ExposureControlAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      const logger = streamDeck.logger.createScope('ExposureControl');
      logger.debug(`Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        logger.debug(`No camera info available`);
        return;
      }
      
      const apiExposure = cameraInfo.evValue || 0.0;
      logger.debug(`API exposure value: ${apiExposure}`);
      
      for (const instance of ExposureControlAction.pollingInstances) {
        const exposureInstance = instance as ExposureControlAction;
        
        if (Math.abs(exposureInstance.currentExposure - apiExposure) > 0.001) {
          exposureInstance.logger.info(`[${exposureInstance.instanceId}] Exposure changed from API - old: ${exposureInstance.currentExposure}, new: ${apiExposure}`);
          
          if (cameraInfo.evMin !== undefined) exposureInstance.minExposure = cameraInfo.evMin;
          if (cameraInfo.evMax !== undefined) exposureInstance.maxExposure = cameraInfo.evMax;
          
          exposureInstance.currentExposure = apiExposure;
          await exposureInstance.syncExposureToAllInstances(apiExposure);
        }
      }
    } catch (error) {
      const logger = streamDeck.logger.createScope('ExposureControl');
      logger.error(`Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    ExposureControlAction.pollingInstances.delete(this);
    
    if (ExposureControlAction.pollingInstances.size === 0 && ExposureControlAction.pollingTimer) {
      this.logger.info(`[${this.instanceId}] Stopping API polling`);
      clearInterval(ExposureControlAction.pollingTimer);
      ExposureControlAction.pollingTimer = undefined;
    }
  }

  private async updateExposureFeedback(action: any, exposure: number): Promise<void> {
    if (!('setFeedback' in action)) {
      this.logger.warn(`[${this.instanceId}] setFeedback not available on action`);
      return;
    }
    
    // 0-1の範囲を0-100に変換（中央値0を50%として）
    const normalizedValue = (exposure - this.minExposure) / (this.maxExposure - this.minExposure);
    const indicatorValue = normalizedValue * 100;
    
    // NaNチェック
    const safeIndicatorValue = isNaN(indicatorValue) ? 50 : indicatorValue;
    
    try {
      await action.setFeedback({
        icon: 'icons/exposure-control.svg',
        title: 'EV',
        value: this.formatExposure(exposure),
        indicator: {
          value: safeIndicatorValue
        }
      });
    } catch (error) {
      this.logger.error(`[${this.instanceId}] setFeedback failed:`, error);
    }
  }

  private async syncExposureToAllInstances(newExposure: number): Promise<void> {
    const updatePromises = Array.from(this.actions).map(async (action) => {
      const exposureAction = action as any;
      if (exposureAction) {
        exposureAction.currentExposure = newExposure;
        exposureAction.minExposure = this.minExposure;
        exposureAction.maxExposure = this.maxExposure;
        
        // UIを更新
        await this.updateExposureFeedback(action, newExposure);
      }
    });
    
    await Promise.all(updatePromises);
  }

  private async initializeFromGlobalSettings(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  override async onWillAppear(ev: WillAppearEvent<ExposureControlSettings>): Promise<void> {
    await this.initializeFromGlobalSettings();
    
    const settings = await ev.action.getSettings();
    
    if (settings.ipAddress) {
      if (!this.api) {
        this.api = new DroidCamAPI(settings.ipAddress, settings.port || 4747);
      }
      
      try {
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          const rangeUpdated = (
            this.minExposure !== (cameraInfo.evMin ?? -24) || 
            this.maxExposure !== (cameraInfo.evMax ?? 24)
          );
          
          this.minExposure = cameraInfo.evMin ?? -24;
          this.maxExposure = cameraInfo.evMax ?? 24;
          
          const apiExposure = cameraInfo.evValue ?? 0;
          if (Math.abs(this.currentExposure - apiExposure) > 0.01) {
            this.logger.info(`[${this.actionId}] API exposure (${apiExposure}) differs from shared exposure (${this.currentExposure}), keeping shared state`);
          }
          
          if (rangeUpdated) {
            await this.syncExposureToAllInstances(this.currentExposure);
          }
        }
      } catch (error) {
        this.logger.error(`[${this.actionId}] Failed to get camera info:`, error);
      }
    }
    
    // KeypadでもEncoderでも常にアイコンを設定
    await ev.action.setImage('icons/exposure-control.svg');
    
    // Keypad（ボタン押し込み）の場合
    if (ev.action.isKey()) {
      await ev.action.setState(0);
    }
    
    // Encoder（ダイヤル）の場合
    await this.updateExposureFeedback(ev.action, this.currentExposure);
  }

  override async onDialRotate(ev: DialRotateEvent<ExposureControlSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    
    if (!settings.ipAddress) {
      return;
    }
    
    if (!this.api) {
      this.api = new DroidCamAPI(settings.ipAddress, settings.port || 4747);
    }
    
    const sensitivity = (settings.sensitivity as number) || 0.5;
    const delta = ev.payload.ticks * sensitivity;
    this.currentExposure = Math.max(this.minExposure, Math.min(this.maxExposure, this.currentExposure + delta));
    this.currentExposure = Math.round(this.currentExposure * 100) / 100;
    
    // フィードバックを先に更新
    await this.updateExposureFeedback(ev.action, this.currentExposure);
    
    const success = await this.api.setExposure(this.currentExposure);
    
    if (success) {
      await this.syncExposureToAllInstances(this.currentExposure);
    }
  }

  override async onDialDown(ev: DialDownEvent<ExposureControlSettings>): Promise<void> {
    this.currentExposure = 0.0;
    
    // すぐにフィードバックを更新（中央値50%）
    await this.updateExposureFeedback(ev.action, this.currentExposure);
    
    const settings = await ev.action.getSettings();
    if (settings.ipAddress && this.api) {
      const success = await this.api.setExposure(this.currentExposure);
      
      if (success) {
        await this.syncExposureToAllInstances(this.currentExposure);
      }
    }
  }

  override async onDialUp(_ev: DialUpEvent<ExposureControlSettings>): Promise<void> {
    // ダイアルリリース時の処理（現在は何もしない）
  }

  override async onKeyDown(ev: KeyDownEvent<ExposureControlSettings>): Promise<void> {
    this.currentExposure = 0.0;
    
    const settings = await ev.action.getSettings();
    if (settings.ipAddress && this.api) {
      const success = await this.api.setExposure(this.currentExposure);
      
      if (success) {
        await this.syncExposureToAllInstances(this.currentExposure);
        
        if (ev.action.isKey()) {
          await ev.action.showOk();
        }
      } else {
        if (ev.action.isKey()) {
          await ev.action.showAlert();
        }
      }
    }
  }

  private formatExposure(value: number): string {
    if (value === 0) return '±0.0';
    return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ExposureControlSettings>): Promise<void> {
    const settings = ev.payload.settings;
    
    const port = settings.port || 4747;
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = undefined;
      
      if (settings.ipAddress) {
        this.api = new DroidCamAPI(settings.ipAddress, port);
        
        try {
          const cameraInfo = await this.api.getCameraInfo();
          if (cameraInfo) {
            this.minExposure = cameraInfo.evMin ?? -24;
            this.maxExposure = cameraInfo.evMax ?? 24;
            if (this.currentExposure < this.minExposure || this.currentExposure > this.maxExposure) {
              this.currentExposure = Math.max(this.minExposure, Math.min(this.maxExposure, this.currentExposure));
            }
            
            await this.syncExposureToAllInstances(this.currentExposure);
          }
        } catch (error) {
          this.logger.error(`[${this.actionId}] Failed to get camera info on settings update:`, error);
        }
      }
    }
    
    // Encoderの場合はフィードバックを更新
    await this.updateExposureFeedback(ev.action, this.currentExposure);
  }
}