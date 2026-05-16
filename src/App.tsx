import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { Armchair, BookOpen, BoxSelect, ChevronDown, ChevronRight, Download, Monitor, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

type FurnitureKind = "rect" | "circle" | "ellipse";

type FurnitureTemplate = {
  label: string;
  kind: FurnitureKind;
  widthCm: number;
  depthCm: number;
  fill: string;
  stroke: string;
};

type FurnitureItem = FurnitureTemplate & {
  id: string;
  xCm: number;
  yCm: number;
  rotation: number;
};

type Room = {
  name: string;
  shapeMode: "rectangle" | "fourSides";
  widthCm: number;
  depthCm: number;
  topCm: number;
  rightCm: number;
  bottomCm: number;
  leftCm: number;
};

type RoomLayout = {
  id: string;
  room: Room;
  items: FurnitureItem[];
};

type StoredLayout = {
  activeRoomId?: string;
  rooms?: RoomLayout[];
  room?: Room;
  items?: FurnitureItem[];
};

type StoredProject = {
  activeRoomId: string;
  rooms: RoomLayout[];
};

type BoundsCm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
};

type GapMetrics = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  bounds: BoundsCm;
};

type FurnitureGap = {
  id: string;
  label: string;
  horizontalLabel: string;
  horizontalValue: number;
  verticalLabel: string;
  verticalValue: number;
  distanceScore: number;
};

type RoomCanvasLayout = {
  layoutId: string;
  room: Room;
  items: FurnitureItem[];
  scale: number;
  floorX: number;
  floorY: number;
  floorWidth: number;
  floorHeight: number;
  roomWidth: number;
  roomDepth: number;
  floorPoints: number[];
};

const STORAGE_KEY = "room-design-layout-v1";
const MIN_TRANSFORM_SIZE_PX = 1;

const defaultRoom: Room = {
  name: "6畳ワークルーム",
  shapeMode: "rectangle",
  widthCm: 360,
  depthCm: 270,
  topCm: 360,
  rightCm: 270,
  bottomCm: 360,
  leftCm: 270,
};

const templates: FurnitureTemplate[] = [
  { label: "本棚", kind: "rect", widthCm: 90, depthCm: 45, fill: "#f0d3a1", stroke: "#8a5a2b" },
  { label: "つくえ", kind: "rect", widthCm: 120, depthCm: 60, fill: "#b9d6cb", stroke: "#337563" },
  { label: "折りたたみ机", kind: "rect", widthCm: 80, depthCm: 40, fill: "#d7d1ef", stroke: "#6b5aa9" },
  { label: "テレビ台", kind: "rect", widthCm: 150, depthCm: 40, fill: "#c9ccd1", stroke: "#505762" },
  { label: "クッション", kind: "circle", widthCm: 60, depthCm: 60, fill: "#f3a7aa", stroke: "#a9474c" },
  { label: "Yogibo", kind: "ellipse", widthCm: 120, depthCm: 75, fill: "#86b6ee", stroke: "#285d9c" },
];

const customPalette = [
  { fill: "#f0d3a1", stroke: "#8a5a2b" },
  { fill: "#b9d6cb", stroke: "#337563" },
  { fill: "#d7d1ef", stroke: "#6b5aa9" },
  { fill: "#c9ccd1", stroke: "#505762" },
  { fill: "#f3a7aa", stroke: "#a9474c" },
  { fill: "#86b6ee", stroke: "#285d9c" },
  { fill: "#f2df73", stroke: "#8a741f" },
  { fill: "#f4b37f", stroke: "#9b4f20" },
];

function createRoomLayout(room: Room, items: FurnitureItem[] = []): RoomLayout {
  return {
    id: crypto.randomUUID(),
    room,
    items,
  };
}

function normalizeRoom(room?: Partial<Room>): Room {
  return {
    name: room?.name || defaultRoom.name,
    shapeMode: room?.shapeMode === "fourSides" ? "fourSides" : "rectangle",
    widthCm: toFiniteNumber(room?.widthCm, defaultRoom.widthCm),
    depthCm: toFiniteNumber(room?.depthCm, defaultRoom.depthCm),
    topCm: toFiniteNumber(room?.topCm, toFiniteNumber(room?.widthCm, defaultRoom.topCm)),
    rightCm: toFiniteNumber(room?.rightCm, toFiniteNumber(room?.depthCm, defaultRoom.rightCm)),
    bottomCm: toFiniteNumber(room?.bottomCm, toFiniteNumber(room?.widthCm, defaultRoom.bottomCm)),
    leftCm: toFiniteNumber(room?.leftCm, toFiniteNumber(room?.depthCm, defaultRoom.leftCm)),
  };
}

function normalizeItems(items?: FurnitureItem[]) {
  return Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        widthCm: toFiniteNumber(item.widthCm, 0),
        depthCm: toFiniteNumber(item.depthCm, 0),
        xCm: toFiniteNumber(item.xCm, 0),
        yCm: toFiniteNumber(item.yCm, 0),
        rotation: toFiniteNumber(item.rotation, 0),
      }))
    : [];
}

function loadLayout(): StoredProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const firstRoom = createRoomLayout(defaultRoom);
      return { activeRoomId: firstRoom.id, rooms: [firstRoom] };
    }

    const parsed = JSON.parse(raw) as StoredLayout;
    const rooms =
      Array.isArray(parsed.rooms) && parsed.rooms.length > 0
        ? parsed.rooms.map((layout) => ({
            id: layout.id || crypto.randomUUID(),
            room: normalizeRoom(layout.room),
            items: normalizeItems(layout.items),
          }))
        : [createRoomLayout(normalizeRoom(parsed.room), normalizeItems(parsed.items))];
    const activeRoomId = rooms.some((layout) => layout.id === parsed.activeRoomId) ? parsed.activeRoomId! : rooms[0].id;

    return { activeRoomId, rooms };
  } catch {
    const firstRoom = createRoomLayout(defaultRoom);
    return { activeRoomId: firstRoom.id, rooms: [firstRoom] };
  }
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return numberValue;
}

function roundDecimal(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function formatCm(value: number) {
  return `${roundDecimal(value, 1)}cm`;
}

function getRoomPlanSize(room: Room) {
  const widthCm = toFiniteNumber(room.widthCm, 0);
  const depthCm = toFiniteNumber(room.depthCm, 0);
  const topCm = toFiniteNumber(room.topCm, 0);
  const rightCm = toFiniteNumber(room.rightCm, 0);
  const bottomCm = toFiniteNumber(room.bottomCm, 0);
  const leftCm = toFiniteNumber(room.leftCm, 0);
  const isFourSideMode = room.shapeMode === "fourSides";
  const planWidth = isFourSideMode ? Math.max(topCm, bottomCm) : widthCm;
  const planDepth = isFourSideMode ? (leftCm + rightCm) / 2 : depthCm;

  return {
    widthCm,
    depthCm,
    topCm,
    rightCm,
    bottomCm,
    leftCm,
    isFourSideMode,
    planWidth,
    planDepth,
    drawableWidth: Math.max(planWidth, 1),
    drawableDepth: Math.max(planDepth, 1),
  };
}

function getFloorPoints(room: Room, canvas: Pick<RoomCanvasLayout, "floorX" | "floorY" | "floorWidth" | "floorHeight" | "scale">) {
  const size = getRoomPlanSize(room);
  if (!size.isFourSideMode) {
    return [
      canvas.floorX,
      canvas.floorY,
      canvas.floorX + canvas.floorWidth,
      canvas.floorY,
      canvas.floorX + canvas.floorWidth,
      canvas.floorY + canvas.floorHeight,
      canvas.floorX,
      canvas.floorY + canvas.floorHeight,
    ];
  }

  const topWidth = Math.max(size.topCm, 0) * canvas.scale;
  const bottomWidth = Math.max(size.bottomCm, 0) * canvas.scale;
  const topX = canvas.floorX + (canvas.floorWidth - topWidth) / 2;
  const bottomX = canvas.floorX + (canvas.floorWidth - bottomWidth) / 2;

  return [
    topX,
    canvas.floorY,
    topX + topWidth,
    canvas.floorY,
    bottomX + bottomWidth,
    canvas.floorY + canvas.floorHeight,
    bottomX,
    canvas.floorY + canvas.floorHeight,
  ];
}

function getFurnitureBounds(item: FurnitureItem): BoundsCm {
  const width = Math.max(0, item.widthCm);
  const height = Math.max(0, item.depthCm);
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((corner) => ({
    x: item.xCm + corner.x * cos - corner.y * sin,
    y: item.yCm + corner.x * sin + corner.y * cos,
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function getGapMetrics(item: FurnitureItem, roomWidth: number, roomDepth: number): GapMetrics {
  const bounds = getFurnitureBounds(item);

  return {
    left: roundDecimal(bounds.minX, 1),
    right: roundDecimal(roomWidth - bounds.maxX, 1),
    top: roundDecimal(bounds.minY, 1),
    bottom: roundDecimal(roomDepth - bounds.maxY, 1),
    bounds,
  };
}

function getFurnitureGap(base: FurnitureItem, target: FurnitureItem): FurnitureGap {
  const baseBounds = getFurnitureBounds(base);
  const targetBounds = getFurnitureBounds(target);
  let horizontalLabel = "左右重なり";
  let horizontalValue = 0;
  let verticalLabel = "上下重なり";
  let verticalValue = 0;

  if (targetBounds.minX >= baseBounds.maxX) {
    horizontalLabel = "右";
    horizontalValue = targetBounds.minX - baseBounds.maxX;
  } else if (targetBounds.maxX <= baseBounds.minX) {
    horizontalLabel = "左";
    horizontalValue = baseBounds.minX - targetBounds.maxX;
  }

  if (targetBounds.minY >= baseBounds.maxY) {
    verticalLabel = "下";
    verticalValue = targetBounds.minY - baseBounds.maxY;
  } else if (targetBounds.maxY <= baseBounds.minY) {
    verticalLabel = "上";
    verticalValue = baseBounds.minY - targetBounds.maxY;
  }

  return {
    id: target.id,
    label: target.label,
    horizontalLabel,
    horizontalValue: roundDecimal(horizontalValue, 1),
    verticalLabel,
    verticalValue: roundDecimal(verticalValue, 1),
    distanceScore: Math.hypot(Math.max(0, horizontalValue), Math.max(0, verticalValue)),
  };
}

function fitFurnitureInsideRoom(item: FurnitureItem, roomWidth: number, roomDepth: number): FurnitureItem {
  const safeRoomWidth = Math.max(1, roomWidth);
  const safeRoomDepth = Math.max(1, roomDepth);
  let nextItem = {
    ...item,
    widthCm: Math.max(0, item.widthCm),
    depthCm: Math.max(0, item.depthCm),
  };

  const bounds = getFurnitureBounds(nextItem);
  const boundsWidth = Math.max(0, bounds.maxX - bounds.minX);
  const boundsDepth = Math.max(0, bounds.maxY - bounds.minY);
  const scaleToFit = Math.min(
    boundsWidth > safeRoomWidth ? safeRoomWidth / boundsWidth : 1,
    boundsDepth > safeRoomDepth ? safeRoomDepth / boundsDepth : 1,
  );

  if (scaleToFit < 1) {
    const nextWidth = roundDecimal(nextItem.widthCm * scaleToFit, 1);
    const nextDepth = roundDecimal(nextItem.depthCm * scaleToFit, 1);
    nextItem = {
      ...nextItem,
      widthCm: nextWidth,
      depthCm: nextItem.kind === "circle" ? nextWidth : nextDepth,
    };
  }

  const fittedBounds = getFurnitureBounds(nextItem);
  const fittedWidth = fittedBounds.maxX - fittedBounds.minX;
  const fittedDepth = fittedBounds.maxY - fittedBounds.minY;
  let dx = 0;
  let dy = 0;

  if (fittedWidth > safeRoomWidth) {
    dx = (safeRoomWidth - fittedWidth) / 2 - fittedBounds.minX;
  } else if (fittedBounds.minX < 0) {
    dx = -fittedBounds.minX;
  } else if (fittedBounds.maxX > safeRoomWidth) {
    dx = safeRoomWidth - fittedBounds.maxX;
  }

  if (fittedDepth > safeRoomDepth) {
    dy = (safeRoomDepth - fittedDepth) / 2 - fittedBounds.minY;
  } else if (fittedBounds.minY < 0) {
    dy = -fittedBounds.minY;
  } else if (fittedBounds.maxY > safeRoomDepth) {
    dy = safeRoomDepth - fittedBounds.maxY;
  }

  return {
    ...nextItem,
    xCm: roundDecimal(nextItem.xCm + dx, 1),
    yCm: roundDecimal(nextItem.yCm + dy, 1),
  };
}

function App() {
  const initialLayout = useMemo(loadLayout, []);
  const [rooms, setRooms] = useState<RoomLayout[]>(initialLayout.rooms);
  const [activeRoomId, setActiveRoomId] = useState(initialLayout.activeRoomId);
  const [visibleRoomIds, setVisibleRoomIds] = useState<string[]>(initialLayout.rooms.map((layout) => layout.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isRoomListOpen, setIsRoomListOpen] = useState(true);
  const [keepFurnitureInside, setKeepFurnitureInside] = useState(true);
  const [openSections, setOpenSections] = useState({
    roomSettings: true,
    presets: true,
    customFurniture: false,
    selectedItem: true,
    roadmap: false,
  });
  const [customTemplate, setCustomTemplate] = useState<FurnitureTemplate>({
    label: "照明器具",
    kind: "rect",
    widthCm: 40,
    depthCm: 40,
    fill: customPalette[6].fill,
    stroke: customPalette[6].stroke,
  });

  const stageWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const itemRefs = useRef<Record<string, Konva.Group | null>>({});
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 640 });
  const activeLayout = rooms.find((layout) => layout.id === activeRoomId) ?? rooms[0] ?? createRoomLayout(defaultRoom);
  const room = activeLayout.room;
  const items = activeLayout.items;

  useEffect(() => {
    setVisibleRoomIds((currentIds) => {
      const validIds = currentIds.filter((id) => rooms.some((layout) => layout.id === id));
      return validIds.length > 0 ? validIds : [activeRoomId];
    });
  }, [activeRoomId, rooms]);

  const setRoom = (next: Room | ((current: Room) => Room)) => {
    setRooms((currentRooms) =>
      currentRooms.map((layout) =>
        layout.id === activeRoomId
          ? {
              ...layout,
              room: typeof next === "function" ? (next as (current: Room) => Room)(layout.room) : next,
            }
          : layout,
      ),
    );
  };

  const setItems = (next: FurnitureItem[] | ((current: FurnitureItem[]) => FurnitureItem[])) => {
    setRooms((currentRooms) =>
      currentRooms.map((layout) =>
        layout.id === activeRoomId
          ? {
              ...layout,
              items: typeof next === "function" ? (next as (current: FurnitureItem[]) => FurnitureItem[])(layout.items) : next,
            }
          : layout,
      ),
    );
  };

  useEffect(() => {
    const updateSize = () => {
      if (!stageWrapRef.current) {
        return;
      }

      const rect = stageWrapRef.current.getBoundingClientRect();
      setStageSize({
        width: Math.max(360, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(rect.height)),
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeRoomId, rooms }));
  }, [activeRoomId, rooms]);

  useEffect(() => {
    const selectedNode = selectedId ? itemRefs.current[selectedId] : null;
    if (selectedNode && transformerRef.current) {
      transformerRef.current.nodes([selectedNode]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current?.nodes([]);
    }
  }, [selectedId, items]);

  const activeRoomSize = getRoomPlanSize(room);
  const roomWidth = activeRoomSize.widthCm;
  const roomDepth = activeRoomSize.depthCm;
  const topCm = activeRoomSize.topCm;
  const rightCm = activeRoomSize.rightCm;
  const bottomCm = activeRoomSize.bottomCm;
  const leftCm = activeRoomSize.leftCm;
  const isFourSideMode = activeRoomSize.isFourSideMode;
  const drawableRoomWidth = activeRoomSize.drawableWidth;
  const drawableRoomDepth = activeRoomSize.drawableDepth;

  useEffect(() => {
    if (!keepFurnitureInside) {
      return;
    }

    setItems((current) => {
      const nextItems = current.map((item) => fitFurnitureInsideRoom(item, drawableRoomWidth, drawableRoomDepth));
      const hasChanged = nextItems.some(
        (item, index) =>
          item.xCm !== current[index].xCm ||
          item.yCm !== current[index].yCm ||
          item.widthCm !== current[index].widthCm ||
          item.depthCm !== current[index].depthCm,
      );

      return hasChanged ? nextItems : current;
    });
  }, [activeRoomId, drawableRoomDepth, drawableRoomWidth, keepFurnitureInside]);

  const canvasRooms = useMemo<RoomCanvasLayout[]>(() => {
    const visibleRooms = rooms.filter((layout) => visibleRoomIds.includes(layout.id));
    const shownRooms = visibleRooms.length > 0 ? visibleRooms : [activeLayout];
    const padding = stageSize.width < 620 ? 22 : 44;
    const roomGap = stageSize.width < 760 ? 24 : 48;
    const sizes = shownRooms.map((layout) => getRoomPlanSize(layout.room));
    const totalWidth = sizes.reduce((sum, size) => sum + size.drawableWidth, 0);
    const maxDepth = Math.max(...sizes.map((size) => size.drawableDepth), 1);
    const availableWidth = stageSize.width - padding * 2 - roomGap * Math.max(0, shownRooms.length - 1);
    const availableHeight = stageSize.height - padding * 2;
    const scale = Math.min(1.5, availableWidth / Math.max(totalWidth, 1), availableHeight / maxDepth);
    const totalFloorWidth = totalWidth * scale + roomGap * Math.max(0, shownRooms.length - 1);
    let cursorX = Math.max(padding, (stageSize.width - totalFloorWidth) / 2);

    return shownRooms.map((roomLayout, index) => {
      const size = sizes[index];
      const floorWidth = size.drawableWidth * scale;
      const floorHeight = size.drawableDepth * scale;
      const floorY = Math.max(padding, (stageSize.height - floorHeight) / 2);
      const canvas = {
        layoutId: roomLayout.id,
        room: roomLayout.room,
        items: roomLayout.items,
        scale,
        floorX: cursorX,
        floorY,
        floorWidth,
        floorHeight,
        roomWidth: size.drawableWidth,
        roomDepth: size.drawableDepth,
        floorPoints: [] as number[],
      };
      canvas.floorPoints = getFloorPoints(roomLayout.room, canvas);
      cursorX += floorWidth + roomGap;
      return canvas;
    });
  }, [activeLayout, rooms, stageSize, visibleRoomIds]);

  const layout =
    canvasRooms.find((canvas) => canvas.layoutId === activeRoomId) ??
    canvasRooms[0] ??
    ({
      layoutId: activeRoomId,
      room,
      items,
      scale: 1,
      floorX: 0,
      floorY: 0,
      floorWidth: drawableRoomWidth,
      floorHeight: drawableRoomDepth,
      roomWidth: drawableRoomWidth,
      roomDepth: drawableRoomDepth,
      floorPoints: [],
    } satisfies RoomCanvasLayout);

  const selectedItem = items.find((item) => item.id === selectedId);
  const selectedGaps = selectedItem ? getGapMetrics(selectedItem, drawableRoomWidth, drawableRoomDepth) : null;
  const selectedFurnitureGaps = selectedItem
    ? items
        .filter((item) => item.id !== selectedItem.id)
        .map((item) => getFurnitureGap(selectedItem, item))
        .sort((a, b) => a.distanceScore - b.distanceScore)
    : [];
  const roomWarnings = [
    !isFourSideMode && roomWidth <= 0
      ? "部屋の幅が0cm以下です。入力は保存されますが、Canvasは最小幅で仮表示します。"
      : null,
    !isFourSideMode && roomDepth <= 0
      ? "部屋の奥行きが0cm以下です。入力は保存されますが、Canvasは最小奥行きで仮表示します。"
      : null,
    isFourSideMode && topCm <= 0 ? "上辺が0cm以下です。入力は保存されますが、Canvasは最小幅で仮表示します。" : null,
    isFourSideMode && bottomCm <= 0 ? "下辺が0cm以下です。入力は保存されますが、Canvasは最小幅で仮表示します。" : null,
    isFourSideMode && leftCm <= 0 ? "左辺が0cm以下です。入力は保存されますが、平均奥行きで仮表示します。" : null,
    isFourSideMode && rightCm <= 0 ? "右辺が0cm以下です。入力は保存されますが、平均奥行きで仮表示します。" : null,
    isFourSideMode && Math.abs(leftCm - rightCm) > 1
      ? "左辺と右辺の長さが異なるため、Canvasは平均奥行きの近似台形として表示します。"
      : null,
  ].filter(Boolean);
  const selectedWarnings = selectedItem
    ? [
        selectedItem.widthCm <= 0 ? "家具の幅が0cm以下です。入力は保存されますが、Canvas上では見えなくなる場合があります。" : null,
        selectedItem.depthCm <= 0
          ? "家具の奥行きが0cm以下です。入力は保存されますが、Canvas上では見えなくなる場合があります。"
          : null,
        selectedGaps && [selectedGaps.left, selectedGaps.right, selectedGaps.top, selectedGaps.bottom].some((gap) => gap < 0)
          ? "家具が部屋枠からはみ出したため、次の移動・編集時に部屋内へ自動補正します。"
          : null,
      ].filter(Boolean)
    : [];
  const roomSummary = isFourSideMode
    ? `上 ${formatCm(topCm)} / 右 ${formatCm(rightCm)} / 下 ${formatCm(bottomCm)} / 左 ${formatCm(leftCm)}`
    : `${formatCm(roomWidth)} x ${formatCm(roomDepth)}`;

  const addFurniture = (template: FurnitureTemplate) => {
    const offset = items.length * 12;
    const nextItem = {
      ...template,
      id: `${template.label}-${crypto.randomUUID()}`,
      xCm: Math.max(0, roundDecimal(drawableRoomWidth / 2 - template.widthCm / 2 + offset, 1)),
      yCm: Math.max(0, roundDecimal(drawableRoomDepth / 2 - template.depthCm / 2 + offset, 1)),
      rotation: 0,
    };
    const item = keepFurnitureInside ? fitFurnitureInsideRoom(nextItem, drawableRoomWidth, drawableRoomDepth) : nextItem;

    setItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const addCustomFurniture = () => {
    addFurniture({
      ...customTemplate,
      label: customTemplate.label.trim() || "名称未設定",
      depthCm: customTemplate.kind === "circle" ? customTemplate.widthCm : customTemplate.depthCm,
    });
  };

  const updateItem = (id: string, patch: Partial<FurnitureItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? keepFurnitureInside
            ? fitFurnitureInsideRoom({ ...item, ...patch }, drawableRoomWidth, drawableRoomDepth)
            : { ...item, ...patch }
          : item,
      ),
    );
  };

  const handleFurnitureDragEnd = (sourceRoomId: string, item: FurnitureItem, xPx: number, yPx: number) => {
    const targetCanvas =
      canvasRooms.find(
        (canvas) =>
          xPx >= canvas.floorX &&
          xPx <= canvas.floorX + canvas.floorWidth &&
          yPx >= canvas.floorY &&
          yPx <= canvas.floorY + canvas.floorHeight,
      ) ?? canvasRooms.find((canvas) => canvas.layoutId === sourceRoomId);

    if (!targetCanvas) {
      return;
    }

    const nextItem = {
      ...item,
      xCm: roundDecimal((xPx - targetCanvas.floorX) / targetCanvas.scale, 1),
      yCm: roundDecimal((yPx - targetCanvas.floorY) / targetCanvas.scale, 1),
    };
    const normalizedItem = keepFurnitureInside
      ? fitFurnitureInsideRoom(nextItem, targetCanvas.roomWidth, targetCanvas.roomDepth)
      : nextItem;

    if (targetCanvas.layoutId === sourceRoomId) {
      setRooms((currentRooms) =>
        currentRooms.map((layout) =>
          layout.id === sourceRoomId
            ? {
                ...layout,
                items: layout.items.map((currentItem) => (currentItem.id === item.id ? normalizedItem : currentItem)),
              }
            : layout,
        ),
      );
      return;
    }

    setRooms((currentRooms) =>
      currentRooms.map((layout) => {
        if (layout.id === sourceRoomId) {
          return { ...layout, items: layout.items.filter((currentItem) => currentItem.id !== item.id) };
        }

        if (layout.id === targetCanvas.layoutId) {
          return { ...layout, items: layout.items.concat(normalizedItem) };
        }

        return layout;
      }),
    );
    setActiveRoomId(targetCanvas.layoutId);
    setSelectedId(item.id);
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }

    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const resetActiveRoom = () => {
    setRoom(defaultRoom);
    setItems([]);
    setSelectedId(null);
    setIsResetDialogOpen(false);
  };

  const saveCopyAndResetActiveRoom = () => {
    const copyRoom = {
      ...room,
      name: `${room.name || "無題の部屋"} 保存コピー`,
    };
    const copiedLayout: RoomLayout = {
      id: crypto.randomUUID(),
      room: copyRoom,
      items: items.map((item) => ({ ...item, id: `${item.label}-${crypto.randomUUID()}` })),
    };

    setRooms((currentRooms) =>
      currentRooms
        .map((layout) => (layout.id === activeRoomId ? { ...layout, room: defaultRoom, items: [] } : layout))
        .concat(copiedLayout),
    );
    setSelectedId(null);
    setIsResetDialogOpen(false);
  };

  const addRoom = () => {
    const nextRoom = createRoomLayout({
      ...defaultRoom,
      name: `部屋 ${rooms.length + 1}`,
    });
    setRooms((currentRooms) => currentRooms.concat(nextRoom));
    setActiveRoomId(nextRoom.id);
    setVisibleRoomIds((currentIds) => currentIds.concat(nextRoom.id));
    setSelectedId(null);
  };

  const switchRoom = (id: string) => {
    setActiveRoomId(id);
    setVisibleRoomIds((currentIds) => (currentIds.includes(id) ? currentIds : currentIds.concat(id)));
    setSelectedId(null);
  };

  const exportCanvasImage = () => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    const link = document.createElement("a");
    const fileName = `${(room.name || "room-layout").replace(/[\\/:*?"<>|]/g, "_")}.png`;
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  };

  const moveRoom = (id: string, direction: -1 | 1) => {
    setRooms((currentRooms) => {
      const fromIndex = currentRooms.findIndex((layout) => layout.id === id);
      const toIndex = fromIndex + direction;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= currentRooms.length) {
        return currentRooms;
      }

      const nextRooms = [...currentRooms];
      const [movedRoom] = nextRooms.splice(fromIndex, 1);
      nextRooms.splice(toIndex, 0, movedRoom);
      return nextRooms;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const tagName = (event.target as HTMLElement | null)?.tagName;
        if (tagName !== "INPUT") {
          deleteSelected();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  return (
    <main className="min-h-screen bg-[#eef0e9] text-slate-800">
      <div className="grid min-h-screen grid-rows-[auto_1fr]">
        <header className="border-b border-stone-300 bg-[#f8f6ef]/95 px-5 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-normal text-slate-900 sm:text-4xl">
                  部屋レイアウト <span className="text-[#c35f39]">[Beta]</span>
                </h1>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">
                実寸比率の2Dキャンバスで家具の置き心地を検証
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportCanvasImage}
                className="inline-flex h-10 items-center gap-2 rounded border border-[#337563] bg-white px-3 text-sm font-black text-[#337563] shadow-sm transition hover:bg-[#337563] hover:text-white"
              >
                <Download size={16} />
                画像保存
              </button>
              <div className="flex h-10 items-center gap-2 rounded border border-stone-300 bg-white px-3 text-sm text-slate-600 shadow-sm">
                <Save size={16} />
                LocalStorage自動保存
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1440px] gap-5 p-4 lg:grid-cols-[330px_1fr] lg:p-5">
          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-stone-300 bg-[#fbfaf6] p-4 shadow-blueprint">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsRoomListOpen((current) => !current)}
                  className="inline-flex items-center gap-2 text-left text-base font-black text-slate-900"
                  aria-expanded={isRoomListOpen}
                >
                  {isRoomListOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  部屋一覧
                  <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-slate-500">{rooms.length}</span>
                </button>
                <button
                  type="button"
                  onClick={addRoom}
                  className="inline-flex h-9 items-center gap-2 rounded border border-[#337563] bg-white px-3 text-sm font-black text-[#337563] transition hover:bg-[#337563] hover:text-white"
                >
                  <Plus size={16} />
                  追加
                </button>
              </div>
              {isRoomListOpen && (
                <div className="grid gap-2">
                  {rooms.map((layout, index) => (
                    <div
                      key={layout.id}
                      className={`grid grid-cols-[auto_1fr] items-stretch overflow-hidden rounded border transition ${
                        layout.id === activeRoomId
                          ? "border-[#337563] bg-[#e7f0eb] text-slate-900"
                          : "border-stone-300 bg-white text-slate-600"
                      }`}
                    >
                      <label className="flex w-10 cursor-pointer items-center justify-center border-r border-stone-300 bg-white/70">
                        <input
                          type="checkbox"
                          checked={visibleRoomIds.includes(layout.id)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setVisibleRoomIds((currentIds) => {
                              if (checked) {
                                return currentIds.includes(layout.id) ? currentIds : currentIds.concat(layout.id);
                              }

                              const nextIds = currentIds.filter((id) => id !== layout.id);
                              return nextIds.length > 0 ? nextIds : currentIds;
                            });
                            if (checked) {
                              switchRoom(layout.id);
                            }
                          }}
                          className="h-4 w-4 accent-[#337563]"
                        />
                      </label>
                      <button type="button" onClick={() => switchRoom(layout.id)} className="min-w-0 px-3 py-2 text-left hover:bg-[#eef6f1]">
                        <div className="truncate text-sm font-black">{layout.room.name || `部屋 ${index + 1}`}</div>
                        <div className="text-xs font-bold text-slate-500">家具 {layout.items.length}点</div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-3 flex items-start gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={keepFurnitureInside}
                  onChange={(event) => setKeepFurnitureInside(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#337563]"
                />
                家具を部屋枠内に収める
              </label>
            </section>

            <section className="rounded-lg border border-stone-300 bg-[#fbfaf6] p-4 shadow-blueprint">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOpenSections((current) => ({ ...current, roomSettings: !current.roomSettings }))}
                  className="inline-flex items-center gap-2 text-base font-black text-slate-900"
                  aria-expanded={openSections.roomSettings}
                >
                  {openSections.roomSettings ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  部屋設定
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetDialogOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-stone-300 bg-white text-slate-600 transition hover:border-[#c35f39] hover:text-[#c35f39]"
                  title="初期化"
                >
                  <RotateCcw size={17} />
                </button>
              </div>
              {openSections.roomSettings && (
                <>
              <label className="mb-3 block text-sm font-bold text-slate-600">
                部屋名
                <input
                  value={room.name}
                  onChange={(event) => setRoom((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                />
              </label>
              <div className="mb-3 grid grid-cols-2 gap-2 rounded border border-stone-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() =>
                    setRoom((current) => ({
                      ...current,
                      shapeMode: "rectangle",
                      widthCm: Math.max(current.topCm, current.bottomCm),
                      depthCm: roundDecimal((current.leftCm + current.rightCm) / 2, 1),
                    }))
                  }
                  className={`rounded px-3 py-2 text-sm font-black transition ${
                    !isFourSideMode ? "bg-[#337563] text-white" : "text-slate-500 hover:bg-stone-100"
                  }`}
                >
                  長方形
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRoom((current) => ({
                      ...current,
                      shapeMode: "fourSides",
                      topCm: current.widthCm,
                      bottomCm: current.widthCm,
                      leftCm: current.depthCm,
                      rightCm: current.depthCm,
                    }))
                  }
                  className={`rounded px-3 py-2 text-sm font-black transition ${
                    isFourSideMode ? "bg-[#337563] text-white" : "text-slate-500 hover:bg-stone-100"
                  }`}
                >
                  四辺指定
                </button>
              </div>
              {!isFourSideMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-bold text-slate-600">
                    幅 cm
                    <DecimalInput
                      value={room.widthCm}
                      onChange={(value) =>
                        setRoom((current) => ({
                          ...current,
                          widthCm: value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                  <label className="block text-sm font-bold text-slate-600">
                    奥行き cm
                    <DecimalInput
                      value={room.depthCm}
                      onChange={(value) =>
                        setRoom((current) => ({
                          ...current,
                          depthCm: value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-bold text-slate-600">
                    上辺 cm
                    <DecimalInput
                      value={room.topCm}
                      onChange={(value) => setRoom((current) => ({ ...current, topCm: value }))}
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                  <label className="block text-sm font-bold text-slate-600">
                    右辺 cm
                    <DecimalInput
                      value={room.rightCm}
                      onChange={(value) => setRoom((current) => ({ ...current, rightCm: value }))}
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                  <label className="block text-sm font-bold text-slate-600">
                    下辺 cm
                    <DecimalInput
                      value={room.bottomCm}
                      onChange={(value) => setRoom((current) => ({ ...current, bottomCm: value }))}
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                  <label className="block text-sm font-bold text-slate-600">
                    左辺 cm
                    <DecimalInput
                      value={room.leftCm}
                      onChange={(value) => setRoom((current) => ({ ...current, leftCm: value }))}
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                    />
                  </label>
                </div>
              )}
              <div className="mt-3 rounded border border-dashed border-stone-300 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500">
                表示スケール: 1cm = {layout.scale.toFixed(2)}px
              </div>
              {roomWarnings.length > 0 && (
                <div className="mt-3 rounded border border-[#d89b4c] bg-[#fff7e8] px-3 py-2 text-xs font-bold leading-5 text-[#8a5a2b]">
                  {roomWarnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              )}
                </>
              )}
            </section>

            <section className="rounded-lg border border-stone-300 bg-[#fbfaf6] p-4 shadow-blueprint">
              <button
                type="button"
                onClick={() => setOpenSections((current) => ({ ...current, presets: !current.presets }))}
                className="mb-3 inline-flex items-center gap-2 text-base font-black text-slate-900"
                aria-expanded={openSections.presets}
              >
                {openSections.presets ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                家具追加
              </button>
              {openSections.presets && <div className="grid gap-2">
                {templates.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => addFurniture(template)}
                    className="flex items-center justify-between rounded border border-stone-300 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#337563] hover:shadow-md"
                  >
                    <span className="flex items-center gap-2 font-bold text-slate-800">
                      {template.kind === "rect" && <BoxSelect size={17} color={template.stroke} />}
                      {template.kind === "circle" && <Armchair size={17} color={template.stroke} />}
                      {template.kind === "ellipse" && <BookOpen size={17} color={template.stroke} />}
                      {template.label}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {template.widthCm}x{template.depthCm}cm
                    </span>
                  </button>
                ))}
              </div>}
            </section>

            <section className="rounded-lg border border-stone-300 bg-[#fbfaf6] p-4 shadow-blueprint">
              <button
                type="button"
                onClick={() => setOpenSections((current) => ({ ...current, customFurniture: !current.customFurniture }))}
                className="mb-3 inline-flex items-center gap-2 text-base font-black text-slate-900"
                aria-expanded={openSections.customFurniture}
              >
                {openSections.customFurniture ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                家具・器具を新規追加
              </button>
              {openSections.customFurniture && (
                <>
              <label className="mb-3 block text-sm font-bold text-slate-600">
                名前
                <input
                  value={customTemplate.label}
                  onChange={(event) =>
                    setCustomTemplate((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#337563] focus:ring-2 focus:ring-[#337563]/20"
                />
              </label>
              <div className="mb-3 grid grid-cols-3 gap-2 rounded border border-stone-300 bg-white p-1">
                {[
                  { kind: "rect" as const, label: "四角" },
                  { kind: "circle" as const, label: "円" },
                  { kind: "ellipse" as const, label: "楕円" },
                ].map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() =>
                      setCustomTemplate((current) => ({
                        ...current,
                        kind: option.kind,
                        depthCm: option.kind === "circle" ? current.widthCm : current.depthCm,
                      }))
                    }
                    className={`rounded px-2 py-2 text-sm font-black transition ${
                      customTemplate.kind === option.kind ? "bg-[#337563] text-white" : "text-slate-500 hover:bg-stone-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <NumberField
                  label={customTemplate.kind === "circle" ? "直径 cm" : "幅 cm"}
                  value={customTemplate.widthCm}
                  onChange={(value) =>
                    setCustomTemplate((current) => ({
                      ...current,
                      widthCm: value,
                      depthCm: current.kind === "circle" ? value : current.depthCm,
                    }))
                  }
                />
                <NumberField
                  label="奥行き cm"
                  value={customTemplate.depthCm}
                  disabled={customTemplate.kind === "circle"}
                  onChange={(value) =>
                    setCustomTemplate((current) => ({
                      ...current,
                      depthCm: value,
                    }))
                  }
                />
              </div>
              <div className="mb-3 grid grid-cols-8 gap-1">
                {customPalette.map((color) => (
                  <button
                    key={`${color.fill}-${color.stroke}`}
                    type="button"
                    onClick={() =>
                      setCustomTemplate((current) => ({
                        ...current,
                        fill: color.fill,
                        stroke: color.stroke,
                      }))
                    }
                    className={`h-8 rounded border transition ${
                      customTemplate.fill === color.fill ? "border-slate-900 ring-2 ring-slate-900/20" : "border-stone-300"
                    }`}
                    style={{ backgroundColor: color.fill }}
                    title="色を選択"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={addCustomFurniture}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-[#337563] bg-[#337563] px-3 text-sm font-black text-white transition hover:bg-[#285d50]"
              >
                <Plus size={17} />
                Canvasに追加
              </button>
              {(customTemplate.widthCm <= 0 || customTemplate.depthCm <= 0) && (
                <div className="mt-3 rounded border border-[#d89b4c] bg-[#fff7e8] px-3 py-2 text-xs font-bold leading-5 text-[#8a5a2b]">
                  0cm以下でも追加できますが、Canvas上では見えなくなる場合があります。
                </div>
              )}
                </>
              )}
            </section>

            <section className="rounded-lg border border-stone-300 bg-[#fbfaf6] p-4 shadow-blueprint">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOpenSections((current) => ({ ...current, selectedItem: !current.selectedItem }))}
                  className="inline-flex items-center gap-2 text-base font-black text-slate-900"
                  aria-expanded={openSections.selectedItem}
                >
                  {openSections.selectedItem ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  選択中
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={!selectedId}
                  className="inline-flex h-9 items-center gap-2 rounded border border-[#a9474c] bg-white px-3 text-sm font-bold text-[#a9474c] transition hover:bg-[#a9474c] hover:text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-white"
                >
                  <Trash2 size={16} />
                  削除
                </button>
              </div>
              {openSections.selectedItem && (selectedItem ? (
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Info label="家具" value={selectedItem.label} />
                    <Info label="回転" value={`${roundDecimal(selectedItem.rotation, 1)}度`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="X cm"
                      value={selectedItem.xCm}
                      onChange={(value) => updateItem(selectedItem.id, { xCm: value })}
                    />
                    <NumberField
                      label="Y cm"
                      value={selectedItem.yCm}
                      onChange={(value) => updateItem(selectedItem.id, { yCm: value })}
                    />
                    <NumberField
                      label="幅 cm"
                      value={selectedItem.widthCm}
                      onChange={(value) =>
                        updateItem(selectedItem.id, {
                          widthCm: value,
                          depthCm: selectedItem.kind === "circle" ? value : selectedItem.depthCm,
                        })
                      }
                    />
                    <NumberField
                      label="奥行き cm"
                      value={selectedItem.depthCm}
                      disabled={selectedItem.kind === "circle"}
                      onChange={(value) => updateItem(selectedItem.id, { depthCm: value })}
                    />
                  </div>
                  {selectedGaps && (
                    <div className="rounded border border-stone-300 bg-white p-3">
                      <div className="mb-2 text-[11px] font-black text-slate-400">壁までの隙間</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Info label="左" value={formatCm(selectedGaps.left)} tone={selectedGaps.left < 0 ? "warn" : "default"} />
                        <Info label="右" value={formatCm(selectedGaps.right)} tone={selectedGaps.right < 0 ? "warn" : "default"} />
                        <Info label="上" value={formatCm(selectedGaps.top)} tone={selectedGaps.top < 0 ? "warn" : "default"} />
                        <Info label="下" value={formatCm(selectedGaps.bottom)} tone={selectedGaps.bottom < 0 ? "warn" : "default"} />
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                        回転中の家具は外接矩形で計測します。マイナス値は部屋表示領域からはみ出している距離です。
                      </p>
                    </div>
                  )}
                  <div className="rounded border border-stone-300 bg-white p-3">
                    <div className="mb-2 text-[11px] font-black text-slate-400">家具同士の隙間</div>
                    {selectedFurnitureGaps.length > 0 ? (
                      <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                        {selectedFurnitureGaps.map((gap) => (
                          <div key={gap.id} className="rounded border border-stone-200 bg-[#fbfaf6] px-3 py-2">
                            <div className="mb-2 truncate text-sm font-black text-slate-800">{gap.label}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <MetricPill
                                label={gap.horizontalLabel}
                                value={gap.horizontalValue > 0 ? formatCm(gap.horizontalValue) : "0cm"}
                                muted={gap.horizontalValue === 0}
                              />
                              <MetricPill
                                label={gap.verticalLabel}
                                value={gap.verticalValue > 0 ? formatCm(gap.verticalValue) : "0cm"}
                                muted={gap.verticalValue === 0}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded border border-dashed border-stone-300 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-500">
                        他の家具がありません
                      </p>
                    )}
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      選択中家具を基準に、他家具との左右・上下方向の空き寸法を外接矩形で計測します。
                    </p>
                  </div>
                  {selectedWarnings.length > 0 && (
                    <div className="rounded border border-[#d89b4c] bg-[#fff7e8] px-3 py-2 text-xs font-bold leading-5 text-[#8a5a2b]">
                      {selectedWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded border border-dashed border-stone-300 bg-white/70 px-3 py-4 text-sm font-semibold text-slate-500">
                  Canvas上の家具をクリックして選択
                </p>
              ))}
            </section>

            <section className="rounded-lg border border-stone-300 bg-[#f1f0ea] p-4 text-sm text-slate-400">
              <button
                type="button"
                onClick={() => setOpenSections((current) => ({ ...current, roadmap: !current.roadmap }))}
                className="mb-2 flex items-center gap-2 font-black text-slate-500"
                aria-expanded={openSections.roadmap}
              >
                {openSections.roadmap ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Monitor size={16} />
                追加予定機能
              </button>
              {openSections.roadmap && <p className="leading-6">3Dビュー、複数部屋の結合、家具の素材変更</p>}
            </section>
          </aside>

          <section className="min-h-[560px] overflow-hidden rounded-lg border border-stone-300 bg-[#dfe4dd] shadow-blueprint">
            <div className="flex items-center justify-between border-b border-stone-300 bg-[#fbfaf6] px-4 py-3">
              <div>
                <h2 className="font-black text-slate-900">{room.name || "無題の部屋"}</h2>
                <p className="text-xs font-bold text-slate-500">
                  {roomSummary} / 家具 {items.length}点
                </p>
              </div>
              <span className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-black text-slate-500">
                2D PLAN
              </span>
            </div>
            <div ref={stageWrapRef} className="h-[calc(100vh-154px)] min-h-[500px] w-full">
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={(event) => {
                  if (event.target === event.target.getStage()) {
                    setSelectedId(null);
                  }
                }}
                onTouchStart={(event) => {
                  if (event.target === event.target.getStage()) {
                    setSelectedId(null);
                  }
                }}
              >
                <Layer>
                  <Rect
                    x={0}
                    y={0}
                    width={stageSize.width}
                    height={stageSize.height}
                    fill="#dfe4dd"
                  />
                  {canvasRooms.map((roomCanvas) => {
                    const roomSize = getRoomPlanSize(roomCanvas.room);
                    return (
                      <Group key={roomCanvas.layoutId}>
                        <Line
                          points={roomCanvas.floorPoints}
                          closed
                          fill="#f4f3ee"
                          stroke="#b9b6aa"
                          strokeWidth={2}
                          shadowColor="rgba(31,41,55,0.18)"
                          shadowBlur={18}
                          shadowOffsetY={8}
                        />
                        {!roomSize.isFourSideMode && (
                          <Grid
                            x={roomCanvas.floorX}
                            y={roomCanvas.floorY}
                            width={roomCanvas.floorWidth}
                            height={roomCanvas.floorHeight}
                            step={50 * roomCanvas.scale}
                          />
                        )}
                        <Line points={roomCanvas.floorPoints} closed stroke="#9f9a8d" strokeWidth={2} listening={false} />
                        <Text
                          x={roomCanvas.floorX + 12}
                          y={roomCanvas.floorY + 12}
                          text={roomCanvas.room.name || "無題の部屋"}
                          fontSize={13}
                          fontStyle="bold"
                          fill={roomCanvas.layoutId === activeRoomId ? "#285d50" : "#64748b"}
                        />

                        {roomCanvas.items.map((item) => (
                          <Furniture
                            key={item.id}
                            item={item}
                            scale={roomCanvas.scale}
                            offsetX={roomCanvas.floorX}
                            offsetY={roomCanvas.floorY}
                            isSelected={selectedId === item.id}
                            setNode={(node) => {
                              itemRefs.current[item.id] = node;
                            }}
                            onSelect={() => {
                              setActiveRoomId(roomCanvas.layoutId);
                              setSelectedId(item.id);
                            }}
                            onDragEnd={(xPx, yPx) => handleFurnitureDragEnd(roomCanvas.layoutId, item, xPx, yPx)}
                            onTransformEnd={(node) => {
                              setActiveRoomId(roomCanvas.layoutId);
                              const scaleX = node.scaleX();
                              const scaleY = node.scaleY();
                              const nextWidth = Math.max(0, roundDecimal(item.widthCm * scaleX, 1));
                              const nextDepth = Math.max(0, roundDecimal(item.depthCm * scaleY, 1));

                              node.scaleX(1);
                              node.scaleY(1);
                              updateItem(item.id, {
                                xCm: roundDecimal((node.x() - roomCanvas.floorX) / roomCanvas.scale, 1),
                                yCm: roundDecimal((node.y() - roomCanvas.floorY) / roomCanvas.scale, 1),
                                widthCm: nextWidth,
                                depthCm: item.kind === "circle" ? nextWidth : nextDepth,
                                rotation: roundDecimal(node.rotation(), 1),
                              });
                            }}
                          />
                        ))}
                      </Group>
                    );
                  })}

                  {selectedGaps && layout && (
                    <GapGuides
                      gaps={selectedGaps}
                      scale={layout.scale}
                      offsetX={layout.floorX}
                      offsetY={layout.floorY}
                      roomWidth={drawableRoomWidth}
                      roomDepth={drawableRoomDepth}
                    />
                  )}

                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    centeredScaling={false}
                    anchorSize={9}
                    borderStroke="#c35f39"
                    anchorStroke="#c35f39"
                    anchorFill="#fff7ed"
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < MIN_TRANSFORM_SIZE_PX || newBox.height < MIN_TRANSFORM_SIZE_PX) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          </section>
        </div>
      </div>
      {isResetDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-300 bg-[#fbfaf6] p-5 shadow-blueprint">
            <h2 className="text-lg font-black text-slate-900">この部屋をリセットしますか？</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              現在の部屋設定と家具配置が初期状態に戻ります。誤操作を避けるため、必要ならコピーを部屋一覧へ保存してからリセットできます。
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={saveCopyAndResetActiveRoom}
                className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[#337563] bg-[#337563] px-3 text-sm font-black text-white transition hover:bg-[#285d50]"
              >
                <Save size={17} />
                コピーを保存してリセット
              </button>
              <button
                type="button"
                onClick={resetActiveRoom}
                className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[#a9474c] bg-white px-3 text-sm font-black text-[#a9474c] transition hover:bg-[#a9474c] hover:text-white"
              >
                <RotateCcw size={17} />
                保存せずリセット
              </button>
              <button
                type="button"
                onClick={() => setIsResetDialogOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded border border-stone-300 bg-white px-3 text-sm font-black text-slate-600 transition hover:border-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded border border-stone-300 bg-white px-3 py-2">
      <div className="text-[11px] font-black text-slate-400">{label}</div>
      <div className={`truncate font-bold ${tone === "warn" ? "text-[#a9474c]" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}

function MetricPill({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded border px-2 py-1 ${muted ? "border-stone-200 bg-stone-50 text-slate-400" : "border-stone-300 bg-white text-slate-700"}`}>
      <div className="font-black">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-slate-600">
      <span className="text-[11px] font-black text-slate-400">{label}</span>
      <DecimalInput
        value={value}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 w-full bg-transparent text-slate-900 outline-none disabled:text-slate-400"
      />
    </label>
  );
}

function DecimalInput({
  value,
  disabled = false,
  className,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [isFocused, value]);

  const commitDraft = (nextDraft: string) => {
    setDraft(nextDraft);

    if (nextDraft.trim() === "" || nextDraft === "-" || nextDraft === "." || nextDraft === "-.") {
      return;
    }

    const nextValue = Number(nextDraft);
    if (Number.isFinite(nextValue)) {
      onChange(nextValue);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        const nextValue = Number(draft);
        setDraft(Number.isFinite(nextValue) ? String(nextValue) : String(value));
      }}
      onChange={(event) => commitDraft(event.target.value)}
      className={className}
    />
  );
}

function Grid({ x, y, width, height, step }: { x: number; y: number; width: number; height: number; step: number }) {
  const lines = [];
  for (let currentX = x + step; currentX < x + width; currentX += step) {
    lines.push(<Rect key={`v-${currentX}`} x={currentX} y={y} width={1} height={height} fill="#dedbd1" />);
  }
  for (let currentY = y + step; currentY < y + height; currentY += step) {
    lines.push(<Rect key={`h-${currentY}`} x={x} y={currentY} width={width} height={1} fill="#dedbd1" />);
  }
  return <>{lines}</>;
}

function GapGuides({
  gaps,
  scale,
  offsetX,
  offsetY,
  roomWidth,
  roomDepth,
}: {
  gaps: GapMetrics;
  scale: number;
  offsetX: number;
  offsetY: number;
  roomWidth: number;
  roomDepth: number;
}) {
  const toPxX = (value: number) => offsetX + value * scale;
  const toPxY = (value: number) => offsetY + value * scale;
  const bounds = gaps.bounds;
  const centerY = Math.min(Math.max(bounds.centerY, 8), roomDepth - 8);
  const centerX = Math.min(Math.max(bounds.centerX, 8), roomWidth - 8);

  return (
    <>
      {gaps.right > 0.5 && (
        <DimensionLine
          x1={toPxX(bounds.maxX)}
          y1={toPxY(centerY)}
          x2={toPxX(roomWidth)}
          y2={toPxY(centerY)}
          label={formatCm(gaps.right)}
          labelX={toPxX(roomWidth) + 34}
          labelY={toPxY(centerY)}
        />
      )}
      {gaps.left > 0.5 && (
        <DimensionLine
          x1={toPxX(0)}
          y1={toPxY(centerY)}
          x2={toPxX(bounds.minX)}
          y2={toPxY(centerY)}
          label={formatCm(gaps.left)}
          labelX={toPxX(0) - 34}
          labelY={toPxY(centerY)}
        />
      )}
      {gaps.top > 0.5 && (
        <DimensionLine
          x1={toPxX(centerX)}
          y1={toPxY(0)}
          x2={toPxX(centerX)}
          y2={toPxY(bounds.minY)}
          label={formatCm(gaps.top)}
          labelX={toPxX(centerX)}
          labelY={toPxY(0) - 22}
        />
      )}
      {gaps.bottom > 0.5 && (
        <DimensionLine
          x1={toPxX(centerX)}
          y1={toPxY(bounds.maxY)}
          x2={toPxX(centerX)}
          y2={toPxY(roomDepth)}
          label={formatCm(gaps.bottom)}
          labelX={toPxX(centerX)}
          labelY={toPxY(roomDepth) + 22}
        />
      )}
    </>
  );
}

function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  label,
  labelX,
  labelY,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  labelX?: number;
  labelY?: number;
}) {
  const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const textX = labelX ?? midX;
  const textY = labelY ?? midY;
  const labelWidth = Math.max(46, label.length * 7 + 12);
  const labelHeight = 20;
  const tick = 6;

  return (
    <Group listening={false}>
      <Line points={[x1, y1, x2, y2]} stroke="#c35f39" strokeWidth={2} dash={[7, 5]} />
      <Line points={isHorizontal ? [x1, y1 - tick, x1, y1 + tick] : [x1 - tick, y1, x1 + tick, y1]} stroke="#c35f39" strokeWidth={2} />
      <Line points={isHorizontal ? [x2, y2 - tick, x2, y2 + tick] : [x2 - tick, y2, x2 + tick, y2]} stroke="#c35f39" strokeWidth={2} />
      <Rect
        x={textX - labelWidth / 2}
        y={textY - labelHeight / 2}
        width={labelWidth}
        height={labelHeight}
        fill="#fff7ed"
        stroke="#c35f39"
        strokeWidth={1}
        cornerRadius={4}
      />
      <Text
        x={textX - labelWidth / 2}
        y={textY - 6}
        width={labelWidth}
        text={label}
        align="center"
        fontSize={12}
        fontStyle="bold"
        fill="#9b4f20"
      />
    </Group>
  );
}

function Furniture({
  item,
  scale,
  offsetX,
  offsetY,
  isSelected,
  setNode,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  item: FurnitureItem;
  scale: number;
  offsetX: number;
  offsetY: number;
  isSelected: boolean;
  setNode: (node: Konva.Group | null) => void;
  onSelect: () => void;
  onDragEnd: (xPx: number, yPx: number) => void;
  onTransformEnd: (node: Konva.Group) => void;
}) {
  const width = Math.max(0, item.widthCm) * scale;
  const height = Math.max(0, item.depthCm) * scale;
  const x = offsetX + item.xCm * scale;
  const y = offsetY + item.yCm * scale;
  const labelFontSize = width > 0 && height > 0 ? Math.max(11, Math.min(16, width / 7)) : 11;

  return (
    <Group
      ref={setNode}
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={item.rotation}
      draggable
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={(event) => onDragEnd(event.target.x(), event.target.y())}
      onTransformEnd={(event) => onTransformEnd(event.target as Konva.Group)}
    >
      {item.kind === "rect" && (
        <Rect
          width={width}
          height={height}
          fill={item.fill}
          stroke={isSelected ? "#c35f39" : item.stroke}
          strokeWidth={isSelected ? 3 : 2}
          cornerRadius={4}
        />
      )}
      {item.kind === "circle" && (
        <Circle
          x={width / 2}
          y={height / 2}
          radius={width / 2}
          fill={item.fill}
          stroke={isSelected ? "#c35f39" : item.stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      )}
      {item.kind === "ellipse" && (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={item.fill}
          stroke={isSelected ? "#c35f39" : item.stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
      )}
      <Text
        x={0}
        y={Math.max(4, height / 2 - labelFontSize / 2)}
        width={width}
        align="center"
        text={item.label}
        fontSize={labelFontSize}
        fontStyle="bold"
        fill="#1f2937"
        listening={false}
      />
    </Group>
  );
}

export default App;
