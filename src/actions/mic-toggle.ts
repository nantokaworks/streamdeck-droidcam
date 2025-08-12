import streamDeck, { action, DidReceiveSettingsEvent, JsonValue, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';

// Create a logger instance for this action
const logger = streamDeck.logger.createScope('MICToggle');

interface MicToggleSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

/**
 * マイクトグルアクション
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.mic-toggle' })
export class MicToggleAction extends SingletonAction<MicToggleSettings> {
  private api?: DroidCamAPI;
  private isMicOn: boolean = false;  // デフォルトをOFF（ミュート）に変更
  private isConnected: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<MicToggleSettings>): Promise<void> {
    logger.info('Mic Toggle button appeared');

    const settings = await ev.action.getSettings();

    // 初期状態を設定（現在の状態に基づく）
    if (ev.action.isKey()) {
      await ev.action.setState(this.isMicOn ? 1 : 0);
      // 初期アイコンを設定
      await ev.action.setImage(this.isMicOn ? 'icons/mic-on.svg' : 'icons/mic-off.svg');
    }

    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<MicToggleSettings>): Promise<void> {
    logger.info('Mic Toggle button pressed');

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
      logger.error('Device not connected');
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }

    // マイクをトグル
    const success = await this.api.toggleMic();

    if (success) {
      this.isMicOn = !this.isMicOn;
      logger.info(`Mic is now ${this.isMicOn ? 'ON' : 'MUTED'}`);
      this.isConnected = true;

      if (ev.action.isKey()) {
        // ステートを更新（0: MUTED, 1: ON）
        await ev.action.setState(this.isMicOn ? 1 : 0);
        // アイコンを明示的に設定
        const iconPath = this.isMicOn ? 'icons/mic-on.svg' : 'icons/mic-off.svg';
        await ev.action.setImage(iconPath);
        await ev.action.showOk();
      }
    } else {
      if (ev.action.isKey()) {
        await this.updateButtonState(ev.action, false);
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MicToggleSettings>): Promise<void> {
    logger.info('Mic Toggle settings updated');

    const settings = ev.payload.settings;

    // APIインスタンスをリセット
    this.api = undefined;

    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MicToggleSettings>): Promise<void> {
    // payloadが正しい形式かチェック
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;

      if (payload.action === 'testConnection' && payload.success) {
        logger.info(`Test connection successful: ${payload.deviceName}`);

        // 接続成功時はマイク状態を確認
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: MicToggleSettings): Promise<void> {
    if (!settings.ipAddress) return;

    const port = settings.port || 4747;

    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
    }

    try {
      // 接続をテスト
      const connectionTest = await this.api.testConnection();

      if (connectionTest) {
        this.isConnected = true;
        // マイク状態を取得できないため、現在の状態を維持
        // this.isMicOn は変更しない

        logger.info(`Connected to DroidCam. Mic state: ${this.isMicOn ? 'ON' : 'OFF'} (maintained)`);

        if (action.isKey()) {
          await action.setState(this.isMicOn ? 1 : 0);
          await action.setImage(this.isMicOn ? 'icons/mic-on.svg' : 'icons/mic-off.svg');
        }
      } else {
        this.isConnected = false;
        if (action.isKey()) {
          await this.updateButtonState(action, false);
        }
      }
    } catch (error) {
      logger.error('Error checking connection:', error);
      this.isConnected = false;
      await this.updateButtonState(action, false);
    }
  }

  private async updateButtonState(action: any, connected: boolean): Promise<void> {
    if (!action.isKey()) return;

    if (connected) {
      // 接続時：現在のマイク状態に応じたアイコンを明示的に設定
      logger.info(`Connected: setting Mic ${this.isMicOn ? 'ON' : 'OFF'} icon`);

      const iconPath = this.isMicOn ? 'icons/mic-on.svg' : 'icons/mic-off.svg';
      await action.setImage(iconPath);
    } else {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}