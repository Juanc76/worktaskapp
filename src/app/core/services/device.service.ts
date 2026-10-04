import { Injectable } from '@angular/core';
import { Device } from '@capacitor/device';


@Injectable({ providedIn: 'root' })

export class DeviceService {

    private deviceData: { 
        deviceId: string; 
        plataforma: string; 
        modelo: string } | null = null;


async getDeviceData() {
if (!this.deviceData) {
const idInfo = await Device.getId();
const info = await Device.getInfo();
this.deviceData = {
deviceId: idInfo.identifier || 'unknown-device',
plataforma: info.platform || 'unknown',
modelo: info.model || 'unknown'
};
}
return this.deviceData;
}
}