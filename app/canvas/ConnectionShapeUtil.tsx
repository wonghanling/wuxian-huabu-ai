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
  Vec,
  VecLike,
  VecModel,
  clamp,
  useEditor,
  useValue,
  vecModelValidator,
} from 'tldraw';
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

    // Find target card at handle position
    const target = this.findCardAtPoint(handlePagePosition, draggingTerminal);

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
    createOrUpdateConnectionBinding(this.editor, connection.id, target.id, {
      portId: draggingTerminal === 'start' ? 'output' : 'input',
      terminal: draggingTerminal,
    });

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

  private findCardAtPoint(point: VecLike, terminal: 'start' | 'end') {
    const shapes = this.editor.getCurrentPageShapes();

    for (const shape of shapes) {
      if (!this.editor.isShapeOfType(shape, 'custom-card')) continue;

      const bounds = this.editor.getShapePageBounds(shape);
      if (!bounds) continue;

      // Check if point is near the appropriate port
      const portX = terminal === 'start' ? bounds.maxX : bounds.minX;
      const portY = bounds.midY;
      const distance = Math.sqrt(
        Math.pow(point.x - portX, 2) + Math.pow(point.y - portY, 2)
      );

      if (distance < 20) {
        return shape;
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

  const { start, end } = useValue(
    'terminals',
    () => getConnectionTerminals(editor, connection),
    [editor, connection]
  );

  return (
    <SVGContainer className="connection-shape">
      <path
        d={getConnectionPath(start, end)}
        stroke="#a0a0a0"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
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
