import streamDeck, { action, DialDownEvent, DialUpEvent, DialRotateEvent, WillAppearEvent, KeyDownEvent, SingletonAction, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { nanoid } from 'nanoid';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface ZoomControlSettings {
  ipAddress?: string;
  port?: number;
  sensitivity?: number;
  [key: string]: any;
}

@action({ UUID: 'works.nantoka.droidcam.zoom-control' })
export class ZoomControlAction extends SingletonAction<ZoomControlSettings> {
  private api?: DroidCamAPI;
  private currentZoom: number = 1.0;
  private minZoom: number = 1.0;
  private maxZoom: number = 8.0;
  private readonly actionId = 'zoom-control';
  private readonly instanceId = `zoom-control-${nanoid(6)}`;
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<ZoomControlAction>();
  private readonly logger = streamDeck.logger.createScope('ZoomControl');

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    ZoomControlAction.pollingInstances.add(this);
    
    if (!ZoomControlAction.pollingTimer) {
      this.logger.info(`[${this.instanceId}] Starting GlobalSettings polling for ZoomControl`);
      ZoomControlAction.pollingTimer = setInterval(() => {
        ZoomControlAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (ZoomControlAction.pollingInstances.size === 0) return;
    
    const firstInstance = Array.from(ZoomControlAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      const logger = streamDeck.logger.createScope('ZoomControl');
      logger.debug(`Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        logger.debug(`No camera info available`);
        return;
      }
      
      const apiZoom = cameraInfo.zmValue || 1.0;
      logger.debug(`API zoom value: ${apiZoom}`);
      
      for (const instance of ZoomControlAction.pollingInstances) {
        const zoomInstance = instance as ZoomControlAction;
        
        if (Math.abs(zoomInstance.currentZoom - apiZoom) > 0.001) {
          zoomInstance.logger.info(`[${zoomInstance.instanceId}] Zoom changed from API - old: ${zoomInstance.currentZoom}, new: ${apiZoom}`);
          
          if (cameraInfo.zmMin !== undefined) zoomInstance.minZoom = cameraInfo.zmMin;
          if (cameraInfo.zmMax !== undefined) zoomInstance.maxZoom = cameraInfo.zmMax;
          
          zoomInstance.currentZoom = apiZoom;
          await zoomInstance.syncZoomToAllInstances(apiZoom);
        }
      }
    } catch (error) {
      const logger = streamDeck.logger.createScope('ZoomControl');
      logger.error(`Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    ZoomControlAction.pollingInstances.delete(this);
    
    if (ZoomControlAction.pollingInstances.size === 0 && ZoomControlAction.pollingTimer) {
      this.logger.info(`[${this.instanceId}] Stopping GlobalSettings polling`);
      clearInterval(ZoomControlAction.pollingTimer);
      ZoomControlAction.pollingTimer = undefined;
    }
  }

  private async updateZoomFeedback(action: any, zoom: number): Promise<void> {
    if (!('setFeedback' in action)) {
      this.logger.warn(`[${this.instanceId}] setFeedback not available on action`);
      return;
    }
    
    // 0-1の範囲を0-100に変換
    const normalizedValue = (zoom - this.minZoom) / (this.maxZoom - this.minZoom);
    const indicatorValue = normalizedValue * 100;
    
    // NaNチェック
    const safeIndicatorValue = isNaN(indicatorValue) ? 0 : indicatorValue;
    
    try {
      await action.setFeedback({
        icon: 'icons/zoom-control.svg',
        title: 'ZOOM',
        value: `${zoom.toFixed(2)}x`,
        indicator: {
          value: safeIndicatorValue
        }
      });
    } catch (error) {
      this.logger.error(`[${this.instanceId}] setFeedback failed:`, error);
    }
  }

  private async syncZoomToAllInstances(newZoom: number): Promise<void> {
    const updatePromises = Array.from(this.actions).map(async (action) => {
      const zoomAction = action as any;
      if (zoomAction) {
        zoomAction.currentZoom = newZoom;
        zoomAction.minZoom = this.minZoom;
        zoomAction.maxZoom = this.maxZoom;
        
        // UIを更新
        await this.updateZoomFeedback(action, newZoom);
      }
    });
    
    await Promise.all(updatePromises);
  }

  private async initializeFromGlobalSettings(): Promise<void> {
    if (this.isInitialized) return;
    
    
    this.isInitialized = true;
  }

  override async onWillAppear(ev: WillAppearEvent<ZoomControlSettings>): Promise<void> {
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
            this.minZoom !== (cameraInfo.zmMin || 1.0) || 
            this.maxZoom !== (cameraInfo.zmMax || 8.0)
          );
          
          this.minZoom = cameraInfo.zmMin || 1.0;
          this.maxZoom = cameraInfo.zmMax || 8.0;
          
          const apiZoom = cameraInfo.zmValue || 1.0;
          if (Math.abs(this.currentZoom - apiZoom) > 0.01) {
            this.logger.info(`[${this.actionId}] API zoom (${apiZoom}) differs from shared zoom (${this.currentZoom}), keeping shared state`);
          }
          
          if (rangeUpdated) {
            await this.syncZoomToAllInstances(this.currentZoom);
          }
        }
      } catch (error) {
        this.logger.error(`[${this.actionId}] Failed to get camera info:`, error);
      }
    }
    
    // KeypadでもEncoderでも常にアイコンを設定
    await ev.action.setImage('icons/zoom-control.svg');
    
    // Keypad（ボタン押し込み）の場合
    if (ev.action.isKey()) {
      await ev.action.setState(0);
    }
    
    // Encoder（ダイヤル）の場合
    await this.updateZoomFeedback(ev.action, this.currentZoom);
  }

  override async onDialRotate(ev: DialRotateEvent<ZoomControlSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    
    if (!settings.ipAddress) {
      return;
    }
    
    if (!this.api) {
      this.api = new DroidCamAPI(settings.ipAddress, settings.port || 4747);
    }
    
    const sensitivity = (settings.sensitivity as number) || 0.1;
    const delta = ev.payload.ticks * sensitivity;
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom + delta));
    this.currentZoom = Math.round(this.currentZoom * 100) / 100;
    
    
    // フィードバックを先に更新
    await this.updateZoomFeedback(ev.action, this.currentZoom);
    
    const success = await this.api.setZoom(this.currentZoom);
    
    if (success) {
      await this.syncZoomToAllInstances(this.currentZoom);
    }
  }

  override async onDialDown(ev: DialDownEvent<ZoomControlSettings>): Promise<void> {
    this.currentZoom = 1.0;
    
    // すぐにフィードバックを更新
    await this.updateZoomFeedback(ev.action, this.currentZoom);
    
    const settings = await ev.action.getSettings();
    if (settings.ipAddress && this.api) {
      const success = await this.api.setZoom(this.currentZoom);
      
      if (success) {
        await this.syncZoomToAllInstances(this.currentZoom);
      }
    }
  }

  override async onDialUp(_ev: DialUpEvent<ZoomControlSettings>): Promise<void> {
    // ダイアルリリース時の処理（現在は何もしない）
  }

  override async onKeyDown(ev: KeyDownEvent<ZoomControlSettings>): Promise<void> {
    this.currentZoom = 1.0;
    
    const settings = await ev.action.getSettings();
    if (settings.ipAddress && this.api) {
      const success = await this.api.setZoom(this.currentZoom);
      
      if (success) {
        await this.syncZoomToAllInstances(this.currentZoom);
        
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

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ZoomControlSettings>): Promise<void> {
    
    const settings = ev.payload.settings;
    
    const port = settings.port || 4747;
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = undefined;
      
      if (settings.ipAddress) {
        this.api = new DroidCamAPI(settings.ipAddress, port);
        
        try {
          const cameraInfo = await this.api.getCameraInfo();
          if (cameraInfo) {
            this.minZoom = cameraInfo.zmMin || 1.0;
            this.maxZoom = cameraInfo.zmMax || 8.0;
            if (this.currentZoom < this.minZoom || this.currentZoom > this.maxZoom) {
              this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom));
            }
            
            await this.syncZoomToAllInstances(this.currentZoom);
          }
        } catch (error) {
          this.logger.error(`[${this.actionId}] Failed to get camera info on settings update:`, error);
        }
      }
    }
    
    // Encoderの場合はフィードバックを更新
    await this.updateZoomFeedback(ev.action, this.currentZoom);
  }
}