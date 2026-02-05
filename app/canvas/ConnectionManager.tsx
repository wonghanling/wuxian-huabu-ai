'use client';

import { useEffect, useRef } from 'react';
import { Editor } from 'tldraw';

interface Connection {
  fromId: string;
  toId: string;
}

interface ConnectionManagerProps {
  editor: Editor | null;
  connections: Connection[];
  onConnectionsChange: (connections: Connection[]) => void;
}

export function ConnectionManager({ editor, connections, onConnectionsChange }: ConnectionManagerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tempLineRef = useRef<SVGPathElement | null>(null);
  const connectingRef = useRef<{ fromId: string; startX: number; startY: number } | null>(null);

  // 绘制贝塞尔曲线
  const drawCurve = (x1: number, y1: number, x2: number, y2: number): string => {
    const dist = Math.abs(x2 - x1) * 0.5;
    const cp1x = x1 + dist;
    const cp1y = y1;
    const cp2x = x2 - dist;
    const cp2y = y2;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  // 渲染所有连接线
  const renderConnections = () => {
    if (!editor || !svgRef.current) return;

    // 清除旧的连接线
    const existingLines = svgRef.current.querySelectorAll('.connection-line');
    existingLines.forEach(line => line.remove());

    // 绘制每条连接
    connections.forEach(conn => {
      const fromShape = editor.getShape(conn.fromId);
      const toShape = editor.getShape(conn.toId);

      if (fromShape && toShape) {
        const fromBounds = editor.getShapePageBounds(conn.fromId);
        const toBounds = editor.getShapePageBounds(conn.toId);

        if (fromBounds && toBounds) {
          const x1 = fromBounds.maxX;
          const y1 = fromBounds.midY;
          const x2 = toBounds.minX;
          const y2 = toBounds.midY;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', drawCurve(x1, y1, x2, y2));
          path.setAttribute('class', 'connection-line');
          path.setAttribute('stroke', '#a0a0a0');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.style.pointerEvents = 'none';

          svgRef.current?.appendChild(path);
        }
      }
    });
  };

  // 监听编辑器变化，重新渲染连接线
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.store.listen(() => {
      renderConnections();
    });

    renderConnections();

    return () => {
      unsubscribe();
    };
  }, [editor, connections]);

  // 处理鼠标移动 - 绘制临时连接线
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!connectingRef.current || !svgRef.current) return;

      // 移除旧的临时线
      if (tempLineRef.current) {
        tempLineRef.current.remove();
      }

      const { startX, startY } = connectingRef.current;
      const x2 = e.clientX;
      const y2 = e.clientY;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', drawCurve(startX, startY, x2, y2));
      path.setAttribute('stroke', '#a0a0a0');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.style.pointerEvents = 'none';

      svgRef.current.appendChild(path);
      tempLineRef.current = path;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (connectingRef.current) {
        // 检查是否松开在输入端口上
        const target = e.target as HTMLElement;
        const portElement = target.closest('[data-port-type="input"]') as HTMLElement;

        if (portElement) {
          // 获取目标卡片ID
          const toId = portElement.getAttribute('data-node-id');

          if (toId && toId !== connectingRef.current.fromId) {
            console.log('✅ 创建连接成功:', connectingRef.current.fromId, '->', toId);
            if ((window as any).endConnection) {
              (window as any).endConnection(toId);
            }
          } else {
            console.log('❌ 不能连接到自己');
          }
        } else {
          console.log('❌ 未松开在输入端口上，连接取消');
        }
      }

      // 清理临时线
      if (tempLineRef.current) {
        tempLineRef.current.remove();
        tempLineRef.current = null;
      }
      connectingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 暴露开始连接的方法
  useEffect(() => {
    (window as any).startConnection = (fromId: string, x: number, y: number) => {
      connectingRef.current = { fromId, startX: x, startY: y };
    };

    (window as any).endConnection = (toId: string) => {
      if (connectingRef.current && connectingRef.current.fromId !== toId) {
        const newConnections = [...connections, { fromId: connectingRef.current.fromId, toId }];
        onConnectionsChange(newConnections);
      }
      connectingRef.current = null;
      if (tempLineRef.current) {
        tempLineRef.current.remove();
        tempLineRef.current = null;
      }
    };
  }, [connections, onConnectionsChange]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
