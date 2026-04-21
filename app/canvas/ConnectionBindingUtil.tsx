import {
  BindingOnCreateOptions,
  BindingOnDeleteOptions,
  BindingOnShapeDeleteOptions,
  BindingUtil,
  createComputedCache,
  Editor,
  T,
  TLBinding,
  TLShapeId,
} from 'tldraw';

const CONNECTION_TYPE = 'connection';

declare module 'tldraw' {
  export interface TLGlobalBindingPropsMap {
    [CONNECTION_TYPE]: {
      portId: string;
      terminal: 'start' | 'end';
      tickIndex?: number; // For timeline connections
    };
  }
}

export type ConnectionBinding = TLBinding<typeof CONNECTION_TYPE>;

export class ConnectionBindingUtil extends BindingUtil<ConnectionBinding> {
  static override type = CONNECTION_TYPE;
  static override props = {
    portId: T.string,
    terminal: T.literalEnum('start', 'end'),
    tickIndex: T.number.optional(),
  };

  override getDefaultProps() {
    return {};
  }

  onBeforeDeleteToShape({ binding }: BindingOnShapeDeleteOptions<ConnectionBinding>): void {
    // When deleting a card, delete any connections bound to it
    this.editor.deleteShapes([binding.fromId]);
  }

  onAfterCreate({ binding }: BindingOnCreateOptions<ConnectionBinding>): void {
    console.log('✅ Connection binding created:', binding);
  }

  onAfterDelete({ binding }: BindingOnDeleteOptions<ConnectionBinding>): void {
    console.log('🗑️ Connection binding deleted:', binding);
  }
}

export interface ConnectionBindings {
  start?: ConnectionBinding;
  end?: ConnectionBinding;
}

export function getConnectionBindings(
  editor: Editor,
  connectionId: TLShapeId
): ConnectionBindings {
  return connectionBindingsCache.get(editor, connectionId) ?? {};
}

const connectionBindingsCache = createComputedCache(
  'connection bindings',
  (editor: Editor, record: any) => {
    const connectionId = typeof record === 'string' ? record : record?.id;
    const connection = editor.getShape(connectionId);
    if (!connection || (connection as any).type !== 'connection') {
      return {};
    }

    const bindings = editor.getBindingsFromShape<ConnectionBinding>(connection.id, CONNECTION_TYPE);
    let start, end;
    for (const binding of bindings) {
      if (binding.props.terminal === 'start') {
        start = binding;
      } else if (binding.props.terminal === 'end') {
        end = binding;
      }
    }
    return { start, end };
  },
  {
    areRecordsEqual: (a, b) => a === b,
    areResultsEqual: (a, b) => a.start === b.start && a.end === b.end,
  }
);

export function getConnectionBindingPosition(
  editor: Editor,
  binding: ConnectionBinding
) {
  const targetShape = editor.getShape(binding.toId);
  if (!targetShape) return null;

  const bounds = editor.getShapePageBounds(targetShape);
  if (!bounds) return null;

  const shapeType = (targetShape as any).type;

  // Handle timeline shape connections
  if (shapeType === 'timeline') {
    const tickIndex = binding.props.tickIndex ?? 0;
    const { duration, zoom, w } = (targetShape as any).props;
    const pixelsPerSecond = (w / 60) * zoom;
    const tickPosition = tickIndex * pixelsPerSecond;

    // 计算锯齿顶端的位置
    // 横线在 bounds.minY + 40px
    // 大刻度（每5秒）高度是 24px
    // 所以锯齿顶端在 bounds.minY + 40 - 24 = bounds.minY + 16
    const isLargeTick = tickIndex % 5 === 0;
    const tickHeight = isLargeTick ? 24 : 6;
    const tickTopY = bounds.minY + 40 - tickHeight;

    return {
      x: bounds.minX + tickPosition,
      y: tickTopY  // 连接到锯齿顶端
    };
  }

  // Handle custom-card shape connections (default behavior)
  if (shapeType === 'custom-card') {
    // Return port position based on terminal type
    if (binding.props.terminal === 'start') {
      // Output port on right side
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      // Input port on left side
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle shot-card shape connections
  if (shapeType === 'shot-card') {
    // Shot card has both input and output ports
    if (binding.props.terminal === 'start') {
      // Output port on right side
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      // Input port on left side
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle prompt-optimizer-card shape connections
  if (shapeType === 'prompt-optimizer-card') {
    if (binding.props.terminal === 'start') {
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle seedance-card shape connections
  if (shapeType === 'seedance-card') {
    if (binding.props.terminal === 'start') {
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle audio-card shape connections
  if (shapeType === 'audio-card') {
    if (binding.props.terminal === 'start') {
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle GEM storyboard cards
  if (shapeType === 'gem-step0-card' || shapeType === 'gem-step1-card' || shapeType === 'gem-step2-card' ||
      shapeType === 'gem-step3-card' || shapeType === 'gem-step4-card') {
    if (binding.props.terminal === 'start') {
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  // Handle camera-control-card shape connections
  if (shapeType === 'camera-control-card') {
    if (binding.props.terminal === 'start') {
      return { x: bounds.maxX, y: bounds.midY };
    } else {
      return { x: bounds.minX, y: bounds.midY };
    }
  }

  return null;
}

export function createOrUpdateConnectionBinding(
  editor: Editor,
  connectionId: TLShapeId,
  targetId: TLShapeId,
  props: ConnectionBinding['props']
) {
  const existingMany = editor
    .getBindingsFromShape<ConnectionBinding>(connectionId, CONNECTION_TYPE)
    .filter((b) => b.props.terminal === props.terminal);

  if (existingMany.length > 1) {
    editor.deleteBindings(existingMany.slice(1));
  }

  const existing = existingMany[0];
  if (existing) {
    editor.updateBinding({
      ...existing,
      toId: targetId,
      props,
    });
  } else {
    editor.createBinding({
      type: CONNECTION_TYPE,
      fromId: connectionId,
      toId: targetId,
      props,
    });
  }
}

export function removeConnectionBinding(
  editor: Editor,
  connectionId: TLShapeId,
  terminal: 'start' | 'end'
) {
  const existing = editor
    .getBindingsFromShape<ConnectionBinding>(connectionId, CONNECTION_TYPE)
    .filter((b) => b.props.terminal === terminal);

  editor.deleteBindings(existing);
}
