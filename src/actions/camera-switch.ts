import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';

interface CameraSwitchSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

@action({ UUID: 'works.nantoka.droidcam.camera-switch' })
export class CameraSwitchAction extends SingletonAction<CameraSwitchSettings> {
  private api?: DroidCamAPI;
  private currentCamera: number = 0;
  private isConnected: boolean = false;
  private logger = streamDeck.logger.createScope('CameraSwitch');

  override async onWillAppear(ev: WillAppearEvent<CameraSwitchSettings>): Promise<void> {
    this.logger.info('Camera Switch button appeared');

    const settings = await ev.action.getSettings();
    
    if (ev.action.isKey()) {
      await ev.action.setState(0);
      await ev.action.setImage('icons/disconnected');
      await ev.action.setTitle('');
    }
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<CameraSwitchSettings>): Promise<void> {
    this.logger.info('Camera Switch button pressed');

    const settings = await ev.action.getSettings();

    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }

    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }

    const connectionTest = await this.api.testConnection();
    if (!connectionTest) {
      this.logger.error('Device not connected');
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }

    this.currentCamera = this.currentCamera === 0 ? 1 : 0;
    const success = await this.api.switchCamera(this.currentCamera);

    if (success) {
      this.logger.info(`Switched to camera ${this.currentCamera}`);
      this.isConnected = true;

      if (ev.action.isKey()) {
        await ev.action.setState(this.currentCamera);
        await ev.action.setTitle(this.currentCamera === 0 ? 'Back' : 'Front');
        await ev.action.showOk();
      }
    } else {
      this.currentCamera = this.currentCamera === 0 ? 1 : 0;

      if (ev.action.isKey()) {
        await this.updateButtonState(ev.action, false);
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CameraSwitchSettings>): Promise<void> {
    this.logger.info('Camera Switch settings updated');
    
    const settings = ev.payload.settings;
    
    this.api = undefined;
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, CameraSwitchSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: CameraSwitchSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
    }
    
    try {
      const cameraInfo = await this.api.getCameraInfo();
      
      if (cameraInfo) {
        this.isConnected = true;
        this.currentCamera = cameraInfo.active || 0;
        
        this.logger.info(`Connected to DroidCam. Current camera: ${this.currentCamera}`);
        
        if (action.isKey()) {
          await action.setState(this.currentCamera);
          await action.setImage('icons/camera-switch');
          await action.setTitle(this.currentCamera === 0 ? 'Back' : 'Front');
        }
      } else {
        this.isConnected = false;
        if (action.isKey()) {
          await this.updateButtonState(action, false);
        }
      }
    } catch (error) {
      this.logger.error('Error checking camera state:', error);
      this.isConnected = false;
      await this.updateButtonState(action, false);
    }
  }

  private async updateButtonState(action: any, connected: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    if (connected) {
      this.logger.info(`Connected: setting camera ${this.currentCamera} state`);
      
      await action.setImage('icons/camera-switch');
      await action.setTitle(this.currentCamera === 0 ? 'Back' : 'Front');
    } else {
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}