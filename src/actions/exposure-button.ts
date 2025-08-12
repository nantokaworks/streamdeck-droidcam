import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface ExposureButtonSettings {
  ipAddress?: string;
  port?: number;
  sensitivity?: number;
  [key: string]: any;
}

/**
 * Exposureボタンアクション（露出補正の増減）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.exposure-button' })
export class ExposureButtonAction extends SingletonAction<ExposureButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private currentExposure: number = 0;
  private minExposure: number = -24.0;
  private maxExposure: number = 24.0;
  private readonly logger = streamDeck.logger.createScope('ExposureButton');
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<ExposureButtonAction>();

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    ExposureButtonAction.pollingInstances.add(this);
    
    if (!ExposureButtonAction.pollingTimer) {
      this.logger.info(`Starting API polling for ExposureButton`);
      ExposureButtonAction.pollingTimer = setInterval(() => {
        ExposureButtonAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (ExposureButtonAction.pollingInstances.size === 0) return;
    
    // 最初のインスタンスを使ってAPIを呼ぶ
    const firstInstance = Array.from(ExposureButtonAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      firstInstance.logger.debug(`[ExposureButton] Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        firstInstance.logger.debug(`[ExposureButton] No camera info available`);
        return;
      }
      
      const apiExposure = cameraInfo.evValue || 0.0;
      firstInstance.logger.debug(`[ExposureButton] API exposure value: ${apiExposure}`);
      
      // 全インスタンスで変更をチェック
      for (const instance of ExposureButtonAction.pollingInstances) {
        const exposureInstance = instance as ExposureButtonAction;
        
        // 値が変わっていたら更新
        if (Math.abs(exposureInstance.currentExposure - apiExposure) > 0.001) {
          firstInstance.logger.info(`Exposure changed from API - old: ${exposureInstance.currentExposure}, new: ${apiExposure}`);
          
          // 範囲情報も更新
          if (cameraInfo.evMin !== undefined) exposureInstance.minExposure = cameraInfo.evMin;
          if (cameraInfo.evMax !== undefined) exposureInstance.maxExposure = cameraInfo.evMax;
          
          // 値を更新して同期
          exposureInstance.currentExposure = apiExposure;
          await exposureInstance.syncExposureToAllInstances(apiExposure);
        }
      }
    } catch (error) {
      firstInstance.logger.error(`[ExposureButton] Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    ExposureButtonAction.pollingInstances.delete(this);
    
    if (ExposureButtonAction.pollingInstances.size === 0 && ExposureButtonAction.pollingTimer) {
      this.logger.info(`Stopping API polling`);
      clearInterval(ExposureButtonAction.pollingTimer);
      ExposureButtonAction.pollingTimer = undefined;
    }
  }


  // 全てのインスタンスに直接値を同期
  private async syncExposureToAllInstances(newExposure: number): Promise<void> {
    this.logger.info(`Syncing exposure to all instances: ${newExposure}`);
    
    // 自分自身も含めて全インスタンスを更新
    const updatePromises = Array.from(this.actions).map(async (action) => {
      // SingletonActionのインスタンスをキャスト
      const exposureAction = action as any;
      if (exposureAction) {
        // 値を直接更新
        exposureAction.currentExposure = newExposure;
        exposureAction.minExposure = this.minExposure;
        exposureAction.maxExposure = this.maxExposure;
        
        // UIを更新
        if (action.isKey()) {
          const formattedValue = newExposure === 0 ? '±0.0' : (newExposure > 0 ? `+${newExposure.toFixed(1)}` : newExposure.toFixed(1));
          await action.setTitle(`${formattedValue}EV`);
        }
      }
    });
    
    await Promise.all(updatePromises);
    this.logger.info(`Synced to ${Array.from(this.actions).length} instances`);
  }


  private async initializeFromGlobalSettings(): Promise<void> {
    if (this.isInitialized) return;
    
    // Pollingで値が取得されるのを待つ
    this.logger.info(`Initialized with defaults, waiting for API polling`);
    
    this.isInitialized = true;
  }

  private formatExposure(value: number): string {
    if (value === 0) return '±0.0';
    return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }

  override async onWillAppear(ev: WillAppearEvent<ExposureButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Button appeared`);
    
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
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/exposure-up.svg' : 'icons/exposure-down.svg';
        await ev.action.setImage(iconPath);
        await ev.action.setTitle('');
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ExposureButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Button pressed`);
    
    const settings = await ev.action.getSettings();
    this.logger.info(`Exposure Button settings:`, settings);
    
    if (!settings.ipAddress) {
      this.logger.info(`No IP address configured`);
      await ev.action.showAlert();
      return;
    }
    
    // APIクライアントを初期化
    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }
    
    // まず接続をチェック
    this.logger.info(`Testing connection...`);
    const connectionTest = await this.api.testConnection();
    this.logger.info(`Connection test result: ${connectionTest}`);
    
    if (!connectionTest) {
      this.logger.error(`Device not connected`);
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }
    
    // 現在の露出値を取得（範囲情報のみ更新、現在値はGlobalSettingsを優先）
    const cameraInfo = await this.api.getCameraInfo();
    if (cameraInfo) {
      this.minExposure = cameraInfo.evMin;
      this.maxExposure = cameraInfo.evMax;
      this.logger.info(`Camera info - evMin: ${cameraInfo.evMin}, evMax: ${cameraInfo.evMax}`);
    }
    
    // ローカルの現在値を使用（Polling経由で既に同期されているはず）
    
    // 露出値を計算（現在値 + Sensitivity）
    const sensitivity = settings.sensitivity || 0.5;
    const oldExposure = this.currentExposure;
    let newExposure = Math.min(Math.max(this.currentExposure + sensitivity, this.minExposure), this.maxExposure);
    
    this.logger.info(`Exposure calculation - current: ${oldExposure}, sensitivity: ${sensitivity}, new: ${newExposure}`);
    
    // 露出を設定
    const success = await this.api.setExposure(newExposure);
    
    if (success) {
      this.currentExposure = newExposure;
      this.logger.info(`Exposure set to ${newExposure}`);
      this.isConnected = true;
      
      // 同じUUID内の全インスタンスに同期
      await this.syncExposureToAllInstances(newExposure);
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
        
        // タイトルに現在の露出値を表示
        await ev.action.setTitle(`${this.formatExposure(newExposure)}EV`);
      }
    } else {
      this.logger.error(`Failed to set exposure to ${newExposure}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ExposureButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Button settings updated`);
    
    const settings = ev.payload.settings;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/exposure-up.svg' : 'icons/exposure-down.svg';
        await ev.action.setImage(iconPath);
        await ev.action.setTitle('');
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ExposureButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: ExposureButtonSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
    }
    
    try {
      const connectionTest = await this.api.testConnection();
      
      if (connectionTest) {
        this.isConnected = true;
        
        // 現在の露出値を取得
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          // 範囲情報を更新
          this.minExposure = cameraInfo.evMin;
          this.maxExposure = cameraInfo.evMax;
          
          // APIから現在値を取得（ログのみ、同期はしない）
          const apiExposure = cameraInfo.evValue;
          if (Math.abs(this.currentExposure - apiExposure) > 0.01) {
            this.logger.info(`API exposure (${apiExposure}) differs from shared exposure (${this.currentExposure}), but keeping shared state`);
            // 注: ここでupdateSharedExposureを呼ばない（2重処理防止）
          }
          
          this.logger.info(`Connected to DroidCam. Current exposure: ${this.currentExposure}, range: ${this.minExposure}-${this.maxExposure}`);
          
          if (action.isKey()) {
            await action.setTitle(`${this.formatExposure(this.currentExposure)}EV`);
            // Sensitivityに応じたアイコンを設定
            const iconPath = (settings.sensitivity ?? 0.5) >= 0 ? 'icons/exposure-up.svg' : 'icons/exposure-down.svg';
            await action.setImage(iconPath);
          }
        }
      } else {
        this.isConnected = false;
        await this.updateButtonState(action, false);
      }
    } catch (error) {
      this.logger.error(`Error checking connection:`, error);
      this.isConnected = false;
      await this.updateButtonState(action, false);
    }
  }

  private async updateButtonState(action: any, connected: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    const settings = await action.getSettings();
    const isUp = settings.sensitivity >= 0;
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}