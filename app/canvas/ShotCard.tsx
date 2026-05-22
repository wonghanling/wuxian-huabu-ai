import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  useEditor,
  useValue,
  Rectangle2d,
} from 'tldraw';
import { useState } from 'react';

// 景别卡片形状类型定义
export type ShotCardShape = TLBaseShape<
  'shot-card',
  {
    w: number;
    h: number;
    shotType: '超远景' | '远景' | '全景' | '中远景' | '中景' | '中近景' | '特写';
    cameraMovement: string; // 运镜固定器选项
    directorThinking: string; // 导演思维侧重固定器选项（完整的7个选项组合）
    // 7个思维侧重的单独存储
    composition?: string; // 构图
    subjectScale?: string; // 主体比例
    spaceType?: string; // 空间类型
    timeFeeling?: string; // 时间感
    lighting?: string; // 光影/天气
    motionSource?: string; // 动态来源
    semantic?: string; // 语义
    isMinimized?: boolean; // 是否缩小状态
  }
>;

// @ts-expect-error - Custom shape types are not recognized by BaseBoxShapeUtil constraint
export class ShotCardShapeUtil extends BaseBoxShapeUtil<ShotCardShape> {
  static override type = 'shot-card' as const;

  override isAspectRatioLocked = () => false;
  override canResize = () => false;
  override canBind = () => true;

  getDefaultProps(): ShotCardShape['props'] {
    return {
      w: 220,
      h: 160,
      shotType: '全景',
      cameraMovement: 'Follow/Tracking',
      directorThinking: '未完成',
      composition: '',
      subjectScale: '',
      spaceType: '',
      timeFeeling: '',
      lighting: '',
      motionSource: '',
      semantic: '',
      isMinimized: false,
    };
  }

  override getGeometry(shape: ShotCardShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ShotCardShape) {
    const { w, h, shotType, cameraMovement, directorThinking, composition, subjectScale, spaceType, timeFeeling, lighting, motionSource, semantic, isMinimized } = shape.props;
    const editor = useEditor();

    const [showCameraMovementPanel, setShowCameraMovementPanel] = useState(false);
    const [showDirectorThinkingPanel, setShowDirectorThinkingPanel] = useState(false);
    const [showDirectorThinkingSubPanel, setShowDirectorThinkingSubPanel] = useState(false);
    const [selectedMainOption, setSelectedMainOption] = useState<string>('');

    // 临时存储7个选项的选择
    const [tempComposition, setTempComposition] = useState(composition || '');
    const [tempSubjectScale, setTempSubjectScale] = useState(subjectScale || '');
    const [tempSpaceType, setTempSpaceType] = useState(spaceType || '');
    const [tempTimeFeeling, setTempTimeFeeling] = useState(timeFeeling || '');
    const [tempLighting, setTempLighting] = useState(lighting || '');
    const [tempMotionSource, setTempMotionSource] = useState(motionSource || '');
    const [tempSemantic, setTempSemantic] = useState(semantic || '');

    const isInViewport = useValue('inViewport', () => {
      const vp = editor.getViewportPageBounds();
      const sb = editor.getShapePageBounds(shape.id);
      if (!sb) return true;
      return !(sb.maxX < vp.minX || sb.minX > vp.maxX || sb.maxY < vp.minY || sb.minY > vp.maxY);
    }, [editor, shape.id]);
    if (!isInViewport) {
      return <HTMLContainer><div style={{ width: w, height: h, background: '#18181b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>镜头卡</span></div></HTMLContainer>;
    }

    // 切换缩放
    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();

      const newMinimized = !isMinimized;
      const newW = newMinimized ? 120 : 220;
      const newH = newMinimized ? 60 : 160;

      editor.updateShape({
        id: shape.id,
        type: 'shot-card' as any,
        props: {
          ...shape.props,
          w: newW,
          h: newH,
          isMinimized: newMinimized,
        },
      });
    };

    // 根据景别类型获取运镜选项
    const getCameraMovementOptions = () => {
      switch (shotType) {
        case '超远景':
          return [
            { en: 'Static', zh: '固定' },
            { en: 'Slow Push In', zh: '缓慢推进' },
            { en: 'Pull Out', zh: '拉远' },
            { en: 'Lateral Move/Pan', zh: '横移' },
            { en: 'Aerial/Top-down', zh: '俯视/航拍' }
          ];
        case '远景':
          return [
            { en: 'Follow/Tracking', zh: '跟拍' },
            { en: 'Lateral Move', zh: '平移' },
            { en: 'Static', zh: '固定' },
            { en: 'Slow Push In', zh: '推进' },
            { en: 'Light Handheld', zh: '轻手持' }
          ];
        case '全景':
          return [
            { en: 'Follow/Tracking', zh: '跟拍' },
            { en: 'Lateral Move', zh: '平移' },
            { en: 'Static', zh: '固定' },
            { en: 'Slow Push In', zh: '推进' },
            { en: 'Light Handheld', zh: '轻手持' }
          ];
        case '中远景':
          return [
            { en: 'Follow', zh: '跟拍' },
            { en: 'Pan', zh: '摇移' },
            { en: 'Push In', zh: '推进' },
            { en: 'Static', zh: '固定' },
            { en: 'Smooth Drift', zh: '稳定器微移' }
          ];
        case '中景':
          return [
            { en: 'Static', zh: '固定' },
            { en: 'Micro Push', zh: '微推进' },
            { en: 'OTS', zh: '过肩' },
            { en: 'Dual Pan', zh: '双人平移' },
            { en: 'Stable Handheld', zh: '稳定手持' }
          ];
        case '中近景':
          return [
            { en: 'Static', zh: '静止' },
            { en: 'Slow Push', zh: '慢推' },
            { en: 'Subtle Pan', zh: '轻摇' },
            { en: 'Breathing Handheld', zh: '呼吸感手持' },
            { en: 'Cut-in Editing', zh: '切入剪辑' }
          ];
        case '特写':
          return [
            { en: 'Absolute Static', zh: '绝对静止' },
            { en: 'Micro Push', zh: '微距推进' },
            { en: 'Cut-in', zh: '瞬间切入' },
            { en: 'Focus Shift', zh: '焦点变化' },
            { en: 'Flash Insert', zh: '瞬闪' }
          ];
        default:
          return [{ en: 'Static', zh: '固定' }];
      }
    };

    // 导演思维侧重的7个主选项
    const directorThinkingMainOptions = [
      '主体位置',
      '主体比例',
      '空间类型',
      '时间感',
      '光影/天气',
      '动态来源',
      '语义'
    ];

    // 根据景别类型和主选项获取子选项
    const getDirectorThinkingSubOptions = (mainOption: string) => {
      switch (shotType) {
        case '超远景':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Bottom Left', zh: '左下' },
                { en: 'Bottom Center', zh: '下中' },
                { en: 'Bottom Right', zh: '右下' },
                { en: 'Center', zh: '中心' }
              ];
            case '主体比例':
              return [
                { en: '0%', zh: '无人' },
                { en: '<5%', zh: '极小' },
                { en: '5-10%', zh: '很小' }
              ];
            case '空间类型':
              return [
                { en: 'Open Natural', zh: '开放自然' },
                { en: 'Empty Vast', zh: '空旷辽阔' },
                { en: 'Urban Geometry', zh: '城市几何' },
                { en: 'Atmospheric Void', zh: '大气虚空' },
                { en: 'Industrial Large', zh: '工业大场景' }
              ];
            case '时间感':
              return [
                { en: 'Slow', zh: '缓慢' },
                { en: 'Frozen', zh: '停滞' }
              ];
            case '光影/天气':
              return [
                { en: 'Backlight', zh: '逆光' },
                { en: 'Fog', zh: '雾' },
                { en: 'Overcast', zh: '阴天' },
                { en: 'Sunrise-Sunset', zh: '日出日落' },
                { en: 'Neon Night', zh: '霓虹夜景' }
              ];
            case '动态来源':
              return [
                { en: 'Environment', zh: '环境' },
                { en: 'Crowd/Traffic', zh: '人群/交通' }
              ];
            case '语义':
              return [
                { en: 'Establish', zh: '建立世界观' },
                { en: 'Pressure', zh: '压力' },
                { en: 'Release', zh: '释放' }
              ];
            default:
              return [];
          }
        case '远景':
        case '全景':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Middle Left', zh: '左中' },
                { en: 'Center', zh: '中心' },
                { en: 'Middle Right', zh: '右中' },
                { en: 'Bottom Left', zh: '左下' },
                { en: 'Bottom Center', zh: '下中' },
                { en: 'Bottom Right', zh: '右下' }
              ];
            case '主体比例':
              return [
                { en: '20-40%', zh: '正常' },
                { en: '10-20%', zh: '略小' }
              ];
            case '空间类型':
              return [
                { en: 'Urban Geometry', zh: '城市几何' },
                { en: 'Open Natural', zh: '开放自然' },
                { en: 'Crowded Public', zh: '拥挤公共' },
                { en: 'Empty Vast', zh: '空旷辽阔' },
                { en: 'Corridor', zh: '走廊' }
              ];
            case '时间感':
              return [
                { en: 'Normal', zh: '正常' },
                { en: 'Rushed', zh: '急促' }
              ];
            case '光影/天气':
              return [
                { en: 'Soft Daylight', zh: '柔和日光' },
                { en: 'Overcast', zh: '阴天' },
                { en: 'Neon Night', zh: '霓虹夜景' }
              ];
            case '动态来源':
              return [
                { en: 'Subject Walk/Run', zh: '人物行走/奔跑' },
                { en: 'Crowd/Traffic', zh: '人群/交通' }
              ];
            case '语义':
              return [
                { en: 'Advance', zh: '推进' },
                { en: 'Establish', zh: '建立' }
              ];
            default:
              return [];
          }
        case '中远景':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Middle Left', zh: '左中' },
                { en: 'Center', zh: '中心' },
                { en: 'Middle Right', zh: '右中' },
                { en: 'Bottom Center', zh: '下中' }
              ];
            case '主体比例':
              return [
                { en: '40-60%', zh: '正常' },
                { en: '20-40%', zh: '略小' }
              ];
            case '空间类型':
              return [
                { en: 'Corridor', zh: '走廊' },
                { en: 'Interior Room', zh: '室内房间' },
                { en: 'Street', zh: '街道' },
                { en: 'Vehicle Interior', zh: '车内' }
              ];
            case '时间感':
              return [
                { en: 'Normal', zh: '正常' },
                { en: 'Slight Slow', zh: '略慢' }
              ];
            case '光影/天气':
              return [
                { en: 'Practical Interior', zh: '实用室内光' },
                { en: 'Overcast', zh: '阴天' },
                { en: 'Neon Night', zh: '霓虹夜景' }
              ];
            case '动态来源':
              return [
                { en: 'Subject Walk/Run', zh: '人物行走/奔跑' },
                { en: 'Camera Motion', zh: '镜头运动' }
              ];
            case '语义':
              return [
                { en: 'Advance', zh: '推进' },
                { en: 'Pressure', zh: '压力' }
              ];
            default:
              return [];
          }
        case '中景':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Left Third', zh: '左中（三分线）' },
                { en: 'Center', zh: '中心' },
                { en: 'Right Third', zh: '右中' }
              ];
            case '主体比例':
              return [{ en: '60-80%', zh: '正常' }];
            case '空间类型':
              return [
                { en: 'Interior Room', zh: '室内房间' },
                { en: 'Corridor', zh: '走廊' },
                { en: 'Crowded Public', zh: '拥挤公共' }
              ];
            case '时间感':
              return [{ en: 'Normal', zh: '正常' }];
            case '光影/天气':
              return [
                { en: 'Practical Interior', zh: '实用室内光' },
                { en: 'Soft Daylight', zh: '柔和日光' }
              ];
            case '动态来源':
              return [{ en: 'Subject Micro+Dialogue', zh: '微动作+对话' }];
            case '语义':
              return [
                { en: 'Pressure', zh: '压力' },
                { en: 'Advance', zh: '推进' }
              ];
            default:
              return [];
          }
        case '中近景':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Left Third', zh: '左三分' },
                { en: 'Center', zh: '中心' },
                { en: 'Right Third', zh: '右三分' }
              ];
            case '主体比例':
              return [
                { en: '60-80%', zh: '正常' },
                { en: '80-90%', zh: '更贴脸' }
              ];
            case '空间类型':
              return [
                { en: 'Interior Room', zh: '室内房间' },
                { en: 'Vehicle Interior', zh: '车内' }
              ];
            case '时间感':
              return [
                { en: 'Stretched', zh: '拉长' },
                { en: 'Slow', zh: '缓慢' }
              ];
            case '光影/天气':
              return [
                { en: 'Soft Daylight', zh: '柔和日光' },
                { en: 'Backlight', zh: '逆光' },
                { en: 'Neon Night', zh: '霓虹夜景' }
              ];
            case '动态来源':
              return [{ en: 'Subject Micro', zh: '微表情' }];
            case '语义':
              return [
                { en: 'Approach', zh: '靠近' },
                { en: 'Pressure', zh: '压力' }
              ];
            default:
              return [];
          }
        case '特写':
          switch (mainOption) {
            case '主体位置':
              return [
                { en: 'Center', zh: '中心' },
                { en: 'Left Third', zh: '左三分' },
                { en: 'Right Third', zh: '右三分' }
              ];
            case '主体比例':
              return [{ en: '>90%', zh: '极大' }];
            case '空间类型':
              return [{ en: 'Atmospheric Void', zh: '大气虚空' }];
            case '时间感':
              return [{ en: 'Instant', zh: '瞬间' }];
            case '光影/天气':
              return [
                { en: 'High Contrast', zh: '高对比' },
                { en: 'Symbolic light', zh: '符号化光影' }
              ];
            case '动态来源':
              return [
                { en: 'None', zh: '无' },
                { en: 'Subject Micro', zh: '微表情' }
              ];
            case '语义':
              return [{ en: 'Reveal', zh: '揭示真相' }];
            default:
              return [];
          }
        default:
          return [];
      }
    };

    const cameraMovementOptions = getCameraMovementOptions();

    // 更新运镜固定器
    const updateCameraMovement = (value: string) => {
      editor.updateShape({
        id: shape.id,
        type: 'shot-card' as any,
        props: {
          ...shape.props,
          cameraMovement: value,
        },
      });
      setShowCameraMovementPanel(false);
    };

    // 更新导演思维侧重固定器 - 保存已选择的选项（可选）
    const confirmDirectorThinking = () => {
      // 检查是否至少选择了一个选项
      if (!tempComposition && !tempSubjectScale && !tempSpaceType && !tempTimeFeeling && !tempLighting && !tempMotionSource && !tempSemantic) {
        alert('请至少选择一个思维侧重选项');
        return;
      }

      // 组合成完整的描述（只包含已选择的选项）
      const selectedOptions = [];
      if (tempComposition) selectedOptions.push(`构图:${tempComposition}`);
      if (tempSubjectScale) selectedOptions.push(`主体比例:${tempSubjectScale}`);
      if (tempSpaceType) selectedOptions.push(`空间:${tempSpaceType}`);
      if (tempTimeFeeling) selectedOptions.push(`时间:${tempTimeFeeling}`);
      if (tempLighting) selectedOptions.push(`光影:${tempLighting}`);
      if (tempMotionSource) selectedOptions.push(`动态:${tempMotionSource}`);
      if (tempSemantic) selectedOptions.push(`语义:${tempSemantic}`);

      const fullDescription = selectedOptions.join(' | ');

      editor.updateShape({
        id: shape.id,
        type: 'shot-card' as any,
        props: {
          ...shape.props,
          directorThinking: fullDescription,
          composition: tempComposition,
          subjectScale: tempSubjectScale,
          spaceType: tempSpaceType,
          timeFeeling: tempTimeFeeling,
          lighting: tempLighting,
          motionSource: tempMotionSource,
          semantic: tempSemantic,
        },
      });
      setShowDirectorThinkingPanel(false);
      setShowDirectorThinkingSubPanel(false);
    };

    // 点击主选项，显示子选项面板
    const handleMainOptionClick = (mainOption: string) => {
      setSelectedMainOption(mainOption);
      setShowDirectorThinkingSubPanel(true);
    };

    // 清除某个选项
    const clearOption = (mainOption: string, e: React.MouseEvent) => {
      e.stopPropagation();
      switch (mainOption) {
        case '主体位置':
          setTempComposition('');
          break;
        case '主体比例':
          setTempSubjectScale('');
          break;
        case '空间类型':
          setTempSpaceType('');
          break;
        case '时间感':
          setTempTimeFeeling('');
          break;
        case '光影/天气':
          setTempLighting('');
          break;
        case '动态来源':
          setTempMotionSource('');
          break;
        case '语义':
          setTempSemantic('');
          break;
      }
    };

    // 清除所有选项
    const clearAllOptions = (e: React.MouseEvent) => {
      e.stopPropagation();
      setTempComposition('');
      setTempSubjectScale('');
      setTempSpaceType('');
      setTempTimeFeeling('');
      setTempLighting('');
      setTempMotionSource('');
      setTempSemantic('');
    };

    // 选择子选项
    const handleSubOptionClick = (mainOption: string, subOption: string) => {
      switch (mainOption) {
        case '主体位置':
          setTempComposition(subOption);
          break;
        case '主体比例':
          setTempSubjectScale(subOption);
          break;
        case '空间类型':
          setTempSpaceType(subOption);
          break;
        case '时间感':
          setTempTimeFeeling(subOption);
          break;
        case '光影/天气':
          setTempLighting(subOption);
          break;
        case '动态来源':
          setTempMotionSource(subOption);
          break;
        case '语义':
          setTempSemantic(subOption);
          break;
      }
      setShowDirectorThinkingSubPanel(false);
    };

    // 获取当前主选项的已选值
    const getCurrentSelection = (mainOption: string) => {
      switch (mainOption) {
        case '主体位置':
          return tempComposition;
        case '主体比例':
          return tempSubjectScale;
        case '空间类型':
          return tempSpaceType;
        case '时间感':
          return tempTimeFeeling;
        case '光影/天气':
          return tempLighting;
        case '动态来源':
          return tempMotionSource;
        case '语义':
          return tempSemantic;
        default:
          return '';
      }
    };

    // 开始连接 - 从输出端口拖出连接线
    const startConnection = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('🔵 景别卡片输出端口被点击');

      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'output',
        terminal: 'start',
      });
    };

    // 开始连接 - 从输入端口拖出连接线
    const startInputConnection = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('🔵 景别卡片输入端口被点击');

      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'input',
        terminal: 'end',
      });
    };

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
          overflow: 'visible',
        }}
      >
        <div className="relative w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg transition-all duration-300">
          {/* 景别类型标签 */}
          <div className="absolute -top-2 left-2 px-2 py-0.5 bg-yellow-500 rounded text-black text-xs font-bold shadow-md">
            {shotType}
          </div>

          {/* 缩放按钮 */}
          <button
            onClick={toggleMinimize}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-2 right-2 w-5 h-5 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded flex items-center justify-center text-white text-xs transition-all"
            title={isMinimized ? "展开" : "缩小"}
          >
            {isMinimized ? '+' : '−'}
          </button>

          {/* 缩小状态 - 只显示标题 */}
          {isMinimized ? (
            <div className="p-2 pt-3 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-white text-[10px] font-medium">{shotType}</div>
                <div className="text-gray-400 text-[8px] mt-0.5">点击+展开</div>
              </div>
            </div>
          ) : (
            /* 正常状态 - 显示所有内容 */
            <div className="p-3 pt-4 space-y-2">
            {/* 运镜固定器 */}
            <div className="relative">
              <div className="text-xs text-gray-400 mb-1 font-medium">运镜固定器（必选）</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCameraMovementPanel(!showCameraMovementPanel);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white text-xs transition-all text-left flex items-center justify-between"
              >
                <span className="truncate flex-1">{cameraMovement}</span>
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 运镜选项面板 */}
              {showCameraMovementPanel && (
                <div className="absolute left-0 top-full mt-1 w-full bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-1 z-50 max-h-40 overflow-y-auto">
                  {cameraMovementOptions.map((option) => (
                    <button
                      key={option.en}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCameraMovement(option.en);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`w-full px-2 py-1.5 rounded text-xs transition-all text-left ${
                        cameraMovement === option.en
                          ? 'bg-green-500/20 text-green-300 font-medium'
                          : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{option.en}</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">{option.zh}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 导演思维侧重固定器 */}
            <div className="relative">
              <div className="text-[10px] text-gray-400 mb-1 font-medium flex items-center justify-between">
                <span>导演思维侧重（可选）</span>
                <span className="text-[8px] text-gray-500">
                  {[tempComposition, tempSubjectScale, tempSpaceType, tempTimeFeeling, tempLighting, tempMotionSource, tempSemantic].filter(Boolean).length}/7
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDirectorThinkingPanel(!showDirectorThinkingPanel);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white text-[9px] transition-all text-left flex items-center justify-between"
              >
                <span className="truncate flex-1">{directorThinking}</span>
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 导演思维选项面板 - 显示7个主选项 */}
              {showDirectorThinkingPanel && (
                <div className="absolute left-0 top-full mt-1 w-full bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-2 z-50">
                  {directorThinkingMainOptions.map((option) => {
                    const currentSelection = getCurrentSelection(option);
                    return (
                      <button
                        key={option}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMainOptionClick(option);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`w-full px-2 py-1.5 mb-1 rounded text-[9px] transition-all text-left flex items-center justify-between ${
                          currentSelection ? 'bg-green-500/20 border border-green-400/30' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex-1">
                          <div className={`font-medium ${currentSelection ? 'text-green-300' : 'text-white'}`}>
                            {option}
                          </div>
                          {currentSelection && (
                            <div className="text-[8px] text-green-400 mt-0.5 truncate">
                              {currentSelection}
                            </div>
                          )}
                        </div>
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}

                  {/* 按钮组 */}
                  <div className="flex gap-2 mt-2">
                    {/* 全部清除按钮 */}
                    {[tempComposition, tempSubjectScale, tempSpaceType, tempTimeFeeling, tempLighting, tempMotionSource, tempSemantic].filter(Boolean).length > 0 && (
                      <button
                        onClick={(e) => clearAllOptions(e)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded text-red-300 text-[10px] font-bold transition-all"
                      >
                        全部清除
                      </button>
                    )}
                    {/* 确定按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDirectorThinking();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 rounded text-black text-[10px] font-bold transition-all"
                    >
                      确定 ({[tempComposition, tempSubjectScale, tempSpaceType, tempTimeFeeling, tempLighting, tempMotionSource, tempSemantic].filter(Boolean).length}/7)
                    </button>
                  </div>
                </div>
              )}

              {/* 导演思维子选项面板 - 显示具体选项（带圆圈） */}
              {showDirectorThinkingSubPanel && selectedMainOption && (
                <div className="absolute left-full top-0 ml-1 w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-2 z-50 max-h-48 overflow-y-auto">
                  <div className="text-[9px] text-yellow-400 font-medium px-2 py-1 border-b border-white/10 mb-2">
                    {selectedMainOption}
                  </div>
                  {getDirectorThinkingSubOptions(selectedMainOption).map((subOption) => {
                    const currentSelection = getCurrentSelection(selectedMainOption);
                    const isSelected = currentSelection === subOption.en;
                    return (
                      <div key={subOption.en} className="flex items-center justify-between px-2 py-1.5 mb-1 rounded hover:bg-white/5 transition-all">
                        <div className="flex-1 text-left">
                          <div className="text-[9px] text-white leading-tight">{subOption.en}</div>
                          <div className="text-[7px] text-gray-500 mt-0.5">{subOption.zh}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubOptionClick(selectedMainOption, subOption.en);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-2 ${
                            isSelected
                              ? 'bg-green-500 border-green-400'
                              : 'bg-transparent border-gray-500 hover:border-gray-400'
                          }`}
                          title={isSelected ? '已选中' : '点击选择'}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* 输入端口 - 使用蓝色 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{
            left: '-8px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="input"
          data-node-id={shape.id}
          onMouseDown={startInputConnection}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="输入端口"
        >
          <div
            className="w-4 h-4 rounded-full bg-blue-500 group-hover:bg-blue-400 group-hover:scale-125 transition-all border-2 border-white shadow-lg"
            style={{
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 输出端口 - 使用绿色 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{
            right: '-8px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="output"
          data-node-id={shape.id}
          onMouseDown={startConnection}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="输出端口"
        >
          <div
            className="w-4 h-4 rounded-full bg-green-500 group-hover:bg-green-400 group-hover:scale-125 transition-all border-2 border-white shadow-lg"
            style={{
              pointerEvents: 'none',
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: ShotCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
