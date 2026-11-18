import React, { useRef, useState } from 'react';
import {
  ArrowUpDown,
  Box,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Copy,
  Crosshair,
  Eye,
  FlipHorizontal,
  Focus,
  GitMerge,
  Grid,
  Hand,
  Layers,
  Link2,
  Maximize2,
  Minimize2,
  Move,
  PaintBucket,
  Plus,
  RefreshCw,
  RotateCw,
  Scissors,
  ScissorsLineDashed,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Waypoints,
  Wrench,
  X,
} from 'lucide-react';
import {
  DeleteActionType,
  EdgeSelectionTool,
} from '../core/mesh/advancedOperations';
import { EditSelectionMode } from '../core/mesh/operations';
import { PrimitiveOptions, PrimitiveType } from '../core/mesh/primitives';
import {
  clampProportionalRadius,
  PROPORTIONAL_FALLOFF_LIST,
  ProportionalEditingSettings,
  ProportionalFalloff,
} from '../core/mesh/proportionalEditing';
import {
  loadLeftToolbarCollapsed,
  saveLeftToolbarCollapsed,
} from '../core/project/storage';
import {
  AxisConstraint,
  MoveSubMode,
  TouchControlSettings,
  TouchModifierKey,
  TouchModifierState,
  TransformTool,
  WorkMode,
} from '../core/project/types';
import { EditOperatorType } from '../state/useModelerStore';
import { DeleteMenuPopover } from './DeleteMenuPopover';
import { PrimitiveMenu } from './PrimitiveMenu';
import { FalloffCurveIcon, ProportionalIcon } from './ProportionalIcons';

type SidebarSectionId =
  | 'selection'
  | 'transform'
  | 'selectionModes'
  | 'modifiers'
  | 'modeling'
  | 'geometryEdit'
  | 'normalsDisplay'
  | 'proportional'
  | 'additional';

interface LeftToolSidebarProps {
  workMode: WorkMode;
  editSelectionMode: EditSelectionMode;
  edgeSelectionTool: EdgeSelectionTool;
  activeTool: TransformTool;
  moveSubMode: MoveSubMode;
  axisConstraint: AxisConstraint;
  activeOperatorType: EditOperatorType | null;
  modalTransformMode?: 'move' | 'vertex_slide' | 'edge_slide' | null;
  canEditSelected: boolean;
  hasSelectedObject: boolean;
  hasSelectedComponents: boolean;
  multiSelectTouch: boolean;
  xrayEditMode: boolean;
  showFaceOrientation: boolean;
  showGrid: boolean;
  proportionalConfig: ProportionalEditingSettings;
  proportionalModifierWarning?: string | null;
  touchSettings: TouchControlSettings;
  effectiveModifiers: TouchModifierState;
  screenModifiers: TouchModifierState;
  onSelectTool: (tool: TransformTool) => void;
  onSelectMoveSubMode: (mode: MoveSubMode) => void;
  onChangeAxisConstraint: (axis: AxisConstraint) => void;
  onGQuickTapMove: () => void;
  onGHoldSlide: () => void;
  onToggleWorkMode: (mode: WorkMode) => void;
  onChangeEditSelectionMode: (mode: EditSelectionMode) => void;
  onChangeEdgeSelectionTool: (tool: EdgeSelectionTool) => void;
  onToggleMultiSelectTouch: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectConnected: () => void;
  onSetModifier: (key: TouchModifierKey, active: boolean) => void;
  onToggleModifier: (key: TouchModifierKey) => void;
  onReleaseAllModifiers: () => void;
  onStartOperator: (type: EditOperatorType) => void;
  onFillSelection: () => void;
  onConnectVertexPath: () => void;
  onExecuteContextualDelete: (action: DeleteActionType) => void;
  onToggleFaceOrientation: () => void;
  onRecalculateOutside: () => void;
  onFlipNormals: () => void;
  onToggleXray: () => void;
  onToggleGrid: () => void;
  onToggleProportional: () => void;
  onToggleProportionalConnected: () => void;
  onChangeProportionalFalloff: (falloff: ProportionalFalloff) => void;
  onChangeProportionalRadius: (radius: number) => void;
  onAddPrimitive: (type: PrimitiveType, options?: PrimitiveOptions) => void;
  onDuplicateObject: () => void;
  onApplyObjectTransform: () => void;
  onCenterObjectOrigin: () => void;
  onSeparateSelectedGeometry: () => void;
  onFocusCamera: () => void;
  onOpenToolSettings: () => void;
}

const G_HOLD_THRESHOLD_MS = 400;

export const LeftToolSidebar: React.FC<LeftToolSidebarProps> = ({
  workMode,
  editSelectionMode,
  edgeSelectionTool,
  activeTool,
  moveSubMode,
  axisConstraint,
  activeOperatorType,
  modalTransformMode = null,
  canEditSelected,
  hasSelectedObject,
  hasSelectedComponents,
  multiSelectTouch,
  xrayEditMode,
  showFaceOrientation,
  showGrid,
  proportionalConfig,
  proportionalModifierWarning = null,
  touchSettings,
  effectiveModifiers,
  screenModifiers,
  onSelectTool,
  onSelectMoveSubMode,
  onChangeAxisConstraint,
  onGQuickTapMove,
  onGHoldSlide,
  onToggleWorkMode,
  onChangeEditSelectionMode,
  onChangeEdgeSelectionTool,
  onToggleMultiSelectTouch,
  onSelectAll,
  onDeselectAll,
  onSelectConnected,
  onSetModifier,
  onToggleModifier,
  onReleaseAllModifiers,
  onStartOperator,
  onFillSelection,
  onConnectVertexPath,
  onExecuteContextualDelete,
  onToggleFaceOrientation,
  onRecalculateOutside,
  onFlipNormals,
  onToggleXray,
  onToggleGrid,
  onToggleProportional,
  onToggleProportionalConnected,
  onChangeProportionalFalloff,
  onChangeProportionalRadius,
  onAddPrimitive,
  onDuplicateObject,
  onApplyObjectTransform,
  onCenterObjectOrigin,
  onSeparateSelectedGeometry,
  onFocusCamera,
  onOpenToolSettings,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    loadLeftToolbarCollapsed(),
  );
  const [openSections, setOpenSections] = useState<
    Record<SidebarSectionId, boolean>
  >({
    selection: true,
    transform: true,
    selectionModes: true,
    modifiers: true,
    modeling: true,
    geometryEdit: true,
    normalsDisplay: false,
    proportional: proportionalConfig.enabled,
    additional: false,
  });
  const [showPrimitivePopover, setShowPrimitivePopover] = useState(false);
  const [showDeletePopover, setShowDeletePopover] = useState(false);

  const gHoldTimerRef = useRef<number | null>(null);
  const gHoldTriggeredRef = useRef(false);
  const gPointerIdRef = useRef<number | null>(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveLeftToolbarCollapsed(next);
      return next;
    });
  };

  const toggleSection = (id: SidebarSectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearGHoldTimer = () => {
    if (gHoldTimerRef.current !== null) {
      window.clearTimeout(gHoldTimerRef.current);
      gHoldTimerRef.current = null;
    }
  };

  const handleGPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    clearGHoldTimer();
    gHoldTriggeredRef.current = false;
    gPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture edge cases
    }
    gHoldTimerRef.current = window.setTimeout(() => {
      gHoldTimerRef.current = null;
      gHoldTriggeredRef.current = true;
      onGHoldSlide();
    }, G_HOLD_THRESHOLD_MS);
  };

  const handleGPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (gPointerIdRef.current !== e.pointerId) return;
    gPointerIdRef.current = null;
    clearGHoldTimer();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release edge cases
    }
    if (!gHoldTriggeredRef.current) {
      onGQuickTapMove();
    }
  };

  const handleGPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    gPointerIdRef.current = null;
    clearGHoldTimer();
    gHoldTriggeredRef.current = false;
  };

  const transformItems: {
    id: Extract<TransformTool, 'move' | 'rotate' | 'scale' | 'all'>;
    label: string;
    title: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'move',
      label: 'Mover',
      title: 'Gizmo Mover (X, Y, Z)',
      icon: <Move className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'rotate',
      label: 'Rotar',
      title: 'Gizmo Rotar (anillos)',
      icon: <RotateCw className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'scale',
      label: 'Escalar',
      title: 'Gizmo Escalar (ejes)',
      icon: <Maximize2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'all',
      label: 'Todo',
      title: 'Gizmo combinado (Mover + Rotar + Escalar)',
      icon: (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="4.5" strokeDasharray="3 2" />
          <path d="M8 1.5v3M8 1.5l-1.3 1.3M8 1.5l1.3 1.3" />
          <path d="M14.5 8h-3M14.5 8l-1.3-1.3M14.5 8l-1.3 1.3" />
          <rect x="6.6" y="6.6" width="2.8" height="2.8" fill="currentColor" />
        </svg>
      ),
    },
  ];

  const modelingItems: {
    id: EditOperatorType;
    label: string;
    title: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'extrude',
      label: 'Extruir',
      title: 'Extruir selección (E)',
      icon: <FlipHorizontal className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'inset',
      label: 'Insertar',
      title: 'Insertar caras (I)',
      icon: <Square className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'subdivide',
      label: 'Subdividir',
      title: 'Subdividir geometría',
      icon: <Grid className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'bevel',
      label: 'Biselar',
      title: 'Biselar vértices o aristas (B)',
      icon: <Columns className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'loop_cut',
      label: 'Corte Bucle',
      title: 'Corte de bucle (K)',
      icon: <Scissors className="w-4 h-4 shrink-0" />,
    },
  ];

  const buttonClass = (active: boolean, disabled = false, danger = false) =>
    `w-full min-h-[40px] rounded-lg border flex items-center ${
      collapsed ? 'justify-center px-0' : 'justify-start px-2.5 gap-2'
    } text-xs font-medium transition-colors touch-manipulation ${
      disabled
        ? 'bg-[#1a1c22] border-transparent text-[#525866] cursor-not-allowed'
        : active
          ? 'bg-[#5ecd6e] border-[#7def8e] text-[#111215] font-semibold shadow-sm'
          : danger
            ? 'bg-[#261a1d] hover:bg-[#352024] border-[#4a2b31] text-[#fca5a5]'
            : 'bg-[#20232b] hover:bg-[#2a2f3a] active:bg-[#323846] border-[#2e3340] text-[#d1d5db] hover:text-white'
    }`;

  const renderSectionToggle = (
    id: SidebarSectionId,
    title: string,
    badge?: React.ReactNode,
  ) => {
    if (collapsed) {
      return <div className="my-1 border-t border-[#2a2e38]" />;
    }
    const isOpen = openSections[id];
    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isOpen}
        className="w-full pt-2 pb-1 px-1 flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8a93a4] hover:text-[#e4e6eb] transition-colors select-none"
      >
        <span className="truncate flex items-center gap-1.5">
          <span>{title}</span>
          {badge}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#6e7685]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#6e7685]" />
        )}
      </button>
    );
  };

  const anyModifierActive =
    effectiveModifiers.shift || effectiveModifiers.ctrl || effectiveModifiers.alt;
  const isHoldMode = touchSettings.modifierPanelMode === 'hold';
  const radiusText =
    proportionalConfig.radius >= 10
      ? proportionalConfig.radius.toFixed(1)
      : proportionalConfig.radius.toFixed(2);

  const visibleModifierKeys = (['shift', 'ctrl', 'alt'] as TouchModifierKey[]).filter(
    (k) =>
      touchSettings.modifiers[k].enabled &&
      touchSettings.modifiers[k].showScreenButton,
  );

  return (
    <aside
      data-testid="left-tool-sidebar"
      aria-label="Barra lateral de herramientas"
      onPointerDown={(e) => e.stopPropagation()}
      className={`relative shrink-0 h-full bg-[#17191e] border-r border-[#2b2e37] flex flex-col select-none z-20 transition-[width] duration-150 ${
        collapsed ? 'w-[54px]' : 'w-[218px]'
      }`}
    >
      {/* Top Collapse/Expand Header */}
      <div
        className={`h-10 px-1.5 border-b border-[#272b34] flex items-center shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <span className="pl-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] whitespace-nowrap">
            Herramientas
          </span>
        )}
        <button
          type="button"
          data-testid="left-sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'}
          aria-label={
            collapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'
          }
          aria-expanded={!collapsed}
          className="w-9 h-8 rounded-md bg-[#22252d] hover:bg-[#2c313c] border border-[#323744] text-[#d1d5db] hover:text-[#5ecd6e] flex items-center justify-center transition-colors touch-manipulation"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Scrollable Categories */}
      <div className="flex-1 min-h-0 overflow-y-auto cad-scroll px-1.5 py-1.5 flex flex-col gap-1">
        {/* 1. SELECCIÓN */}
        {renderSectionToggle('selection', 'Selección')}
        {(collapsed || openSections.selection) && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              data-testid="sidebar-multi-select"
              onClick={onToggleMultiSelectTouch}
              aria-pressed={multiSelectTouch}
              title="Selección múltiple por toque"
              className={buttonClass(multiSelectTouch)}
            >
              <Layers className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">Selección múltiple</span>
              )}
            </button>

            <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1'}>
              <button
                type="button"
                data-testid="sidebar-select-all"
                disabled={workMode === 'edit' && !canEditSelected}
                onClick={onSelectAll}
                title="Seleccionar todo (A)"
                className={buttonClass(
                  false,
                  workMode === 'edit' && !canEditSelected,
                )}
              >
                <CheckSquare className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Todo</span>}
              </button>

              <button
                type="button"
                data-testid="sidebar-deselect-all"
                disabled={
                  workMode === 'edit' ? !hasSelectedComponents : !hasSelectedObject
                }
                onClick={onDeselectAll}
                title="Limpiar selección (Alt+A)"
                className={buttonClass(
                  false,
                  workMode === 'edit' ? !hasSelectedComponents : !hasSelectedObject,
                )}
              >
                <X className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Limpiar</span>}
              </button>
            </div>

            {workMode === 'edit' && (
              <button
                type="button"
                data-testid="sidebar-select-connected"
                disabled={!canEditSelected || !hasSelectedComponents}
                onClick={onSelectConnected}
                title="Seleccionar componentes conectados (Isla / L)"
                className={buttonClass(
                  false,
                  !canEditSelected || !hasSelectedComponents,
                )}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">Selec. conectados</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* 2. TRANSFORMACIÓN */}
        {renderSectionToggle('transform', 'Transformación')}
        {(collapsed || openSections.transform) && (
          <div className="flex flex-col gap-1">
            {transformItems.map((item) => {
              const isActive = activeTool === item.id && !activeOperatorType;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`sidebar-tool-${item.id}`}
                  disabled={!hasSelectedObject}
                  onClick={() => onSelectTool(item.id)}
                  title={item.title}
                  aria-label={item.title}
                  aria-pressed={isActive}
                  className={buttonClass(isActive, !hasSelectedObject)}
                >
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            {!collapsed && activeTool === 'move' && (
              <div
                data-testid="sidebar-move-submodes"
                className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#121419] border border-[#282c36]"
              >
                {(
                  [
                    { id: 'free', label: 'Free', title: 'Movimiento libre' },
                    { id: 'axis', label: 'Axis', title: 'Restringido a eje X/Y/Z' },
                    { id: 'slide', label: 'Slide', title: 'Deslizar sobre topología' },
                  ] as const
                ).map((sub) => {
                  const isActive = moveSubMode === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      data-testid={`move-submode-${sub.id}`}
                      aria-pressed={isActive}
                      title={sub.title}
                      onClick={() => onSelectMoveSubMode(sub.id)}
                      className={`h-8 rounded text-[11px] font-semibold transition-colors touch-manipulation ${
                        isActive
                          ? sub.id === 'slide'
                            ? 'bg-[#22d3ee] text-[#0f1115]'
                            : 'bg-[#5ecd6e] text-[#111215]'
                          : 'bg-[#1e2129] hover:bg-[#2a2f3a] text-[#cbd5e1] hover:text-white'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}

            {!collapsed && (
              <div
                className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#121419] border border-[#282c36]"
                aria-label="Restricción de eje"
              >
                {(
                  [
                    { id: 'free', label: 'Libre', active: 'bg-[#5ecd6e] text-[#111215]' },
                    { id: 'x', label: 'X', active: 'bg-[#e05252] text-white' },
                    { id: 'y', label: 'Y', active: 'bg-[#52b852] text-white' },
                    { id: 'z', label: 'Z', active: 'bg-[#48bce8] text-[#111215]' },
                  ] as const
                ).map((ax) => (
                  <button
                    key={ax.id}
                    type="button"
                    data-testid={`sidebar-axis-${ax.id}`}
                    aria-pressed={axisConstraint === ax.id}
                    onClick={() => onChangeAxisConstraint(ax.id)}
                    className={`h-8 rounded text-[11px] font-bold transition-colors touch-manipulation ${
                      axisConstraint === ax.id
                        ? ax.active
                        : 'bg-[#1e2129] hover:bg-[#2a2f3a] text-[#b4bac4] hover:text-white'
                    }`}
                  >
                    {ax.label}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Move / Hold Slide (G) */}
            <button
              type="button"
              data-testid="sidebar-g-modal"
              disabled={!hasSelectedObject}
              onPointerDown={handleGPointerDown}
              onPointerUp={handleGPointerUp}
              onPointerCancel={handleGPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              title="Toque rápido: Mover modal (G) · Mantener 0.4s: Vertex/Edge Slide"
              className={buttonClass(
                modalTransformMode !== null,
                !hasSelectedObject,
              )}
            >
              <span className="w-4 h-4 rounded bg-[#14161b]/50 border border-current/30 text-[10px] font-bold flex items-center justify-center shrink-0">
                G
              </span>
              {!collapsed && (
                <span className="truncate">
                  {modalTransformMode === 'vertex_slide' ||
                  modalTransformMode === 'edge_slide'
                    ? 'Slide activo'
                    : 'Mover G / Slide'}
                </span>
              )}
            </button>
          </div>
        )}

        {/* 3. MODOS DE SELECCIÓN (Edit Mode) */}
        {workMode === 'edit' && (
          <>
            {renderSectionToggle('selectionModes', 'Modos de selección')}
            {(collapsed || openSections.selectionModes) && (
              <div className="flex flex-col gap-1">
                <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-1'}>
                  {(
                    [
                      {
                        id: 'vertex',
                        label: 'Vért.',
                        title: 'Modo Vértices',
                        icon: (
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <circle cx="8" cy="8" r="3.4" fill="currentColor" />
                          </svg>
                        ),
                      },
                      {
                        id: 'edge',
                        label: 'Arista',
                        title: 'Modo Aristas',
                        icon: (
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            className="w-3.5 h-3.5 shrink-0"
                            aria-hidden="true"
                          >
                            <line x1="3" y1="13" x2="13" y2="3" />
                          </svg>
                        ),
                      },
                      {
                        id: 'face',
                        label: 'Cara',
                        title: 'Modo Caras',
                        icon: (
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="w-3.5 h-3.5 shrink-0"
                            aria-hidden="true"
                          >
                            <rect
                              x="3.2"
                              y="3.2"
                              width="9.6"
                              height="9.6"
                              rx="1.2"
                              fill="currentColor"
                              fillOpacity="0.28"
                            />
                          </svg>
                        ),
                      },
                    ] as const
                  ).map((comp) => {
                    const active = editSelectionMode === comp.id;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        data-testid={`component-mode-${comp.id}`}
                        aria-pressed={active}
                        title={comp.title}
                        onClick={() => onChangeEditSelectionMode(comp.id)}
                        className={`min-h-[38px] rounded-lg border flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors touch-manipulation ${
                          active
                            ? 'bg-[#5ecd6e] border-[#7def8e] text-[#111215]'
                            : 'bg-[#20232b] hover:bg-[#2a2f3a] border-[#2e3340] text-[#d1d5db] hover:text-white'
                        }`}
                      >
                        {comp.icon}
                        {!collapsed && <span>{comp.label}</span>}
                      </button>
                    );
                  })}
                </div>

                {!collapsed && editSelectionMode === 'edge' && (
                  <div
                    className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#121419] border border-[#282c36]"
                    title="Modo de selección de aristas al tocar"
                  >
                    {(
                      [
                        { id: 'single', label: 'Arista' },
                        { id: 'loop', label: 'Bucle' },
                        { id: 'ring', label: 'Anillo' },
                      ] as const
                    ).map((toolOpt) => (
                      <button
                        key={toolOpt.id}
                        type="button"
                        data-testid={`edge-select-tool-${toolOpt.id}`}
                        aria-pressed={edgeSelectionTool === toolOpt.id}
                        onClick={() => onChangeEdgeSelectionTool(toolOpt.id)}
                        className={`h-8 rounded text-[11px] font-semibold transition-colors touch-manipulation ${
                          edgeSelectionTool === toolOpt.id
                            ? 'bg-[#1a2c3d] border border-[#38bdf8]/70 text-[#38bdf8]'
                            : 'bg-[#1e2129] hover:bg-[#2a2f3a] text-[#b4bac4] hover:text-white'
                        }`}
                      >
                        {toolOpt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 4. MODIFICADORES (SHIFT / CTRL / ALT) */}
        {touchSettings.modifierPanelEnabled && visibleModifierKeys.length > 0 && (
          <>
            {renderSectionToggle(
              'modifiers',
              'Modificadores',
              anyModifierActive ? (
                <span className="w-2 h-2 rounded-full bg-[#5ecd6e]" />
              ) : null,
            )}
            {(collapsed || openSections.modifiers) && (
              <div className="flex flex-col gap-1">
                <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-1'}>
                  {visibleModifierKeys.map((key) => {
                    const active = effectiveModifiers[key];
                    const latched = screenModifiers[key];
                    const label = key.toUpperCase();
                    const activeStyle =
                      key === 'shift'
                        ? 'bg-[#16261a] border-[#5ecd6e] text-[#7def8e]'
                        : key === 'ctrl'
                          ? 'bg-[#112738] border-[#38bdf8] text-[#7dd3fc]'
                          : 'bg-[#221a35] border-[#a78bfa] text-[#ddd6fe]';
                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid={`modifier-btn-${key}`}
                        aria-pressed={active}
                        title={`${label} (${isHoldMode ? 'Mantener pulsado' : 'Tocar para activar/desactivar'})`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (isHoldMode) {
                            try {
                              e.currentTarget.setPointerCapture(e.pointerId);
                            } catch {
                              // ignore
                            }
                            onSetModifier(key, true);
                          }
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          if (isHoldMode) {
                            onSetModifier(key, false);
                          }
                        }}
                        onPointerCancel={(e) => {
                          e.stopPropagation();
                          if (isHoldMode) {
                            onSetModifier(key, false);
                          }
                        }}
                        onClick={() => {
                          if (!isHoldMode) {
                            onToggleModifier(key);
                          }
                        }}
                        className={`min-h-[40px] rounded-lg border text-[11px] font-bold tracking-wide transition-colors touch-manipulation flex items-center justify-center ${
                          active
                            ? activeStyle
                            : 'bg-[#20232b] hover:bg-[#2a2f3a] border-[#2e3340] text-[#cbd5e1]'
                        } ${latched && !collapsed ? 'ring-1 ring-white/25' : ''}`}
                      >
                        {collapsed ? label[0] : label}
                      </button>
                    );
                  })}
                </div>
                {!collapsed && anyModifierActive && (
                  <button
                    type="button"
                    data-testid="modifiers-release-all"
                    onClick={onReleaseAllModifiers}
                    className="h-7 rounded-md bg-[#22252e] hover:bg-[#2d323e] border border-[#343947] text-[10px] font-semibold text-[#cbd5e1] flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3 text-[#5ecd6e]" />
                    <span>Soltar modificadores</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* 5. MODELADO (Edit Mode) */}
        {workMode === 'edit' && (
          <>
            {renderSectionToggle('modeling', 'Modelado')}
            {(collapsed || openSections.modeling) && (
              <div className="flex flex-col gap-1">
                {modelingItems.map((op) => {
                  const isActive = activeOperatorType === op.id;
                  const requiresSelection = op.id !== 'loop_cut';
                  const disabled =
                    !canEditSelected ||
                    (requiresSelection && !hasSelectedComponents);
                  return (
                    <button
                      key={op.id}
                      type="button"
                      data-testid={`sidebar-op-${op.id}`}
                      disabled={!canEditSelected}
                      onClick={() => onStartOperator(op.id)}
                      title={
                        disabled && canEditSelected
                          ? `${op.title} (requiere selección)`
                          : op.title
                      }
                      aria-label={op.title}
                      aria-pressed={isActive}
                      className={buttonClass(isActive, !canEditSelected)}
                    >
                      {op.icon}
                      {!collapsed && (
                        <span className="truncate">{op.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 6. EDICIÓN DE GEOMETRÍA (Edit Mode) */}
            {renderSectionToggle('geometryEdit', 'Edición de geometría')}
            {(collapsed || openSections.geometryEdit) && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  data-testid="sidebar-topo-merge"
                  disabled={!canEditSelected}
                  onClick={() => onStartOperator('merge')}
                  title="Fusionar vértices seleccionados (M)"
                  aria-pressed={activeOperatorType === 'merge'}
                  className={buttonClass(
                    activeOperatorType === 'merge',
                    !canEditSelected,
                  )}
                >
                  <GitMerge className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">Fusionar</span>}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-merge-distance"
                  disabled={!canEditSelected}
                  onClick={() => onStartOperator('merge_by_distance')}
                  title="Fusionar vértices por distancia"
                  aria-pressed={activeOperatorType === 'merge_by_distance'}
                  className={buttonClass(
                    activeOperatorType === 'merge_by_distance',
                    !canEditSelected,
                  )}
                >
                  <Minimize2 className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Por distancia</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-bridge"
                  disabled={!canEditSelected}
                  onClick={() => onStartOperator('bridge_loops')}
                  title="Bridge Edge Loops"
                  aria-pressed={activeOperatorType === 'bridge_loops'}
                  className={buttonClass(
                    activeOperatorType === 'bridge_loops',
                    !canEditSelected,
                  )}
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Bridge Loops</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-dissolve-limited"
                  disabled={!canEditSelected}
                  onClick={() => onStartOperator('dissolve_limited')}
                  title="Limitar disolución por ángulo"
                  aria-pressed={activeOperatorType === 'dissolve_limited'}
                  className={buttonClass(
                    activeOperatorType === 'dissolve_limited',
                    !canEditSelected,
                  )}
                >
                  <ScissorsLineDashed className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Limitar disolución</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-fill"
                  disabled={!canEditSelected || !hasSelectedComponents}
                  onClick={onFillSelection}
                  title="Crear cara (F)"
                  className={buttonClass(
                    false,
                    !canEditSelected || !hasSelectedComponents,
                  )}
                >
                  <PaintBucket className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">Crear cara</span>}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-connect"
                  disabled={
                    !canEditSelected ||
                    editSelectionMode !== 'vertex' ||
                    !hasSelectedComponents
                  }
                  onClick={onConnectVertexPath}
                  title="Conectar vértices (J)"
                  className={buttonClass(
                    false,
                    !canEditSelected ||
                      editSelectionMode !== 'vertex' ||
                      !hasSelectedComponents,
                  )}
                >
                  <Waypoints className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Conectar vértices</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-topo-delete"
                  disabled={!canEditSelected || !hasSelectedComponents}
                  onClick={() => {
                    setShowPrimitivePopover(false);
                    setShowDeletePopover((prev) => !prev);
                  }}
                  title="Opciones de eliminar / disolver selección"
                  aria-expanded={showDeletePopover}
                  className={buttonClass(
                    showDeletePopover,
                    !canEditSelected || !hasSelectedComponents,
                    true,
                  )}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">Eliminar...</span>}
                </button>
              </div>
            )}
          </>
        )}

        {/* 7. NORMALES Y VISUALIZACIÓN */}
        {renderSectionToggle('normalsDisplay', 'Normales y visualización')}
        {(collapsed || openSections.normalsDisplay) && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              data-testid="sidebar-face-orientation"
              onClick={onToggleFaceOrientation}
              aria-pressed={showFaceOrientation}
              title="Face Orientation (Azul: exterior · Rojo: invertida)"
              className={buttonClass(showFaceOrientation)}
            >
              <span
                className="inline-flex w-3.5 h-3.5 rounded-sm overflow-hidden border border-white/25 shrink-0"
                aria-hidden="true"
              >
                <span className="w-1/2 h-full bg-[#2563eb]" />
                <span className="w-1/2 h-full bg-[#e03131]" />
              </span>
              {!collapsed && (
                <span className="truncate">Face Orientation</span>
              )}
            </button>

            {workMode === 'edit' && (
              <>
                <button
                  type="button"
                  data-testid="sidebar-recalc-outside"
                  disabled={!canEditSelected}
                  onClick={onRecalculateOutside}
                  title="Recalculate Outside"
                  className={buttonClass(false, !canEditSelected)}
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Recalculate Outside</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-flip-normals"
                  disabled={!canEditSelected}
                  onClick={onFlipNormals}
                  title="Flip Normals"
                  className={buttonClass(false, !canEditSelected)}
                >
                  <ArrowUpDown className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">Flip Normals</span>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              data-testid="sidebar-toggle-xray"
              onClick={onToggleXray}
              aria-pressed={xrayEditMode}
              title="Alternar Rayos X (Alt+Z)"
              className={buttonClass(xrayEditMode)}
            >
              <Eye className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Rayos X</span>}
            </button>

            <button
              type="button"
              data-testid="sidebar-toggle-grid"
              onClick={onToggleGrid}
              aria-pressed={showGrid}
              title="Mostrar u ocultar cuadrícula 3D"
              className={buttonClass(showGrid)}
            >
              <Grid className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Cuadrícula</span>}
            </button>
          </div>
        )}

        {/* 8. EDICIÓN PROPORCIONAL */}
        {renderSectionToggle(
          'proportional',
          'Ed. proporcional',
          proportionalConfig.enabled ? (
            <span className="px-1 py-0.2 rounded bg-[#16261a] text-[#6fe681] text-[9px] font-mono-tabular">
              ON
            </span>
          ) : null,
        )}
        {(collapsed || openSections.proportional) && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              data-testid="proportional-toggle-btn"
              onClick={onToggleProportional}
              aria-pressed={proportionalConfig.enabled}
              title="Activar/Desactivar Edición Proporcional (O)"
              className={buttonClass(proportionalConfig.enabled)}
            >
              <ProportionalIcon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">
                  {proportionalConfig.enabled ? 'Activada (O)' : 'Activar (O)'}
                </span>
              )}
            </button>

            {!collapsed && (
              <>
                <button
                  type="button"
                  data-testid="proportional-connected-btn"
                  disabled={!proportionalConfig.enabled}
                  onClick={onToggleProportionalConnected}
                  aria-pressed={proportionalConfig.connectedOnly}
                  title="Solo vértices conectados topológicamente (Alt+O)"
                  className={buttonClass(
                    proportionalConfig.connectedOnly &&
                      proportionalConfig.enabled,
                    !proportionalConfig.enabled,
                  )}
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Solo conectados</span>
                </button>

                {/* Falloff Curve Selector */}
                <div className="rounded-lg bg-[#121419] border border-[#282c36] p-1.5 space-y-1">
                  <div className="text-[10px] font-semibold text-[#8a93a4] px-0.5">
                    Curva de caída (Shift+O)
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {PROPORTIONAL_FALLOFF_LIST.map((item) => {
                      const active = proportionalConfig.falloff === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!proportionalConfig.enabled}
                          onClick={() => onChangeProportionalFalloff(item.id)}
                          className={`h-8 px-1.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40 ${
                            active
                              ? 'bg-[#2c313b] border border-[#5ecd6e]/70 text-[#7def8e]'
                              : 'bg-[#1e2129] hover:bg-[#2a2f3a] border border-transparent text-[#cbd5e1]'
                          }`}
                        >
                          <FalloffCurveIcon
                            falloff={item.id}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Radius Control */}
                <div className="rounded-lg bg-[#121419] border border-[#282c36] p-1.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#8a93a4]">
                      Radio [ / ]
                    </span>
                    <span className="font-mono-tabular font-bold text-[#5ecd6e]">
                      {radiusText}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!proportionalConfig.enabled}
                      onClick={() =>
                        onChangeProportionalRadius(
                          proportionalConfig.radius * 0.9,
                        )
                      }
                      aria-label="Reducir radio proporcional"
                      className="w-8 h-8 rounded bg-[#20232b] hover:bg-[#2a2f3a] border border-[#2e3340] text-xs font-bold text-[#e4e6eb] disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={0.05}
                      max={6}
                      step={0.05}
                      disabled={!proportionalConfig.enabled}
                      value={Math.min(6, proportionalConfig.radius)}
                      onChange={(e) =>
                        onChangeProportionalRadius(
                          clampProportionalRadius(parseFloat(e.target.value)),
                        )
                      }
                      className="flex-1 min-w-0 accent-[#5ecd6e] cursor-pointer disabled:opacity-40"
                    />
                    <button
                      type="button"
                      disabled={!proportionalConfig.enabled}
                      onClick={() =>
                        onChangeProportionalRadius(
                          proportionalConfig.radius * 1.1,
                        )
                      }
                      aria-label="Aumentar radio proporcional"
                      className="w-8 h-8 rounded bg-[#20232b] hover:bg-[#2a2f3a] border border-[#2e3340] text-xs font-bold text-[#e4e6eb] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                {proportionalModifierWarning && proportionalConfig.enabled && (
                  <div className="px-2 py-1.5 rounded bg-[#261c0f] border border-[#f59e0b]/45 text-[10px] text-[#fcd34d] leading-snug">
                    {proportionalModifierWarning}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 9. HERRAMIENTAS ADICIONALES */}
        {renderSectionToggle('additional', 'Herramientas adicionales')}
        {(collapsed || openSections.additional) && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              data-testid="sidebar-toggle-workmode"
              disabled={!canEditSelected && workMode === 'object'}
              onClick={() =>
                onToggleWorkMode(workMode === 'object' ? 'edit' : 'object')
              }
              title="Cambiar entre Modo Objeto y Modo Edición (Tab)"
              className={buttonClass(
                workMode === 'edit',
                !canEditSelected && workMode === 'object',
              )}
            >
              <Hand className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">
                  {workMode === 'edit' ? 'Ir a Objeto' : 'Ir a Edición'}
                </span>
              )}
            </button>

            {workMode === 'object' && (
              <button
                type="button"
                data-testid="sidebar-add-primitive"
                onClick={() => {
                  setShowDeletePopover(false);
                  setShowPrimitivePopover((prev) => !prev);
                }}
                aria-expanded={showPrimitivePopover}
                title="Agregar primitiva 3D a la escena"
                className={buttonClass(showPrimitivePopover)}
              >
                <Plus className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">Agregar objeto</span>
                )}
              </button>
            )}

            <button
              type="button"
              data-testid="sidebar-duplicate-object"
              disabled={!hasSelectedObject}
              onClick={onDuplicateObject}
              title="Duplicar objeto seleccionado"
              className={buttonClass(false, !hasSelectedObject)}
            >
              <Copy className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Duplicar</span>}
            </button>

            <button
              type="button"
              data-testid="sidebar-apply-transform"
              disabled={!canEditSelected}
              onClick={onApplyObjectTransform}
              title="Aplicar transformaciones a la malla"
              className={buttonClass(false, !canEditSelected)}
            >
              <Box className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">Aplicar transf.</span>
              )}
            </button>

            <button
              type="button"
              data-testid="sidebar-center-origin"
              disabled={!canEditSelected}
              onClick={onCenterObjectOrigin}
              title="Centrar origen al centro geométrico"
              className={buttonClass(false, !canEditSelected)}
            >
              <Crosshair className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">Centrar origen</span>
              )}
            </button>

            {workMode === 'edit' && (
              <button
                type="button"
                data-testid="sidebar-separate-geometry"
                disabled={!canEditSelected || !hasSelectedComponents}
                onClick={onSeparateSelectedGeometry}
                title="Separar selección como nuevo objeto"
                className={buttonClass(
                  false,
                  !canEditSelected || !hasSelectedComponents,
                )}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">Separar selección</span>
                )}
              </button>
            )}

            <button
              type="button"
              data-testid="sidebar-focus-camera"
              onClick={onFocusCamera}
              title="Encuadrar objeto seleccionado (F / Inicio)"
              className={buttonClass(false)}
            >
              <Focus className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate">Encuadrar vista</span>
              )}
            </button>

            <button
              type="button"
              data-testid="sidebar-open-tool-settings"
              onClick={onOpenToolSettings}
              title="Abrir Configuración de herramientas"
              className={buttonClass(false)}
            >
              <Wrench className="w-4 h-4 shrink-0 text-[#5ecd6e]" />
              {!collapsed && (
                <span className="truncate">Config. herramientas</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Popover: Add Primitive */}
      {showPrimitivePopover && workMode === 'object' && (
        <div
          className="absolute left-full top-12 ml-2 z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <PrimitiveMenu
            onAddPrimitive={(type, options) => {
              onAddPrimitive(type, options);
              setShowPrimitivePopover(false);
            }}
            onClose={() => setShowPrimitivePopover(false)}
          />
        </div>
      )}

      {/* Popover: Contextual Edit Delete/Dissolve */}
      {showDeletePopover && workMode === 'edit' && (
        <div
          className="absolute left-full bottom-12 ml-2 z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DeleteMenuPopover
            editSelectionMode={editSelectionMode}
            onSelectAction={(action) => {
              onExecuteContextualDelete(action);
              setShowDeletePopover(false);
            }}
            onLimitedDissolve={() => {
              onStartOperator('dissolve_limited');
              setShowDeletePopover(false);
            }}
            onClose={() => setShowDeletePopover(false)}
          />
        </div>
      )}
    </aside>
  );
};
