import {
  CubicBezier2d,
  Editor,
  IndexKey,
  Mat,
  RecordProps,
  SVGContainer,
  ShapeUtil,
  TLHandle,
  TLHandleDragInfo,
  TLShape,
  TLShapeId,
  Vec,
  VecLike,
  VecModel,
  clamp,
  useEditor,
  useValue,
  vecModelValidator,
} from 'tldraw';
import { useState } from 'react';
import {
  createOrUpdateConnectionBinding,
  getConnectionBindingPosition,
  getConnectionBindings,
  removeConnectionBinding,
} from './ConnectionBindingUtil';

const CONNECTION_TYPE = 'connection';

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [CONNECTION_TYPE]: {
      start: VecModel;
      end: VecModel;
    };
  }
}

export type ConnectionShape = TLShape<typeof CONNECTION_TYPE>;

export class ConnectionShapeUtil extends ShapeUtil<ConnectionShape> {
  static override type = CONNECTION_TYPE;
  static override props: RecordProps<ConnectionShape> = {
    start: vecModelValidator,
    end: vecModelValidator,
  };

  getDefaultProps(): ConnectionShape['props'] {
    return {
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    };
  }

  override canEdit() {
    return false;
  }
  override canResize() {
    return false;
  }
  override hideResizeHandles() {
    return true;
  }
  override hideRotateHandle() {
    return true;
  }
  override hideSelectionBoundsBg() {
    return true;
  }
  override hideSelectionBoundsFg() {
    return true;
  }
  override canSnap() {
    return false;
  }
  override getBoundsSnapGeometry() {
    return { points: [] };
  }

  getGeometry(connection: ConnectionShape) {
    const { start, end } = getConnectionTerminals(this.editor, connection);
    const [cp1, cp2] = getConnectionControlPoints(start, end);
    return new CubicBezier2d({
      start: Vec.From(start),
      cp1: Vec.From(cp1),
      cp2: Vec.From(cp2),
      end: Vec.From(end),
    });
  }

  getHandles(connection: ConnectionShape): TLHandle[] {
    const { start, end } = getConnectionTerminals(this.editor, connection);
    return [
      {
        id: 'start',
        type: 'vertex',
        index: 'a0' as IndexKey,
        x: start.x,
        y: start.y,
      },
      {
        id: 'end',
        type: 'vertex',
        index: 'a1' as IndexKey,
        x: end.x,
        y: end.y,
      },
    ];
  }

  onHandleDrag(connection: ConnectionShape, { handle }: TLHandleDragInfo<ConnectionShape>) {
    const draggingTerminal = handle.id as 'start' | 'end';
    const shapeTransform = this.editor.getShapePageTransform(connection);
    const handlePagePosition = shapeTransform.applyToPoint(handle);

    // Find target shape at handle position
    const target = this.findShapeAtPoint(handlePagePosition, draggingTerminal);

    if (!target) {
      removeConnectionBinding(this.editor, connection.id, draggingTerminal);
      return {
        ...connection,
        props: {
          [handle.id]: { x: handle.x, y: handle.y },
        },
      };
    }

    // Create or update binding
    const bindingProps: any = {
      portId: draggingTerminal === 'start' ? 'output' : 'input',
      terminal: draggingTerminal,
    };

    // Add tickIndex for timeline connections
    if (target.tickIndex !== undefined) {
      bindingProps.tickIndex = target.tickIndex;
    }

    createOrUpdateConnectionBinding(this.editor, connection.id, target.shapeId, bindingProps);

    return connection;
  }

  onHandleDragEnd(connection: ConnectionShape, { handle }: TLHandleDragInfo<ConnectionShape>) {
    const draggingTerminal = handle.id as 'start' | 'end';
    const bindings = getConnectionBindings(this.editor, connection.id);

    if (!bindings[draggingTerminal]) {
      // If not connected, delete the connection
      if (!bindings.start || !bindings.end) {
        this.editor.deleteShapes([connection.id]);
      }
    }
  }

  private findShapeAtPoint(point: VecLike, terminal: 'start' | 'end'): { shapeId: TLShapeId; tickIndex?: number } | null {
    const shapes = this.editor.getCurrentPageShapes();

    for (const shape of shapes) {
      const bounds = this.editor.getShapePageBounds(shape);
      if (!bounds) continue;

      const shapeType = (shape as any).type;

      // Check for timeline shape - 大幅扩展检测范围
      if (shapeType === 'timeline') {
        const { duration, zoom, w } = (shape as any).props;
        const pixelsPerSecond = (w / 60) * zoom;

        // 时间轴横线在 top: 40px，大刻度高度24px，圆点在刻度线顶端
        // 需要大幅扩展Y轴检测范围
        const expandedMinY = bounds.minY - 100; // 向上扩展100像素
        const expandedMaxY = bounds.maxY + 100; // 向下扩展100像素

        // Check if point is within expanded timeline bounds
        if (point.y >= expandedMinY && point.y <= expandedMaxY &&
            point.x >= bounds.minX - 50 && point.x <= bounds.maxX + 50) {

          // Calculate which tick is closest
          const relativeX = point.x - bounds.minX;
          const tickIndex = Math.round(relativeX / pixelsPerSecond);

          // Only allow connection to ticks that are multiples of 5 (where the blue dots are)
          if (tickIndex >= 0 && tickIndex <= duration && tickIndex % 5 === 0) {
            const tickX = bounds.minX + tickIndex * pixelsPerSecond;
            const distanceX = Math.abs(point.x - tickX);

            // Allow connection within 50 pixels horizontally
            if (distanceX < 50) {
              console.log('✅ 找到时间轴连接点:', { tickIndex, tickX, distanceX });
              return { shapeId: shape.id, tickIndex };
            }
          }
        }
      }

      // Check for custom-card shape
      if (shapeType === 'custom-card') {
        // Check if point is near the appropriate port
        const portX = terminal === 'start' ? bounds.maxX : bounds.minX;
        const portY = bounds.midY;
        const distance = Math.sqrt(
          Math.pow(point.x - portX, 2) + Math.pow(point.y - portY, 2)
        );

        if (distance < 20) {
          return { shapeId: shape.id };
        }
      }
    }

    return null;
  }

  component(connection: ConnectionShape) {
    return <ConnectionShapeComponent connection={connection} />;
  }

  indicator(connection: ConnectionShape) {
    const { start, end } = getConnectionTerminals(this.editor, connection);
    return (
      <g>
        <path d={getConnectionPath(start, end)} strokeWidth={2.1} strokeLinecap="round" />
      </g>
    );
  }
}

function ConnectionShapeComponent({ connection }: { connection: ConnectionShape }) {
  const editor = useEditor();
  const [hovered, setHovered] = useState(false);

  const { start, end } = useValue(
    'terminals',
    () => getConnectionTerminals(editor, connection),
    [editor, connection]
  );

  // 贝塞尔曲线中点（t=0.5）
  const [cp1, cp2] = getConnectionControlPoints(start, end);
  const t = 0.5;
  const mt = 1 - t;
  const midX = mt * mt * mt * start.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * end.x;
  const midY = mt * mt * mt * start.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * end.y;

  return (
    <SVGContainer
      className="connection-shape"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 透明粗线用于扩大 hover 命中区 */}
      <path
        d={getConnectionPath(start, end)}
        stroke="transparent"
        strokeWidth="16"
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />
      <path
        d={getConnectionPath(start, end)}
        stroke={hovered ? '#f87171' : '#a0a0a0'}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        style={{ pointerEvents: 'none', transition: 'stroke 0.15s' }}
      />
      {/* hover 时在中点显示 ✕ 删除按钮 */}
      {hovered && (
        <g
          onPointerDown={(e) => {
            e.stopPropagation();
            editor.deleteShapes([connection.id]);
          }}
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
          <circle cx={midX} cy={midY} r={10} fill="#ef4444" stroke="white" strokeWidth="1.5" />
          <line x1={midX - 4} y1={midY - 4} x2={midX + 4} y2={midY + 4} stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1={midX + 4} y1={midY - 4} x2={midX - 4} y2={midY + 4} stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </SVGContainer>
  );
}

function getConnectionControlPoints(start: VecLike, end: VecLike): [Vec, Vec] {
  const distance = end.x - start.x;
  const adjustedDistance = Math.max(
    30,
    distance > 0 ? distance / 3 : clamp(Math.abs(distance) + 30, 0, 100)
  );
  return [new Vec(start.x + adjustedDistance, start.y), new Vec(end.x - adjustedDistance, end.y)];
}

function getConnectionPath(start: VecLike, end: VecLike) {
  const [cp1, cp2] = getConnectionControlPoints(start, end);
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
}

export function getConnectionTerminals(editor: Editor, connection: ConnectionShape) {
  let start, end;

  const bindings = getConnectionBindings(editor, connection.id);
  const shapeTransform = Mat.Inverse(editor.getShapePageTransform(connection));

  if (bindings.start) {
    const inPageSpace = getConnectionBindingPosition(editor, bindings.start);
    if (inPageSpace) {
      start = Mat.applyToPoint(shapeTransform, inPageSpace);
    }
  }

  if (bindings.end) {
    const inPageSpace = getConnectionBindingPosition(editor, bindings.end);
    if (inPageSpace) {
      end = Mat.applyToPoint(shapeTransform, inPageSpace);
    }
  }

  if (!start) start = connection.props.start;
  if (!end) end = connection.props.end;

  return { start, end };
}
