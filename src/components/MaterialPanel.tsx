import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  Palette,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  clampMaterialFactor,
  hexToRgb,
  normalizeHexColor,
  rgbToHex,
} from '../core/project/hierarchy';
import {
  MaterialAsset,
  SceneObjectData,
  ViewportDisplayMode,
} from '../core/project/types';
import { NumericFieldInput } from './NumericFieldInput';

interface MaterialPanelProps {
  materials: MaterialAsset[];
  selectedObject: SceneObjectData | null;
  selectedObjectIds?: Set<string>;
  objects: SceneObjectData[];
  displayMode: ViewportDisplayMode;
  onActivateMaterialPreview: () => void;
  onCreateMaterial: (
    initial?: Partial<Omit<MaterialAsset, 'id'>>,
    assignToSelected?: boolean,
  ) => MaterialAsset;
  onRenameMaterial: (materialId: string, name: string) => void;
  onPushMaterialHistory: () => void;
  onUpdateMaterial: (
    materialId: string,
    patch: Partial<Omit<MaterialAsset, 'id'>>,
    recordHistory?: boolean,
  ) => void;
  onDuplicateMaterial: (
    materialId: string,
    assignToSelected?: boolean,
  ) => MaterialAsset | null;
  onDeleteMaterial: (materialId: string) => { ok: boolean; error?: string };
  onAssignMaterialToObjects: (objectIds: string[], materialId: string) => void;
}

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
  materials,
  selectedObject,
  selectedObjectIds,
  objects,
  displayMode,
  onActivateMaterialPreview,
  onCreateMaterial,
  onRenameMaterial,
  onPushMaterialHistory,
  onUpdateMaterial,
  onDuplicateMaterial,
  onDeleteMaterial,
  onAssignMaterialToObjects,
}) => {
  const targetMeshIds = useMemo(() => {
    const meshIdSet = new Set(
      objects.filter((o) => o.objectType === 'mesh').map((o) => o.id),
    );
    const ids: string[] = [];
    if (selectedObjectIds && selectedObjectIds.size > 0) {
      for (const id of selectedObjectIds) {
        if (meshIdSet.has(id)) ids.push(id);
      }
    }
    if (ids.length === 0 && selectedObject && meshIdSet.has(selectedObject.id)) {
      ids.push(selectedObject.id);
    }
    return ids;
  }, [objects, selectedObject, selectedObjectIds]);

  const primaryMesh = useMemo(() => {
    if (selectedObject && selectedObject.objectType === 'mesh') {
      return selectedObject;
    }
    if (targetMeshIds.length > 0) {
      return objects.find((o) => o.id === targetMeshIds[0]) ?? null;
    }
    return null;
  }, [objects, selectedObject, targetMeshIds]);

  const [editingMaterialId, setEditingMaterialId] = useState<string>(
    () => primaryMesh?.materialId ?? materials[0]?.id ?? '',
  );

  useEffect(() => {
    if (
      primaryMesh?.materialId &&
      materials.some((m) => m.id === primaryMesh.materialId)
    ) {
      setEditingMaterialId(primaryMesh.materialId);
    }
  }, [primaryMesh?.id, primaryMesh?.materialId, materials]);

  useEffect(() => {
    if (!materials.some((m) => m.id === editingMaterialId)) {
      setEditingMaterialId(materials[0]?.id ?? '');
    }
  }, [editingMaterialId, materials]);

  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === editingMaterialId) ?? materials[0] ?? null,
    [editingMaterialId, materials],
  );

  const [nameDraft, setNameDraft] = useState(activeMaterial?.name ?? '');
  const [hexDraft, setHexDraft] = useState(activeMaterial?.baseColor ?? '#9aa0a6');

  useEffect(() => {
    setNameDraft(activeMaterial?.name ?? '');
    setHexDraft(activeMaterial?.baseColor ?? '#9aa0a6');
  }, [activeMaterial?.id, activeMaterial?.name, activeMaterial?.baseColor]);

  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of objects) {
      if (obj.objectType !== 'mesh') continue;
      const mid = obj.materialId ?? materials[0]?.id;
      if (!mid) continue;
      counts.set(mid, (counts.get(mid) ?? 0) + 1);
    }
    return counts;
  }, [materials, objects]);

  const rgb = useMemo(
    () => hexToRgb(activeMaterial?.baseColor ?? '#9aa0a6'),
    [activeMaterial?.baseColor],
  );

  const commitName = () => {
    if (!activeMaterial) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(activeMaterial.name);
      return;
    }
    if (trimmed !== activeMaterial.name) {
      onRenameMaterial(activeMaterial.id, trimmed);
    }
  };

  const commitHex = () => {
    if (!activeMaterial) return;
    const normalized = normalizeHexColor(hexDraft, activeMaterial.baseColor);
    setHexDraft(normalized);
    if (normalized !== activeMaterial.baseColor) {
      onUpdateMaterial(activeMaterial.id, { baseColor: normalized }, true);
    }
  };

  const updateRgbChannel = (channel: 'r' | 'g' | 'b', nextVal: number) => {
    if (!activeMaterial) return;
    const clamped = Math.max(0, Math.min(255, Math.round(nextVal)));
    const nextRgb = { ...rgb, [channel]: clamped };
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    onUpdateMaterial(activeMaterial.id, { baseColor: nextHex }, true);
  };

  const previewStyle = useMemo(() => {
    if (!activeMaterial) return undefined;
    const m = activeMaterial.metallic;
    const r = activeMaterial.roughness;
    const highlightOpacity = Math.max(0.08, (1 - r) * (0.42 + m * 0.4));
    const highlightSpread = Math.round(16 + r * 42);
    return {
      background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,${highlightOpacity.toFixed(2)}) 0%, ${activeMaterial.baseColor} ${highlightSpread}%, #0c0e12 100%)`,
    };
  }, [activeMaterial]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto cad-scroll p-2.5 space-y-3">
      {/* Display Mode Prompt if not in Material Preview */}
      {displayMode !== 'material' && (
        <div className="rounded-lg bg-[#16261a] border border-[#5ecd6e]/40 p-2.5 space-y-2">
          <p className="text-[11px] text-[#cbd5e1] leading-relaxed">
            Activa <strong className="text-[#7def8e]">Material Preview</strong>{' '}
            para visualizar colores, metalizado y rugosidad en el visor 3D.
          </p>
          <button
            type="button"
            onClick={onActivateMaterialPreview}
            className="w-full h-8 px-2.5 rounded-md bg-[#49b459] hover:bg-[#5ecd6e] text-[#111215] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Activar Material Preview</span>
          </button>
        </div>
      )}

      {/* Selected Object(s) Material Assignment */}
      <div className="rounded-lg bg-[#121418] border border-[#272b34] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#d1d5db]">
            Asignación en selección
          </span>
          <span className="text-[10px] font-mono-tabular text-[#8e95a2] truncate max-w-[125px]">
            {targetMeshIds.length === 0
              ? 'Sin mallas'
              : targetMeshIds.length === 1
                ? primaryMesh?.name ?? '1 objeto'
                : `${targetMeshIds.length} objetos`}
          </span>
        </div>

        {targetMeshIds.length === 0 ? (
          <div className="text-[11px] text-[#7c8391]">
            Selecciona uno o varios objetos de malla para asignarles un material.
          </div>
        ) : (
          <select
            aria-label="Material asignado a la selección"
            value={primaryMesh?.materialId ?? activeMaterial?.id ?? ''}
            onChange={(e) => {
              const nextId = e.target.value;
              onAssignMaterialToObjects(targetMeshIds, nextId);
              setEditingMaterialId(nextId);
            }}
            className="w-full h-9 px-2.5 rounded-md bg-[#181b22] border border-[#2f3440] focus:border-[#5ecd6e] text-xs text-[#f3f4f6] outline-none"
          >
            {materials.map((mat) => (
              <option key={mat.id} value={mat.id}>
                {mat.name} ({mat.baseColor.toUpperCase()})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Material Library List */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e95a2] flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-[#5ecd6e]" />
            <span>Biblioteca ({materials.length})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const created = onCreateMaterial(undefined, targetMeshIds.length > 0);
              setEditingMaterialId(created.id);
            }}
            className="h-7 px-2 rounded bg-[#20242c] hover:bg-[#2a303b] border border-[#323846] text-[11px] font-semibold text-[#5ecd6e] flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo</span>
          </button>
        </div>

        <div className="space-y-1 max-h-40 overflow-y-auto cad-scroll pr-0.5">
          {materials.map((mat) => {
            const isSelectedForEdit = activeMaterial?.id === mat.id;
            const isAssignedToPrimary = primaryMesh?.materialId === mat.id;
            const count = usageCounts.get(mat.id) ?? 0;

            return (
              <div
                key={mat.id}
                className={`rounded-md border px-2 py-1.5 flex items-center justify-between gap-1.5 transition-colors ${
                  isSelectedForEdit
                    ? 'bg-[#252a35] border-[#5ecd6e]/65'
                    : 'bg-[#121418] border-[#262a33] hover:bg-[#1a1d24]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setEditingMaterialId(mat.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/25 shrink-0"
                    style={{ backgroundColor: mat.baseColor }}
                  />
                  <span className="text-xs font-medium text-[#f3f4f6] truncate">
                    {mat.name}
                  </span>
                  {isAssignedToPrimary && (
                    <span
                      title="Asignado al objeto activo"
                      className="text-[#5ecd6e] shrink-0"
                    >
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[10px] font-mono-tabular text-[#8e95a2] px-1"
                    title={`${count} objeto(s) usando este material`}
                  >
                    {count}
                  </span>
                  {targetMeshIds.length > 0 && !isAssignedToPrimary && (
                    <button
                      type="button"
                      onClick={() => {
                        onAssignMaterialToObjects(targetMeshIds, mat.id);
                        setEditingMaterialId(mat.id);
                      }}
                      title="Asignar a la selección"
                      className="h-6 px-1.5 rounded bg-[#1f242d] hover:bg-[#2c3340] text-[10px] font-semibold text-[#5ecd6e]"
                    >
                      Usar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const copy = onDuplicateMaterial(mat.id, false);
                      if (copy) setEditingMaterialId(copy.id);
                    }}
                    title="Duplicar material"
                    aria-label={`Duplicar ${mat.name}`}
                    className="w-6 h-6 rounded hover:bg-[#313644] text-[#9ca3af] hover:text-white flex items-center justify-center"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={materials.length <= 1}
                    onClick={() => onDeleteMaterial(mat.id)}
                    title={
                      materials.length <= 1
                        ? 'Debe permanecer al menos un material'
                        : 'Eliminar material'
                    }
                    aria-label={`Eliminar ${mat.name}`}
                    className="w-6 h-6 rounded hover:bg-[#3a2226] text-[#f87171] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Material Properties Editor */}
      {activeMaterial && (
        <div className="rounded-lg bg-[#121418] border border-[#272b34] p-2.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full border border-white/20 shadow-inner shrink-0"
              style={previewStyle}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e95a2]">
                Nombre del material
              </label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitName();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setNameDraft(activeMaterial.name);
                    e.currentTarget.blur();
                  }
                }}
                className="w-full h-8 px-2 rounded bg-[#181b22] border border-[#2f3440] focus:border-[#5ecd6e] text-xs font-medium text-[#f3f4f6] outline-none"
              />
            </div>
          </div>

          {/* Base Color + Hex */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-[#cbd5e1]">
              Base Color (Hex)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Selector visual de Base Color"
                value={activeMaterial.baseColor}
                onPointerDown={onPushMaterialHistory}
                onChange={(e) => {
                  const next = normalizeHexColor(
                    e.target.value,
                    activeMaterial.baseColor,
                  );
                  setHexDraft(next);
                  onUpdateMaterial(activeMaterial.id, { baseColor: next }, false);
                }}
                className="w-10 h-9 p-0.5 rounded bg-[#181b22] border border-[#2f3440] cursor-pointer shrink-0"
              />
              <input
                type="text"
                aria-label="Código hexadecimal de color"
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={commitHex}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitHex();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setHexDraft(activeMaterial.baseColor);
                    e.currentTarget.blur();
                  }
                }}
                placeholder="#9AA0A6"
                className="flex-1 min-w-0 h-9 px-2.5 rounded bg-[#181b22] border border-[#2f3440] focus:border-[#5ecd6e] text-xs font-mono-tabular uppercase text-[#f3f4f6] outline-none"
              />
            </div>
          </div>

          {/* RGB 0 - 255 */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-[#cbd5e1]">
              RGB (0–255)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: 'r', label: 'R', color: 'text-[#e05252]', val: rgb.r },
                  { key: 'g', label: 'G', color: 'text-[#52b852]', val: rgb.g },
                  { key: 'b', label: 'B', color: 'text-[#48bce8]', val: rgb.b },
                ] as const
              ).map((ch) => (
                <label
                  key={ch.key}
                  className="flex items-center bg-[#181b22] border border-[#2f3440] focus-within:border-[#5ecd6e] rounded px-1.5 h-9"
                >
                  <span className={`text-[11px] font-bold mr-1 ${ch.color}`}>
                    {ch.label}
                  </span>
                  <NumericFieldInput
                    ariaLabel={`Canal ${ch.label}`}
                    value={ch.val}
                    decimals={0}
                    onCommit={(val) => updateRgbChannel(ch.key, val)}
                    className="w-full bg-transparent text-xs font-mono-tabular text-[#f3f4f6] outline-none text-right"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Metallic */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#cbd5e1]">
                Metallic
              </span>
              <NumericFieldInput
                ariaLabel="Valor numérico de Metallic"
                value={activeMaterial.metallic}
                decimals={2}
                onCommit={(val) =>
                  onUpdateMaterial(
                    activeMaterial.id,
                    { metallic: clampMaterialFactor(val, activeMaterial.metallic) },
                    true,
                  )
                }
                className="w-16 h-7 px-1.5 rounded bg-[#181b22] border border-[#2f3440] focus:border-[#5ecd6e] text-xs font-mono-tabular text-[#f3f4f6] text-right outline-none"
              />
            </div>
            <input
              type="range"
              aria-label="Deslizador Metallic"
              min={0}
              max={1}
              step={0.01}
              value={activeMaterial.metallic}
              onPointerDown={onPushMaterialHistory}
              onChange={(e) =>
                onUpdateMaterial(
                  activeMaterial.id,
                  { metallic: parseFloat(e.target.value) },
                  false,
                )
              }
              className="w-full h-2 accent-[#5ecd6e] cursor-pointer"
            />
          </div>

          {/* Roughness */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#cbd5e1]">
                Roughness
              </span>
              <NumericFieldInput
                ariaLabel="Valor numérico de Roughness"
                value={activeMaterial.roughness}
                decimals={2}
                onCommit={(val) =>
                  onUpdateMaterial(
                    activeMaterial.id,
                    { roughness: clampMaterialFactor(val, activeMaterial.roughness) },
                    true,
                  )
                }
                className="w-16 h-7 px-1.5 rounded bg-[#181b22] border border-[#2f3440] focus:border-[#5ecd6e] text-xs font-mono-tabular text-[#f3f4f6] text-right outline-none"
              />
            </div>
            <input
              type="range"
              aria-label="Deslizador Roughness"
              min={0}
              max={1}
              step={0.01}
              value={activeMaterial.roughness}
              onPointerDown={onPushMaterialHistory}
              onChange={(e) =>
                onUpdateMaterial(
                  activeMaterial.id,
                  { roughness: parseFloat(e.target.value) },
                  false,
                )
              }
              className="w-full h-2 accent-[#5ecd6e] cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
