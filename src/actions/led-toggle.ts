import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';

// Create a logger instance for this action
const logger = streamDeck.logger.createScope('LEDToggle');

interface LEDToggleSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

/**
 * LED/フラッシュトグルアクション
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.led-toggle' })
export class LEDToggleAction extends SingletonAction<LEDToggleSettings> {
  private api?: DroidCamAPI;
  private isLEDOn: boolean = false;
  private isConnected: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<LEDToggleSettings>): Promise<void> {
    logger.info('LED Toggle button appeared');
    
    const settings = await ev.action.getSettings();
    
    // 設定がある場合は先に接続を確認してAPIから状態を取得
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合のみデフォルト状態を設定
      if (ev.action.isKey()) {
        await ev.action.setState(this.isLEDOn ? 1 : 0);
        // 初期アイコンを設定
        await ev.action.setImage(this.isLEDOn ? 'icons/led-on.svg' : 'icons/led-off.svg');
      }
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<LEDToggleSettings>): Promise<void> {
    logger.info('LED Toggle button pressed');
    
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
    
    // LEDをトグル
    const success = await this.api.toggleLED();
    
    if (success) {
      // トグル成功後、APIから最新の状態を取得
      const cameraInfo = await this.api.getCameraInfo();
      if (cameraInfo) {
        // APIの実際の値を使用（led_on: 0=ON, 1=OFF）
        this.isLEDOn = cameraInfo.led_on === 0;
        logger.info(`LED toggled. New state: ${this.isLEDOn ? 'ON' : 'OFF'} (led_on=${cameraInfo.led_on})`);
      } else {
        // APIから取得できない場合のみローカルで反転
        this.isLEDOn = !this.isLEDOn;
        logger.warn('Could not get camera info after toggle, using local state');
      }
      
      this.isConnected = true;
      
      if (ev.action.isKey()) {
        // ステートを更新（0: OFF, 1: ON）
        await ev.action.setState(this.isLEDOn ? 1 : 0);
        // アイコンを明示的に設定
        await ev.action.setImage(this.isLEDOn ? 'icons/led-on.svg' : 'icons/led-off.svg');
        await ev.action.showOk();
      }
    } else {
      if (ev.action.isKey()) {
        await this.updateButtonState(ev.action, false);
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LEDToggleSettings>): Promise<void> {
    logger.info('LED Toggle settings updated');
    
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

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, LEDToggleSettings>): Promise<void> {
    // payloadが正しい形式かチェック
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        logger.info(`Test connection successful: ${payload.deviceName}`);
        
        // 接続成功時はLED状態を確認
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: LEDToggleSettings): Promise<void> {
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
        
        // APIからLED状態を取得
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo) {
          // APIでは led_on: 0=ON, 1=OFF（直感と逆）
          this.isLEDOn = cameraInfo.led_on === 0;
          logger.info(`Connected to DroidCam. LED state: ${this.isLEDOn ? 'ON' : 'OFF'} (led_on=${cameraInfo.led_on})`);
          
          if (action.isKey()) {
            await action.setState(this.isLEDOn ? 1 : 0);
            await action.setImage(this.isLEDOn ? 'icons/led-on.svg' : 'icons/led-off.svg');
          }
        } else {
          // カメラ情報が取得できない場合はデフォルトでOFF
          this.isLEDOn = false;
          logger.info('Connected to DroidCam. LED state: OFF (default)');
          
          if (action.isKey()) {
            await action.setState(0);
            await action.setImage('icons/led-off.svg');
          }
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
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}