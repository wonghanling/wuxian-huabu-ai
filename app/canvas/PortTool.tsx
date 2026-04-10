import { StateNode, TLEventHandlers, TLShapeId, createShapeId } from 'tldraw';

export class PortTool extends StateNode {
  static override id = 'port';

  private shapeId: TLShapeId | null = null;
  private portId: string | null = null;
  private terminal: 'start' | 'end' | null = null;
  private connectionId: TLShapeId | null = null;

  override onEnter(info?: { shapeId: TLShapeId; portId: string; terminal: 'start' | 'end'; tickIndex?: number }) {
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
      let portX, portY;

      // 检查是否是时间轴形状
      if ((shape as any).type === 'timeline' && info.tickIndex !== undefined) {
        // 时间轴：计算锯齿点的位置
        const { zoom, w } = (shape as any).props;
        const pixelsPerSecond = (w / 60) * zoom;
        portX = bounds.minX + info.tickIndex * pixelsPerSecond;
        portY = bounds.minY + 40; // 横线在 top: 40px
        console.log('🎯 时间轴端口位置:', { portX, portY, tickIndex: info.tickIndex });
      } else {
        // 卡片：使用左右端口
        portX = info.terminal === 'start' ? bounds.maxX : bounds.minX;
        portY = bounds.midY;
      }

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
          tickIndex: info.tickIndex, // 添加 tickIndex
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
    let targetTickIndex: number | undefined = undefined;

    for (const shape of shapes) {
      const shapeType = (shape as any).type;
      if (shape.id === this.shapeId) continue; // Can't connect to self

      const bounds = this.editor.getShapePageBounds(shape);
      if (!bounds) continue;

      // 检查时间轴
      if (shapeType === 'timeline') {
        const { duration, zoom, w } = (shape as any).props;
        const pixelsPerSecond = (w / 60) * zoom;

        // 扩展检测范围
        const expandedMinY = bounds.minY - 100;
        const expandedMaxY = bounds.maxY + 100;

        if (pagePoint.y >= expandedMinY && pagePoint.y <= expandedMaxY &&
            pagePoint.x >= bounds.minX - 50 && pagePoint.x <= bounds.maxX + 50) {

          const relativeX = pagePoint.x - bounds.minX;
          const tickIndex = Math.round(relativeX / pixelsPerSecond);

          if (tickIndex >= 0 && tickIndex <= duration && tickIndex % 5 === 0) {
            const tickX = bounds.minX + tickIndex * pixelsPerSecond;
            const distanceX = Math.abs(pagePoint.x - tickX);

            if (distanceX < 50) {
              targetShape = shape.id;
              targetTerminal = this.terminal === 'start' ? 'end' : 'start';
              targetTickIndex = tickIndex;
              console.log('✅ 找到时间轴目标:', { tickIndex, targetTerminal });
              break;
            }
          }
        }
      }

      // 检查卡片（支持所有带端口的卡片类型）
      if (shapeType === 'custom-card' || shapeType === 'shot-card' || shapeType === 'prompt-optimizer-card' || shapeType === 'seedance-card') {
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
          tickIndex: targetTickIndex,
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
