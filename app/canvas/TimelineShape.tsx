import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  useEditor,
  Rectangle2d,
  createShapeId,
} from 'tldraw';
import { useState, useRef, useCallback } from 'react';

// 时间轴形状类型定义
export type TimelineShape = TLBaseShape<
  'timeline',
  {
    w: number;
    h: number;
    duration: number; // 总时长（秒）
    zoom: number; // 缩放级别
    shotType: '超远景' | '远景' | '全景' | '中远景' | '中景' | '中近景' | '特写'; // 景别类型
  }
>;

// @ts-expect-error - Custom shape types are not recognized by BaseBoxShapeUtil constraint
export class TimelineShapeUtil extends BaseBoxShapeUtil<TimelineShape> {
  static override type = 'timeline' as const;

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): TimelineShape['props'] {
    return {
      w: 800,
      h: 100,
      duration: 60,
      zoom: 1,
      shotType: '全景', // 默认景别
    };
  }

  override getGeometry(shape: TimelineShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: TimelineShape) {
    const { w, h, duration, zoom } = shape.props;
    const editor = useEditor();
    const timelineRef = useRef<HTMLDivElement>(null);

    // 每秒的像素宽度
    const pixelsPerSecond = (w / 60) * zoom;

    // 计算时间轴总宽度
    const timelineWidth = duration * pixelsPerSecond;

    // 开始连接 - 从时间轴锯齿拖出连接线
    const startConnection = useCallback((tickIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('🔵 时间轴连接点被点击，锯齿索引:', tickIndex);

      // 使用 PortTool 开始连接（和卡片一样的方式）
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: `tick-${tickIndex}`,
        terminal: 'start',
        tickIndex: tickIndex,
      });
    }, [editor, shape.id]);

    // 生成锯齿刻度
    const generateTicks = () => {
      const ticks = [];
      for (let i = 0; i <= duration; i++) {
        const position = i * pixelsPerSecond;
        // 每5秒一个大刻度，其他是小刻度
        const isLarge = i % 5 === 0;
        ticks.push({
          position,
          height: isLarge ? 24 : 6,
          index: i,
        });
      }
      return ticks;
    };

    // 增加30秒
    const addThirtySeconds = () => {
      editor.updateShape({
        id: shape.id,
        type: 'timeline' as any,
        props: {
          ...shape.props,
          duration: duration + 30,
        },
      });
    };

    // 缩放控制
    const handleZoomIn = () => {
      editor.updateShape({
        id: shape.id,
        type: 'timeline' as any,
        props: {
          ...shape.props,
          zoom: Math.min(zoom * 1.5, 5),
        },
      });
    };

    const handleZoomOut = () => {
      editor.updateShape({
        id: shape.id,
        type: 'timeline' as any,
        props: {
          ...shape.props,
          zoom: Math.max(zoom / 1.5, 0.2),
        },
      });
    };

    const ticks = generateTicks();

    return (
      <HTMLContainer
        style={{
          width: timelineWidth + 100,
          height: 80,
          pointerEvents: 'all',
          overflow: 'visible',
        }}
      >
        <div className="relative w-full h-full" style={{ overflow: 'visible' }}>
          {/* 横线 */}
          <div
            className="absolute left-0 h-0.5 bg-gray-400"
            style={{
              top: '40px',
              width: `${timelineWidth}px`,
            }}
          />

          {/* 锯齿刻度和连接点 */}
          {ticks.map((tick) => (
            <div
              key={tick.index}
              className="absolute"
              style={{
                left: `${tick.position}px`,
                top: '40px',
              }}
            >
              {/* 刻度线 */}
              <div
                className="absolute w-0.5 bg-gray-400"
                style={{
                  height: `${tick.height}px`,
                  bottom: '0px',
                  left: '0px',
                }}
              />

              {/* 连接点 - 每5秒的大刻度 */}
              {tick.index % 5 === 0 && (
                <div
                  className="absolute w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-400 hover:scale-110 transition-all cursor-crosshair border-2 border-white shadow-lg"
                  style={{
                    bottom: `${tick.height}px`,
                    left: '0px',
                    transform: 'translate(-50%, 50%)',
                    zIndex: 10,
                  }}
                  title={`连接点 ${tick.index}s`}
                  onMouseDown={(e) => startConnection(tick.index, e)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ))}

          {/* +30s 按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addThirtySeconds();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute px-3 py-1 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded-lg text-white text-xs font-semibold transition-all"
            style={{
              left: `${timelineWidth + 10}px`,
              top: '32px',
            }}
            title="增加30秒"
          >
            +30s
          </button>

          {/* 缩放控制按钮 */}
          <div className="absolute flex items-center gap-2" style={{ left: '0px', top: '55px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-6 h-6 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-sm transition-all"
              title="缩小"
            >
              −
            </button>
            <span className="text-xs text-gray-400 font-mono min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-6 h-6 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-sm transition-all"
              title="放大"
            >
              +
            </button>
          </div>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: TimelineShape) {
    return null;
  }
}
