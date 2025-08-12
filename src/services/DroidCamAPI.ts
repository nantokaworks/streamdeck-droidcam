import streamDeck from '@elgato/streamdeck';

export interface DroidCamDevice {
  model: string;
  manufacturer: string;
}

export interface DroidCamCameraInfo {
  active: number;
  led_on: number;
  wbMode: number;
  wbLock: number;
  wbValue: number;
  wbMin: number;
  wbMax: number;
  focusMode: number;
  mfValue: number;
  mfMin: number;
  mfMax: number;
  zmValue: number;
  zmMin: number;
  zmMax: number;
  evValue: number;
  evMin: number;
  evMax: number;
  exposure_lock: number;
  mute_sound: number;
}

export interface DroidCamBatteryInfo {
  level: number;
  amps: number;
}

export class DroidCamAPI {
  private baseUrl: string;
  private timeout: number = 5000;
  public readonly host: string;
  public readonly port: number;

  constructor(hostOrIp: string, port: number = 4747) {
    this.host = hostOrIp;
    this.port = port;
    this.baseUrl = `http://${hostOrIp}:${port}`;
  }

  /**
   * Test connection to DroidCam
   */
  async testConnection(): Promise<DroidCamDevice | null> {
    const url = `${this.baseUrl}/v1/phone/name`;
    streamDeck.logger.info(`Attempting to connect to: ${url}`);
    
    try {
      // スマートフォンの名前を取得
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Connection failed with status: ${response.status}`);
        return null;
      }
      
      const deviceName = await response.text();
      streamDeck.logger.info('Successfully connected to DroidCam:', deviceName);
      
      return {
        model: deviceName.trim(),
        manufacturer: 'DroidCam'
      };
    } catch (error: any) {
      // エラーの詳細情報をログ出力
      if (error.name === 'AbortError') {
        streamDeck.logger.error(`Connection timeout after ${this.timeout}ms to ${this.host}:${this.port}`);
      } else if (error.cause) {
        streamDeck.logger.error(`Connection failed to ${this.host}:${this.port} - Cause:`, error.cause);
      } else {
        streamDeck.logger.error(`Failed to connect to DroidCam at ${url}:`, error.message || error);
      }
      return null;
    }
  }

  /**
   * Get camera information
   */
  async getCameraInfo(): Promise<DroidCamCameraInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/info`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to get camera info: ${response.status}`);
        return null;
      }
      
      const info = await response.json() as DroidCamCameraInfo;
      streamDeck.logger.info('Camera info:', info);
      return info;
    } catch (error) {
      streamDeck.logger.error('Error getting camera info:', error);
      return null;
    }
  }

  /**
   * Set zoom level
   * @param level 0.0 ~ 8.0
   */
  async setZoom(level: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/camera/zoom/${level}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (response.status === 550) {
        streamDeck.logger.warn('Zoom requires DroidCam Pro');
        return false;
      }
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to set zoom: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`Zoom set to ${level}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error setting zoom:', error);
      return false;
    }
  }

  /**
   * Switch camera (front/back)
   * @param cameraIndex 0 for back camera, 1 for front camera
   */
  async switchCamera(cameraIndex: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/active/${cameraIndex}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to switch camera: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`Switched to camera ${cameraIndex}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error switching camera:', error);
      return false;
    }
  }

  /**
   * Toggle LED/Flash light
   */
  async toggleLED(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/torch_toggle`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to toggle LED: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('LED toggled');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error toggling LED:', error);
      return false;
    }
  }

  /**
   * Toggle microphone mute/unmute
   */
  async toggleMic(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/mic_toggle`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to toggle mic: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('Microphone toggled');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error toggling mic:', error);
      return false;
    }
  }

  /**
   * Check if DroidCam is stopped
   * 停止中は/v1/camera/infoが失敗するはず
   */
  async isStopped(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/info`, {
        signal: AbortSignal.timeout(1000) // 短いタイムアウト
      });
      
      // 正常にレスポンスが返ってきたら動作中
      return !response.ok;
    } catch (error) {
      // エラーが発生したら停止中の可能性が高い
      return true;
    }
  }

  /**
   * Stop DroidCam
   */
  async stopDroidCam(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/stop`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to stop DroidCam: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('DroidCam stopped');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error stopping DroidCam:', error);
      return false;
    }
  }

  /**
   * Restart DroidCam
   */
  async restartDroidCam(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/restart`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to restart DroidCam: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('DroidCam restarted');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error restarting DroidCam:', error);
      return false;
    }
  }

  /**
   * Set exposure value
   * @param level -24 ~ 24 (direct value from camera info)
   */
  async setExposure(level: number): Promise<boolean> {
    try {
      // levelはgetCameraInfoと同じスケールの値（-24~24）をそのまま使用
      const response = await fetch(`${this.baseUrl}/v3/camera/ev/${level}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (response.status === 550) {
        streamDeck.logger.warn('Exposure control requires DroidCam Pro');
        return false;
      }
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to set exposure: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`Exposure set to ${level}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error setting exposure:', error);
      return false;
    }
  }

  /**
   * Execute autofocus
   */
  async autofocus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/autofocus`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to execute autofocus: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('Autofocus executed');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error executing autofocus:', error);
      return false;
    }
  }

  /**
   * Set focus mode (0=normal, 1=macro, 2=continuous, 3=infinity) 
   */
  async setFocusMode(mode: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/autofocus_mode/${mode}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to set focus mode: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`Focus mode set to ${mode}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error setting focus mode:', error);
      return false;
    }
  }

  /**
   * Alias for setFocusMode
   */
  async setAutofocusMode(mode: number): Promise<boolean> {
    return this.setFocusMode(mode);
  }

  /**
   * Set white balance value (manual mode)
   */
  async setWhiteBalance(value: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/camera/wb_level/${value}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to set white balance: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`White balance set to ${value}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error setting white balance:', error);
      return false;
    }
  }

  /**
   * Set white balance mode (alias for setWBMode)
   */
  async setWhiteBalanceMode(mode: number): Promise<boolean> {
    return this.setWBMode(mode);
  }

  /**
   * Toggle white balance lock (alias for toggleWBLock)
   */
  async toggleWhiteBalanceLock(): Promise<boolean> {
    return this.toggleWBLock();
  }

  /**
   * Set white balance mode
   */
  async setWBMode(mode: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/wb_mode/${mode}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to set WB mode: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info(`WB mode set to ${mode}`);
      return true;
    } catch (error) {
      streamDeck.logger.error('Error setting WB mode:', error);
      return false;
    }
  }

  /**
   * Toggle exposure lock
   */
  async toggleExposureLock(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/el_toggle`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to toggle exposure lock: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('Exposure lock toggled');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error toggling exposure lock:', error);
      return false;
    }
  }

  /**
   * Toggle white balance lock
   */
  async toggleWBLock(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/camera/wbl_toggle`, {
        method: 'PUT',
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to toggle WB lock: ${response.status}`);
        return false;
      }
      
      streamDeck.logger.info('WB lock toggled');
      return true;
    } catch (error) {
      streamDeck.logger.error('Error toggling WB lock:', error);
      return false;
    }
  }

  /**
   * Get battery information
   */
  async getBatteryInfo(): Promise<DroidCamBatteryInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/phone/battery_info`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        streamDeck.logger.error(`Failed to get battery info: ${response.status}`);
        return null;
      }
      
      const info = await response.json() as DroidCamBatteryInfo;
      streamDeck.logger.info('Battery info:', info);
      return info;
    } catch (error) {
      streamDeck.logger.error('Error getting battery info:', error);
      return null;
    }
  }
}