import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface ExposureLockButtonSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

/**
 * Exposure Lockボタンアクション（露出ロック切り替え）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.exposure-lock-button' })
export class ExposureLockButtonAction extends SingletonAction<ExposureLockButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private isLocked: boolean = false;
  private pollingInterval?: NodeJS.Timeout;
  private readonly logger = streamDeck.logger.createScope('ExposureLockButton');
  private isInitialized = false;

  override async onWillAppear(ev: WillAppearEvent<ExposureLockButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Lock Button appeared`);
    
    const settings = await ev.action.getSettings();
    
    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      this.logger.info(`IP address configured: ${settings.ipAddress}:${settings.port || 4747}`);
      await this.checkConnectionAndUpdateState(ev.action, settings);
      this.startPolling(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合はデフォルトアイコンを表示
      this.logger.info(`No IP address configured, showing default icon`);
      this.isConnected = false;
      if (ev.action.isKey()) {
        await ev.action.setImage('icons/exposure-control.svg');
        await ev.action.setTitle('');
      }
    }
  }

  override async onWillDisappear(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ExposureLockButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Lock Button pressed`);
    
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
      this.logger.error(`Device not connected`);
      this.isConnected = false;
      await this.updateButtonState(ev.action, false, this.isLocked);
      await ev.action.showAlert();
      return;
    }
    
    this.logger.info(`Toggling exposure lock`);
    
    // 露出ロックを切り替え
    const success = await this.api.toggleExposureLock();
    
    if (success) {
      this.logger.info(`Exposure lock toggled`);
      this.isConnected = true;
      
      // 新しい状態を取得
      const cameraInfo = await this.api.getCameraInfo();
      if (cameraInfo) {
        this.isLocked = cameraInfo.exposure_lock === 1;
        await this.updateButtonState(ev.action, true, this.isLocked);
      }
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    } else {
      this.logger.error(`Failed to toggle exposure lock`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ExposureLockButtonSettings>): Promise<void> {
    this.logger.info(`Exposure Lock Button settings updated`);
    
    const settings = ev.payload.settings;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    // ポーリングを停止
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
      this.startPolling(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合はデフォルトアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        await ev.action.setImage('icons/exposure-control.svg');
        await ev.action.setTitle('');
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ExposureLockButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
        
        if (!this.pollingInterval) {
          this.startPolling(ev.action, settings);
        }
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: ExposureLockButtonSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    this.logger.info(`Checking connection to ${settings.ipAddress}:${port}`);
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
      this.logger.info(`Created new API instance`);
    }
    
    try {
      this.logger.info(`Testing connection...`);
      const connectionTest = await this.api.testConnection();
      this.logger.info(`Connection test result: ${connectionTest}`);
      
      if (connectionTest) {
        this.isConnected = true;
        this.logger.info(`Connected to DroidCam`);
        
        // カメラ情報を取得してロック状態を確認
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          this.isLocked = cameraInfo.exposure_lock === 1;
          this.logger.info(`Exposure lock state: ${this.isLocked}`);
        }
        
        await this.updateButtonState(action, true, this.isLocked);
      } else {
        this.isConnected = false;
        await this.updateButtonState(action, false, false);
      }
    } catch (error) {
      this.logger.error(`Error checking connection:`, error);
      this.isConnected = false;
      await this.updateButtonState(action, false, false);
    }
  }

  private startPolling(action: any, settings: ExposureLockButtonSettings): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.pollingInterval = setInterval(async () => {
      if (!this.api || !this.isConnected) return;
      
      try {
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          const newLockState = cameraInfo.exposure_lock === 1;
          if (newLockState !== this.isLocked) {
            this.isLocked = newLockState;
            await this.updateButtonState(action, true, this.isLocked);
            this.logger.info(`Exposure lock state changed to: ${this.isLocked}`);
          }
        }
      } catch (error) {
        this.logger.error(`Polling error:`, error);
      }
    }, API_POLLING_INTERVAL);
  }

  private async updateButtonState(action: any, connected: boolean, locked: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    } else {
      // 接続時：共通アイコンを表示し、タイトルで状態を表現
      await action.setImage('icons/exposure-control.svg');
      await action.setTitle(locked ? 'Locked' : 'Unlocked');
    }
  }
}