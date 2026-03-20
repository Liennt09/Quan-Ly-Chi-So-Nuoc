import { Timestamp } from 'firebase/firestore';

export type WaterType = 'Khai thác' | 'Tiêu thụ';

export interface Area {
  id: string;
  name: string;
}

export interface SubLocation {
  id: string;
  name: string;
  areaId: string;
}

export interface Meter {
  id: string;
  name: string;
  subLocationId: string;
  waterType: WaterType;
  isSubMeter: boolean;
  isRelayMeter: boolean;
}

export interface Reporter {
  id: string;
  name: string;
}

export interface Reading {
  id: string;
  areaId: string;
  subLocationId: string;
  meterId: string;
  waterType: WaterType;
  meterReading: number;
  recordDate: string; // ISO string YYYY-MM-DD
  createdAt: Timestamp;
  enteredBy: string; // User email
  reporter: string; // Reporter name
  note: string;
  usage: number;
  usageDate: string; // ISO string YYYY-MM-DD, usually recordDate - 1 day
}
