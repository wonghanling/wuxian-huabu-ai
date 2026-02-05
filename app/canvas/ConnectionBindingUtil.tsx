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
    };
  }
}

export type ConnectionBinding = TLBinding<typeof CONNECTION_TYPE>;

export class ConnectionBindingUtil extends BindingUtil<ConnectionBinding> {
  static override type = CONNECTION_TYPE;
  static override props = {
    portId: T.string,
    terminal: T.literalEnum('start', 'end'),
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
  (editor: Editor, connectionId: TLShapeId) => {
    const connection = editor.getShape(connectionId);
    if (!connection || !editor.isShapeOfType(connection, 'connection')) {
      return {};
    }

    const bindings = editor.getBindingsFromShape(connection.id, CONNECTION_TYPE);
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
  if (!targetShape || !editor.isShapeOfType(targetShape, 'custom-card')) return null;

  const bounds = editor.getShapePageBounds(targetShape);
  if (!bounds) return null;

  // Return port position based on terminal type
  if (binding.props.terminal === 'start') {
    // Output port on right side
    return { x: bounds.maxX, y: bounds.midY };
  } else {
    // Input port on left side
    return { x: bounds.minX, y: bounds.midY };
  }
}

export function createOrUpdateConnectionBinding(
  editor: Editor,
  connectionId: TLShapeId,
  targetId: TLShapeId,
  props: ConnectionBinding['props']
) {
  const existingMany = editor
    .getBindingsFromShape(connectionId, CONNECTION_TYPE)
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
    .getBindingsFromShape(connectionId, CONNECTION_TYPE)
    .filter((b) => b.props.terminal === terminal);

  editor.deleteBindings(existing);
}
