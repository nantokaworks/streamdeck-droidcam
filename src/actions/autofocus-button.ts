import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';

interface AutofocusButtonSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

/**
 * Autofocusボタンアクション（オートフォーカス実行）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.autofocus-button' })
export class AutofocusButtonAction extends SingletonAction<AutofocusButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private readonly logger = streamDeck.logger.createScope('AutofocusButton');

  override async onWillAppear(ev: WillAppearEvent<AutofocusButtonSettings>): Promise<void> {
    this.logger.info(`Autofocus Button appeared`);
    
    const settings = await ev.action.getSettings();
    
    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      this.logger.info(`IP address configured: ${settings.ipAddress}:${settings.port || 4747}`);
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.logger.info(`No IP address configured, showing default icon`);
      this.isConnected = false;
      if (ev.action.isKey()) {
        await ev.action.setImage('icons/autofocus.svg');
        await ev.action.setTitle('');
        this.logger.info(`Set default icon`);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<AutofocusButtonSettings>): Promise<void> {
    this.logger.info(`Autofocus Button pressed`);
    
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
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }
    
    // オートフォーカスを実行
    this.logger.info(`Triggering autofocus`);
    const success = await this.api.autofocus();
    
    if (success) {
      this.logger.info(`Autofocus triggered successfully`);
      this.isConnected = true;
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
        
        // フォーカス中を示すアニメーション（タイトルで表現）
        await ev.action.setTitle('AF...');
        
        // 1秒後にタイトルをクリア
        setTimeout(async () => {
          await ev.action.setTitle('');
        }, 1000);
      }
    } else {
      this.logger.error(`Failed to trigger autofocus`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<AutofocusButtonSettings>): Promise<void> {
    this.logger.info(`Autofocus Button settings updated`);
    
    const settings = ev.payload.settings;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        await ev.action.setImage('icons/autofocus.svg');
        await ev.action.setTitle('');
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, AutofocusButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: AutofocusButtonSettings): Promise<void> {
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
        
        if (action.isKey()) {
          await action.setImage('icons/autofocus.svg');
          await action.setTitle('');
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
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}