import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue, PropertyInspectorDidAppearEvent, PropertyInspectorDidDisappearEvent } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { nanoid } from 'nanoid';

// Create a logger instance for this action
const logger = streamDeck.logger.createScope('ZoomButton');

// Polling interval for API updates (5 seconds)
const API_POLLING_INTERVAL = 5000;

interface ZoomButtonSettings {
  ipAddress?: string;
  port?: number;
  sensitivity?: number;
  [key: string]: any;
}

/**
 * Zoomボタンアクション（ズームイン/アウト）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.zoom-button' })
export class ZoomButtonAction extends SingletonAction<ZoomButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private currentZoom: number = 1.0;
  private minZoom: number = 1.0;
  private maxZoom: number = 8.0;
  private readonly actionId = 'zoom-button';
  private readonly instanceId = `zoom-button-${nanoid(6)}`;
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<ZoomButtonAction>();

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    ZoomButtonAction.pollingInstances.add(this);
    
    if (!ZoomButtonAction.pollingTimer) {
      logger.info(`[${this.instanceId}] Starting API polling for ZoomButton`);
      ZoomButtonAction.pollingTimer = setInterval(() => {
        ZoomButtonAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (ZoomButtonAction.pollingInstances.size === 0) return;
    
    // 最初のインスタンスを使ってAPIを呼ぶ
    const firstInstance = Array.from(ZoomButtonAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      logger.debug(`[ZoomButton] Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        logger.debug(`[ZoomButton] No camera info available`);
        return;
      }
      
      const apiZoom = cameraInfo.zmValue || 1.0;
      logger.debug(`[ZoomButton] API zoom value: ${apiZoom}`);
      
      // 全インスタンスで変更をチェック
      for (const instance of ZoomButtonAction.pollingInstances) {
        const zoomInstance = instance as ZoomButtonAction;
        
        // 値が変わっていたら更新
        if (Math.abs(zoomInstance.currentZoom - apiZoom) > 0.001) {
          logger.info(`[${zoomInstance.instanceId}] Zoom changed from API - old: ${zoomInstance.currentZoom}, new: ${apiZoom}`);
          
          // 範囲情報も更新
          if (cameraInfo.zmMin !== undefined) zoomInstance.minZoom = cameraInfo.zmMin;
          if (cameraInfo.zmMax !== undefined) zoomInstance.maxZoom = cameraInfo.zmMax;
          
          // 値を更新して同期
          zoomInstance.currentZoom = apiZoom;
          await zoomInstance.syncZoomToAllInstances(apiZoom);
        }
      }
    } catch (error) {
      logger.error(`[ZoomButton] Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    ZoomButtonAction.pollingInstances.delete(this);
    
    if (ZoomButtonAction.pollingInstances.size === 0 && ZoomButtonAction.pollingTimer) {
      logger.info(`[${this.instanceId}] Stopping API polling`);
      clearInterval(ZoomButtonAction.pollingTimer);
      ZoomButtonAction.pollingTimer = undefined;
    }
  }


  // 全てのインスタンスに直接値を同期
  private async syncZoomToAllInstances(newZoom: number): Promise<void> {
    logger.info(`[${this.instanceId}] Syncing zoom to all instances: ${newZoom}`);
    
    // 自分自身も含めて全インスタンスを更新
    const updatePromises = Array.from(this.actions).map(async (action) => {
      // SingletonActionのインスタンスをキャスト
      const zoomAction = action as any;
      if (zoomAction) {
        // 値を直接更新
        zoomAction.currentZoom = newZoom;
        zoomAction.minZoom = this.minZoom;
        zoomAction.maxZoom = this.maxZoom;
        
        // UIを更新
        if (action.isKey()) {
          await action.setTitle(`${newZoom.toFixed(2)}x`);
        }
      }
    });
    
    await Promise.all(updatePromises);
    logger.info(`[${this.instanceId}] Synced to ${Array.from(this.actions).length} instances`);
  }


  private async initializeFromGlobalSettings(): Promise<void> {
    if (this.isInitialized) return;
    
    // Pollingで値が取得されるのを待つ
    logger.info(`[${this.actionId}] Initialized with defaults, waiting for API polling`);
    
    this.isInitialized = true;
  }

  override async onWillAppear(ev: WillAppearEvent<ZoomButtonSettings>): Promise<void> {
    logger.info(`[${this.instanceId}] Zoom Button appeared`);
    
    // 最初にGlobalSettingsから状態を初期化
    await this.initializeFromGlobalSettings();
    
    const settings = await ev.action.getSettings();
    
    // デフォルト設定
    if (settings.sensitivity === undefined) {
      settings.sensitivity = 0.5;
      await ev.action.setSettings(settings);
    }
    
    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      logger.info(`[${this.instanceId}] IP address configured: ${settings.ipAddress}:${settings.port || 4747}`);
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      logger.info(`[${this.actionId}] No IP address configured, showing default icon`);
      this.isConnected = false;
      if (ev.action.isKey()) {
        const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/zoom-in.svg' : 'icons/zoom-out.svg';
        await ev.action.setImage(iconPath);
        await ev.action.setTitle('');
        logger.info(`[${this.actionId}] Set default icon: ${iconPath}`);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ZoomButtonSettings>): Promise<void> {
    logger.info(`[${this.actionId}] Zoom Button pressed`);
    
    const settings = await ev.action.getSettings();
    
    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }
    
    // APIクライアントを初期化
    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }
    
    // まず接続をチェック
    const connectionTest = await this.api.testConnection();
    if (!connectionTest) {
      logger.error(`[${this.actionId}] Device not connected`);
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }
    
    // 現在のズーム値を取得（範囲情報のみ更新、現在値はGlobalSettingsを優先）
    const cameraInfo = await this.api.getCameraInfo();
    if (cameraInfo) {
      this.minZoom = cameraInfo.zmMin;
      this.maxZoom = cameraInfo.zmMax;
    }
    
    // ローカルの現在値を使用（Polling経由で既に同期されているはず）
    
    // ズーム値を計算（現在値 + Sensitivity）
    const sensitivity = settings.sensitivity || 0.5;
    const oldZoom = this.currentZoom;
    let newZoom = Math.min(Math.max(this.currentZoom + sensitivity, this.minZoom), this.maxZoom);
    
    logger.info(`[${this.actionId}] Zoom change: ${oldZoom} -> ${newZoom} (sensitivity: ${sensitivity})`);
    
    // ズームを設定
    const success = await this.api.setZoom(newZoom);
    
    if (success) {
      this.currentZoom = newZoom;
      logger.info(`[${this.actionId}] Zoom set to ${newZoom}`);
      this.isConnected = true;
      
      // 同じUUID内の全インスタンスに同期
      await this.syncZoomToAllInstances(newZoom);
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
        
        // タイトルに現在のズーム値を表示
        await ev.action.setTitle(`${newZoom.toFixed(2)}x`);
      }
    } else {
      logger.error(`[${this.actionId}] Failed to set zoom to ${newZoom}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ZoomButtonSettings>): Promise<void> {
    logger.info(`[${this.actionId}] Zoom Button settings updated`);
    
    const settings = ev.payload.settings;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/zoom-in.svg' : 'icons/zoom-out.svg';
        await ev.action.setImage(iconPath);
        await ev.action.setTitle('');
      }
    }
  }

  override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<ZoomButtonSettings>): Promise<void> {
    logger.info(`[${this.instanceId}] Property Inspector appeared for Zoom Button`);
    
    const settings = await ev.action.getSettings();
    logger.debug(`[${this.instanceId}] Current settings:`, {
      ipAddress: settings.ipAddress || 'not set',
      port: settings.port || 4747,
      sensitivity: settings.sensitivity ?? 0.5
    });
    
    logger.debug(`[${this.instanceId}] Current zoom state:`, {
      isConnected: this.isConnected,
      currentZoom: this.currentZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    });
    
    // Property Inspectorに現在の状態を送信
    const payload = {
      connectionStatus: this.isConnected,
      currentZoom: this.currentZoom,
      zoomRange: {
        min: this.minZoom,
        max: this.maxZoom
      }
    };
    
    logger.debug(`[${this.instanceId}] Sending state to Property Inspector:`, payload);
    streamDeck.ui.current?.sendToPropertyInspector(payload);
  }

  override async onPropertyInspectorDidDisappear(ev: PropertyInspectorDidDisappearEvent<ZoomButtonSettings>): Promise<void> {
    logger.info(`[${this.instanceId}] Property Inspector disappeared for Zoom Button`);
    
    // Property Inspectorが閉じられた時の追加処理があればここに記述
    logger.debug(`[${this.instanceId}] Final state when PI closed:`, {
      isConnected: this.isConnected,
      currentZoom: this.currentZoom
    });
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ZoomButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        logger.info(`[${this.actionId}] Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: ZoomButtonSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    logger.info(`[${this.actionId}] Checking connection to ${settings.ipAddress}:${port}`);
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
      logger.info(`[${this.actionId}] Created new API instance`);
    }
    
    try {
      logger.info(`[${this.actionId}] Testing connection...`);
      const connectionTest = await this.api.testConnection();
      logger.info(`[${this.actionId}] Connection test result: ${connectionTest}`);
      
      if (connectionTest) {
        this.isConnected = true;
        
        // 現在のズーム値を取得
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          // 範囲情報を更新
          this.minZoom = cameraInfo.zmMin;
          this.maxZoom = cameraInfo.zmMax;
          
          // APIから現在値を取得（ログのみ、同期はしない）
          const apiZoom = cameraInfo.zmValue;
          if (Math.abs(this.currentZoom - apiZoom) > 0.01) {
            logger.info(`[${this.actionId}] API zoom (${apiZoom}) differs from shared zoom (${this.currentZoom}), but keeping shared state`);
            // 注: ここでupdateSharedZoomを呼ばない（2重処理防止）
          }
          
          logger.info(`[${this.actionId}] Connected to DroidCam. Current zoom: ${this.currentZoom}, range: ${this.minZoom}-${this.maxZoom}`);
          
          if (action.isKey()) {
            await action.setTitle(`${this.currentZoom.toFixed(2)}x`);
            // Sensitivityに応じたアイコンを設定
            const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/zoom-in.svg' : 'icons/zoom-out.svg';
            await action.setImage(iconPath);
          }
        }
      } else {
        this.isConnected = false;
        await this.updateButtonState(action, false);
      }
    } catch (error) {
      logger.error(`[${this.actionId}] Error checking connection:`, error);
      this.isConnected = false;
      await this.updateButtonState(action, false);
    }
  }

  private async updateButtonState(action: any, connected: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    const settings = await action.getSettings();
    const isZoomIn = settings.sensitivity >= 0;
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}