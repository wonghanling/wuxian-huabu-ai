import { StateNode, TLEventHandlers, TLShapeId, createShapeId } from 'tldraw';

export class PortTool extends StateNode {
  static override id = 'port';

  private shapeId: TLShapeId | null = null;
  private portId: string | null = null;
  private terminal: 'start' | 'end' | null = null;
  private connectionId: TLShapeId | null = null;

  override onEnter(info?: { shapeId: TLShapeId; portId: string; terminal: 'start' | 'end' }) {
    if (info) {
      this.shapeId = info.shapeId;
      this.portId = info.portId;
      this.terminal = info.terminal;

      // Create a new connection shape
      const shape = this.editor.getShape(info.shapeId);
      if (!shape) return;

      const bounds = this.editor.getShapePageBounds(info.shapeId);
      if (!bounds) return;

      // Get port position
      const portX = info.terminal === 'start' ? bounds.maxX : bounds.minX;
      const portY = bounds.midY;

      // Create connection
      this.connectionId = createShapeId();
      this.editor.createShape({
        id: this.connectionId,
        type: 'connection',
        x: portX,
        y: portY,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
        },
      });

      // Create binding for the starting point
      this.editor.createBinding({
        type: 'connection',
        fromId: this.connectionId,
        toId: info.shapeId,
        props: {
          portId: info.portId,
          terminal: info.terminal,
        },
      });
    }
  }

  override onPointerMove: TLEventHandlers['onPointerMove'] = (info) => {
    if (!this.connectionId) return;

    const connection = this.editor.getShape(this.connectionId);
    if (!connection || !this.editor.isShapeOfType(connection, 'connection')) return;

    // Update the end point of the connection to follow the mouse
    const pagePoint = this.editor.inputs.currentPagePoint;
    const connectionTransform = this.editor.getShapePageTransform(this.connectionId);
    if (!connectionTransform) return;

    const localPoint = connectionTransform.clone().invert().applyToPoint(pagePoint);

    this.editor.updateShape({
      id: this.connectionId,
      type: 'connection',
      props: {
        end: { x: localPoint.x, y: localPoint.y },
      },
    });
  };

  override onPointerUp: TLEventHandlers['onPointerUp'] = () => {
    if (!this.connectionId) {
      this.editor.setCurrentTool('select');
      return;
    }

    // Check if we're over a valid target port
    const pagePoint = this.editor.inputs.currentPagePoint;
    const shapes = this.editor.getCurrentPageShapes();

    let targetShape: TLShapeId | null = null;
    let targetTerminal: 'start' | 'end' | null = null;

    for (const shape of shapes) {
      if (!this.editor.isShapeOfType(shape, 'custom-card')) continue;
      if (shape.id === this.shapeId) continue; // Can't connect to self

      const bounds = this.editor.getShapePageBounds(shape);
      if (!bounds) continue;

      // Check input port (left side)
      if (this.terminal === 'start') {
        const inputX = bounds.minX;
        const inputY = bounds.midY;
        const distance = Math.sqrt(
          Math.pow(pagePoint.x - inputX, 2) + Math.pow(pagePoint.y - inputY, 2)
        );

        if (distance < 30) {
          targetShape = shape.id;
          targetTerminal = 'end';
          break;
        }
      }
      // Check output port (right side)
      else if (this.terminal === 'end') {
        const outputX = bounds.maxX;
        const outputY = bounds.midY;
        const distance = Math.sqrt(
          Math.pow(pagePoint.x - outputX, 2) + Math.pow(pagePoint.y - outputY, 2)
        );

        if (distance < 30) {
          targetShape = shape.id;
          targetTerminal = 'start';
          break;
        }
      }
    }

    if (targetShape && targetTerminal) {
      // Create binding for the end point
      this.editor.createBinding({
        type: 'connection',
        fromId: this.connectionId,
        toId: targetShape,
        props: {
          portId: targetTerminal === 'start' ? 'output' : 'input',
          terminal: targetTerminal,
        },
      });

      console.log('✅ Connection created successfully');
    } else {
      // No valid target, delete the connection
      this.editor.deleteShapes([this.connectionId]);
      console.log('❌ Connection cancelled - no valid target');
    }

    this.connectionId = null;
    this.shapeId = null;
    this.portId = null;
    this.terminal = null;

    this.editor.setCurrentTool('select');
  };

  override onCancel() {
    if (this.connectionId) {
      this.editor.deleteShapes([this.connectionId]);
    }
    this.connectionId = null;
    this.shapeId = null;
    this.portId = null;
    this.terminal = null;
    this.editor.setCurrentTool('select');
  }
}
