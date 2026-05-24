// 百度地图类型声明 - 共享类型定义

export interface BMapNamespace {
  Map: new (container: HTMLElement) => BMapMap;
  Point: new (lng: number, lat: number) => BMapPoint;
  Marker: new (point: BMapPoint, options?: { title?: string; icon?: BMapIcon }) => BMapMarker;
  Label: new (content: string, options?: { position?: BMapPoint; offset?: BMapSize }) => BMapLabel;
  Size: new (width: number, height: number) => BMapSize;
  Icon: new (url: string, size: BMapSize, options?: { anchor?: BMapSize; imageOffset?: BMapSize; infoWindowAnchor?: BMapSize; printImageUrl?: string }) => BMapIcon;
  Polyline: new (points: BMapPoint[], options?: BMapPolylineOptions) => BMapPolyline;
  NavigationControl: new (options?: { anchor?: number; type?: number; offset?: BMapSize }) => BMapNavigationControl;
  DrivingRoute: new (location: unknown, options?: unknown) => BMapDrivingRoute;
}

export interface BMapDrivingRoute {
  search: (start: unknown, end: unknown) => void;
  getStatus: () => number;
}

export interface BMapMap {
    centerAndZoom: (point: BMapPoint | string, zoom: number) => void;
    enableScrollWheelZoom: (enable?: boolean) => void;
    enableDragging: () => void;
    enablePinchToZoom: () => void;
    enableDoubleClickZoom: () => void;
    enableKeyboard: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    addControl: (control: BMapNavigationControl) => void;
  addOverlay: (overlay: BMapMarker | BMapLabel | BMapPolyline) => void;
  removeOverlay: (overlay: BMapMarker | BMapLabel | BMapPolyline) => void;
  clearOverlays: () => void;
  getViewport: (points: BMapPoint[], viewportOptions?: BMapViewportOptions) => { center: BMapPoint; zoom: number };
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
  removeEventListener: (event: string, handler: (e: unknown) => void) => void;
  getZoom: () => number;
  setMapStyleV2?: (options: { styleJson: unknown }) => void;
}

export interface BMapViewportOptions {
  enableAnimation?: boolean;
  margins?: number[];
  zoomFactor?: number;
  delay?: number;
}

export interface BMapPoint {
  lng: number;
  lat: number;
}

export interface BMapMarker {
  setLabel: (label: BMapLabel) => void;
  getLabel: () => BMapLabel;
  addEventListener: (event: string, handler: () => void) => void;
}

export interface BMapLabel {
  setStyle: (style: Record<string, string>) => void;
  setContent: (content: string) => void;
  setOffset: (offset: BMapSize) => void;
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
}

export interface BMapSize {
  width: number;
  height: number;
}

export type BMapIcon = object;
export type BMapNavigationControl = object;

export interface BMapPolylineOptions {
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
}

export type BMapPolyline = object;

declare global {
  interface Window {
    BMap: BMapNamespace;
    initMap?: () => void;
    initRouteMap?: () => void;
  }
}

export {};
