import streamDeck, {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
	DidReceiveSettingsEvent,
	SendToPluginEvent,
	JsonValue,
} from "@elgato/streamdeck";
import { DroidCamAPI } from '../services/DroidCamAPI';

interface ConnectionStatusSettings {
  ipAddress?: string;
  port?: number;
  checkInterval?: number;
  title?: string;
  [key: string]: any;
}

@action({ UUID: "works.nantoka.droidcam.connection-status" })
export class ConnectionStatusAction extends SingletonAction<ConnectionStatusSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private checkInterval?: ReturnType<typeof setInterval>;
  private currentAction?: any;
  private isCheckInProgress: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<ConnectionStatusSettings>): Promise<void> {
    streamDeck.logger.info('Connection Status button appeared');
    
    if (this.currentAction && this.currentAction !== ev.action) {
      streamDeck.logger.info('Different action instance detected, stopping previous auto-check');
      this.stopAutoCheck();
    }
    
    this.currentAction = ev.action;
    
    const settings = ev.payload.settings;
    
    if (settings.ipAddress) {
      // 初期表示時は即座に接続チェックを実行してアイコンを更新
      await this.checkConnection(ev.action, settings);
      this.startAutoCheck(ev.action, settings);
    } else {
      // IPアドレスが未設定の場合は切断状態として表示
      if (ev.action.isKey()) {
        await this.updateStatus(ev.action, false, settings);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ConnectionStatusSettings>): Promise<void> {
    streamDeck.logger.info('Connection Status button pressed - manual check');
    
    const settings = ev.payload.settings;
    
    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }
    
    await this.checkConnection(ev.action, settings, true);
  }

  override async onWillDisappear(_ev: WillDisappearEvent<ConnectionStatusSettings>): Promise<void> {
    streamDeck.logger.info('Connection Status button disappeared');
    this.stopAutoCheck();
    this.currentAction = undefined;
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ConnectionStatusSettings>): Promise<void> {
    streamDeck.logger.info('Connection Status settings updated');
    streamDeck.logger.info(`Settings updated - Host: ${ev.payload.settings.ipAddress}, Port: ${ev.payload.settings.port || 4747}`);
    
    this.stopAutoCheck();
    this.api = undefined;
    
    const settings = ev.payload.settings;
    if (settings.ipAddress && this.currentAction) {
      await this.checkConnection(this.currentAction, settings);
      this.startAutoCheck(this.currentAction, settings);
    } else if (!settings.ipAddress && this.currentAction) {
      this.isConnected = false;
      await this.updateStatus(this.currentAction, false, settings);
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ConnectionStatusSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection') {
        streamDeck.logger.info('Test connection requested from Property Inspector');
        
        const settings = await ev.action.getSettings();
        const ipAddress = payload.ipAddress || settings.ipAddress;
        const port = payload.port || settings.port || 4747;
        
        if (!ipAddress) {
          // IPアドレスが設定されていない場合
          await streamDeck.ui.current?.sendToPropertyInspector({
            event: 'testConnectionResult',
            success: false,
            error: 'IP address is required'
          });
          return;
        }
        
        // テスト用のAPIインスタンスを作成
        const testApi = new DroidCamAPI(ipAddress, port);
        
        try {
          const device = await testApi.testConnection();
          
          if (device) {
            streamDeck.logger.info(`Test connection successful: ${device.model}`);
            
            // 成功結果を返送
            await streamDeck.ui.current?.sendToPropertyInspector({
              event: 'testConnectionResult',
              success: true,
              deviceName: device.model
            });
            
            // 接続成功したら、現在の設定を使って通常の接続チェックも実行
            if (this.currentAction) {
              await this.checkConnection(this.currentAction, settings);
            }
          } else {
            // 接続失敗
            await streamDeck.ui.current?.sendToPropertyInspector({
              event: 'testConnectionResult',
              success: false,
              error: 'Failed to connect to DroidCam'
            });
          }
        } catch (error: any) {
          streamDeck.logger.error('Test connection error:', error);
          
          // エラー結果を返送
          await streamDeck.ui.current?.sendToPropertyInspector({
            event: 'testConnectionResult',
            success: false,
            error: error.message || 'Connection failed'
          });
        }
      }
    }
  }

  private async checkConnection(action: any, settings: ConnectionStatusSettings, isManual: boolean = false): Promise<void> {
    if (!settings.ipAddress) return;
    
    if (this.isCheckInProgress && !isManual) {
      streamDeck.logger.info('Connection check already in progress, skipping...');
      return;
    }
    
    this.isCheckInProgress = true;
    
    try {
      const port = settings.port || 4747;
      
      if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
        this.api = new DroidCamAPI(settings.ipAddress, port);
      }
      
      // 現在の接続状態を保持
      const previousState = this.isConnected;
      
      const device = await this.api.testConnection();
      
      if (device) {
        this.isConnected = true;
        streamDeck.logger.info('Connected to:', device.model);
        
        // 状態が変わった時のみ更新
        if (previousState !== this.isConnected) {
          if (action.isKey()) {
            try {
              // ステートを設定して、manifestで定義されたアイコンを使用
              await action.setState(1); // 接続状態のアイコンを表示
              
              // 接続状態のアイコンを設定
              await action.setImage('icons/connected');
              
              // ユーザーが設定したタイトルがある場合のみ表示
              if (settings.title && settings.title.trim()) {
                await action.setTitle(settings.title);
              } else {
                await action.setTitle(''); // タイトルなし
              }
            } catch (e) {
              streamDeck.logger.error('Error setting state/title:', e);
            }
          }
        }
        
        if (isManual && action.isKey()) {
          await action.showOk();
        }
      } else {
        this.isConnected = false;
        streamDeck.logger.info('Disconnected from DroidCam');
        
        // 状態が変わった時のみ更新
        if (previousState !== this.isConnected) {
          if (action.isKey()) {
            try {
              // ステートを設定して、manifestで定義されたアイコンを使用
              await action.setState(0); // 切断状態のアイコンを表示
              
              // 切断状態のアイコンを設定
              await action.setImage('icons/disconnected');
              
              // ユーザーが設定したタイトルがある場合のみ表示
              if (settings.title && settings.title.trim()) {
                await action.setTitle(settings.title);
              } else {
                await action.setTitle(''); // タイトルなし
              }
            } catch (e) {
              streamDeck.logger.error('Error setting state/title:', e);
            }
          }
        }
        
        if (isManual && action.isKey()) {
          await action.showAlert();
        }
      }
    } catch (error) {
      streamDeck.logger.error('Error in checkConnection:', error);
      this.isConnected = false;
      await this.updateStatus(action, false, settings);
    } finally {
      this.isCheckInProgress = false;
    }
  }

  private startAutoCheck(action: any, settings: ConnectionStatusSettings): void {
    this.stopAutoCheck();
    
    const intervalSeconds = settings.checkInterval || 5;
    streamDeck.logger.info(`Starting auto-check every ${intervalSeconds} seconds`);
    
    this.checkInterval = setInterval(async () => {
      try {
        if (!this.currentAction) {
          streamDeck.logger.warn('Current action is null, stopping auto-check');
          this.stopAutoCheck();
          return;
        }
        
        streamDeck.logger.info('Auto-check running...');
        // 毎回最新の設定を取得
        const currentSettings = await action.getSettings();
        await this.checkConnection(action, currentSettings);
      } catch (error) {
        streamDeck.logger.error('Error during auto-check:', error);
        this.isCheckInProgress = false;
      }
    }, intervalSeconds * 1000);
  }

  private stopAutoCheck(): void {
    if (this.checkInterval) {
      streamDeck.logger.info('Stopping auto-check');
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  private async updateStatus(action: any, connected: boolean, settings?: ConnectionStatusSettings): Promise<void> {
    if (action.isKey()) {
      // ステートを設定（0: 切断, 1: 接続）
      await action.setState(connected ? 1 : 0);
      
      // 接続状態に応じてアイコンを設定
      if (connected) {
        await action.setImage('icons/connected');
      } else {
        await action.setImage('icons/disconnected');
      }
      
      // ユーザーが設定したタイトルがある場合のみ表示
      if (settings?.title && settings.title.trim()) {
        await action.setTitle(settings.title);
      } else {
        await action.setTitle(''); // タイトルなし
      }
    }
  }
}