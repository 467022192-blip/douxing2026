// 百度地图类型声明 - 共享类型定义

export interface BMapNamespace {
  Map: new (container: HTMLElement) => BMapMap;
  Point: new (lng: number, lat: number) => BMapPoint;
  Marker: new (point: BMapPoint, options?: { title?: string; icon?: BMapIcon }) => BMapMarker;
  Label: new (content: string, options?: { position?: BMapPoint; offset?: BMapSize }) => BMapLabel;
  Size: new (width: number, height: number) => BMapSize;
  Icon: new (url: string, size: BMapSize, options?: { anchor?: BMapSize; imageOffset?: BMapSize; infoWindowAnchor?: BMapSize; printImageUrl?: string }) => BMapIcon;
  Polyline: new (points: BMapPoint[], options?: BMapPolylineOptions) => BMapPolyline;
  NavigationControl: new (options?: { anchor?: number; type?: number; offset?: BMapSize }) => any;
  DrivingRoute: new (location: any, options?: any) => BMapDrivingRoute;
}

export interface BMapDrivingRoute {
  search: (start: any, end: any) => void;
  getStatus: () => number;
}

interface Window {
  BMap: typeof BMap;
  initMap: () => void;
  BMAP_ANCHOR_TOP_LEFT: number;
  BMAP_ANCHOR_TOP_RIGHT: number;
  BMAP_ANCHOR_BOTTOM_LEFT: number;
  BMAP_ANCHOR_BOTTOM_RIGHT: number;
  BMAP_NAVIGATION_CONTROL_LARGE: number;
  BMAP_NAVIGATION_CONTROL_SMALL: number;
  BMAP_NAVIGATION_CONTROL_PAN: number;
  BMAP_NAVIGATION_CONTROL_ZOOM: number;
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
  addEventListener: (event: string, handler: Function) => void;
  removeEventListener: (event: string, handler: Function) => void;
  getZoom: () => number;
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
  addEventListener: (event: string, handler: Function) => void;
}

export interface BMapSize {
  width: number;
  height: number;
}

export interface BMapIcon {}
export interface BMapNavigationControl {}

export interface BMapPolylineOptions {
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
}

export interface BMapPolyline {}

declare global {
  interface Window {
    BMap: BMapNamespace;
    initMap?: () => void;
    initRouteMap?: () => void;
  }
}

export {};
