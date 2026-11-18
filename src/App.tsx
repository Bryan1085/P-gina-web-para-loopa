import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExportFormat,
  ExportModelModal,
  ExportRequestConfig,
  ExportScope,
  IoErrorModal,
  IoProgressModal,
  PendingStlImport,
  ReferenceImageImportModal,
  StlImportModal,
} from './components/FileIoModals';
import {
  RecoveryPromptModal,
  ReturnToGalleryModal,
} from './components/GalleryModals';
import { LeftToolSidebar } from './components/LeftToolSidebar';
import { NewProjectModal } from './components/NewProjectModal';
import { OutlinerPanel } from './components/OutlinerPanel';
import { ProjectGallery } from './components/ProjectGallery';
import { ProjectModal, ProjectModalMode } from './components/ProjectModal';
import { SettingsModal, SettingsTabId } from './components/SettingsModal';
import { SceneStatsInfo, TopBar } from './components/TopBar';
import { Viewport3D, Viewport3DHandle } from './components/Viewport3D';
import {
  LoadedImageReferencePayload,
  loadReferenceImageFile,
} from './core/io/imageReference';
import {
  MAX_IMPORT_FILE_BYTES,
  stripFileExtension,
  triggerFileDownload,
} from './core/io/meshUtils';
import { buildImportedModelProjectData } from './core/io/modelThumbnail';
import { exportObjectsToObj } from './core/io/objExport';
import { parseObjContent } from './core/io/objImport';
import { exportObjectsToStl } from './core/io/stlExport';
import { inspectStlBuffer, parseStlBuffer } from './core/io/stlImport';
import { evaluateObjectsForExport } from './core/modifiers/evaluateModifiers';
import {
  ObjectTransform,
  ProjectTemplateId,
  ReferenceImageOrientation,
  SceneObjectData,
  TouchModifierState,
} from './core/project/types';
import { getAppDocumentTitle } from './config/brand';
import { EMPTY_MODIFIER_STATE } from './engine/TouchGestureManager';
import { useModelerStore } from './state/useModelerStore';

export default function App() {
  const store = useModelerStore();

  const [activeView, setActiveView] = useState<'gallery' | 'modeler'>('gallery');
  const [showReturnGuardModal, setShowReturnGuardModal] = useState(false);
  const [exitingToGallery, setExitingToGallery] = useState(false);

  const [showOutliner, setShowOutliner] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [projectModalMode, setProjectModalMode] =
    useState<ProjectModalMode | null>(null);
  const [settingsModalTab, setSettingsModalTab] =
    useState<SettingsTabId | null>(null);
  const [effectiveModifiers, setEffectiveModifiers] =
    useState<TouchModifierState>(EMPTY_MODIFIER_STATE);
  const viewportRef = useRef<Viewport3DHandle | null>(null);
  const [liveTransformOverride, setLiveTransformOverride] = useState<{
    id: string;
    transform: ObjectTransform;
  } | null>(null);

  // Import/Export workflow states & modals
  const [pendingStl, setPendingStl] = useState<PendingStlImport | null>(null);
  const [pendingRefImage, setPendingRefImage] =
    useState<LoadedImageReferencePayload | null>(null);
  const [exportModalConfig, setExportModalConfig] = useState<{
    format: ExportFormat;
    scope: ExportScope;
  } | null>(null);
  const [ioProgress, setIoProgress] = useState<{
    title: string;
    label: string;
    progress: number;
  } | null>(null);
  const [ioError, setIoError] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Hidden file inputs mounted synchronously for iPad Safari compatibility
  const objInputRef = useRef<HTMLInputElement | null>(null);
  const stlInputRef = useRef<HTMLInputElement | null>(null);
  const jpgInputRef = useRef<HTMLInputElement | null>(null);
  const pngInputRef = useRef<HTMLInputElement | null>(null);
  const nativeProjectInputRef = useRef<HTMLInputElement | null>(null);
  const lastGKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    store.registerThumbnailProvider(
      () => viewportRef.current?.captureThumbnail() ?? null,
    );
    return () => store.registerThumbnailProvider(null);
  }, [store.registerThumbnailProvider]);

  useEffect(() => {
    store.setModelerActive(activeView === 'modeler');
  }, [activeView, store.setModelerActive]);

  useEffect(() => {
    document.title = getAppDocumentTitle();
  }, []);

  // Prompt confirmation before closing browser tab if there are unsaved changes in active modeler session
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeView === 'modeler' && store.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [activeView, store.hasUnsavedChanges]);

  const handleLiveObjectTransform = useCallback(
    (id: string, transform: ObjectTransform) => {
      setLiveTransformOverride({ id, transform });
    },
    [],
  );

  const handleCommitObjectTransform = useCallback(
    (id: string, before: ObjectTransform, after: ObjectTransform) => {
      setLiveTransformOverride(null);
      store.commitObjectTransformFromGizmo(id, before, after);
    },
    [store],
  );

  /* ==========================================================================
   * File Import Handlers (OBJ, STL, JPG, PNG)
   * ======================================================================== */
  const handleObjFilesSelected = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const objFile = files.find((f) => f.name.toLowerCase().endsWith('.obj'));
      const mtlFile = files.find((f) => f.name.toLowerCase().endsWith('.mtl'));

      if (!objFile) {
        setIoError({
          title: 'Archivo no compatible',
          message:
            'Selecciona un archivo con extensión .obj (opcionalmente acompañado de su archivo .mtl).',
        });
        return;
      }

      if (objFile.size === 0) {
        setIoError({
          title: 'Archivo OBJ vacío',
          message: `El archivo "${objFile.name}" no contiene datos.`,
        });
        return;
      }

      if (objFile.size > MAX_IMPORT_FILE_BYTES) {
        setIoError({
          title: 'Archivo demasiado grande',
          message: `El archivo "${objFile.name}" supera el límite seguro de ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB.`,
        });
        return;
      }

      try {
        setIoProgress({
          title: 'Importando modelo OBJ',
          label: `Leyendo "${objFile.name}"...`,
          progress: 0.05,
        });
        const objText = await objFile.text();
        const mtlText = mtlFile ? await mtlFile.text() : undefined;

        const result = await parseObjContent(objText, objFile.name, {
          mtlText,
          onProgress: (progress, label) => {
            setIoProgress({
              title: 'Importando modelo OBJ',
              label,
              progress,
            });
          },
        });

        store.importObjParts(result);
        setIoProgress(null);

        if (result.warnings.length > 0) {
          store.showToast(result.warnings[0]);
        }
      } catch (err) {
        setIoProgress(null);
        setIoError({
          title: 'Error al importar OBJ',
          message:
            err instanceof Error
              ? err.message
              : 'El archivo OBJ está dañado o no pudo procesarse.',
        });
      }
    },
    [store],
  );

  const handleStlFileSelected = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setIoError({
        title: 'Archivo no compatible',
        message: 'Selecciona un archivo 3D con extensión .stl.',
      });
      return;
    }

    if (file.size === 0) {
      setIoError({
        title: 'Archivo STL vacío',
        message: `El archivo "${file.name}" está vacío.`,
      });
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setIoError({
        title: 'Archivo demasiado grande',
        message: `El archivo "${file.name}" supera el límite seguro de ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB.`,
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const inspection = inspectStlBuffer(buffer);
      setPendingStl({
        fileName: file.name,
        fileSizeBytes: file.size,
        buffer,
        inspection,
      });
    } catch (err) {
      setIoError({
        title: 'Error al leer STL',
        message:
          err instanceof Error
            ? err.message
            : 'El archivo STL está dañado o no es compatible.',
      });
    }
  }, []);

  const handleConfirmStlImport = useCallback(
    async (scale: number) => {
      if (!pendingStl) return;
      const target = pendingStl;
      setPendingStl(null);
      try {
        setIoProgress({
          title: 'Importando modelo STL',
          label: `Procesando "${target.fileName}"...`,
          progress: 0.08,
        });
        const result = await parseStlBuffer(target.buffer, target.fileName, {
          scale,
          onProgress: (progress, label) => {
            setIoProgress({
              title: 'Importando modelo STL',
              label,
              progress,
            });
          },
        });
        if (target.isGalleryImport) {
          const modelProject = buildImportedModelProjectData({
            projectName: result.name,
            folderId: target.targetGalleryFolderId ?? null,
            stlResult: result,
          });
          const res = await store.importModelAsNewProject(modelProject);
          setIoProgress(null);
          if (!res.ok) {
            setIoError({
              title: 'Error al guardar proyecto STL',
              message:
                res.error ??
                'No se pudo crear el proyecto en la galería.',
            });
            return;
          }
          if (result.warnings.length > 0) {
            store.showToast(result.warnings[0]);
          }
        } else {
          store.importStlResult(result);
          setIoProgress(null);
          if (result.warnings.length > 0) {
            store.showToast(result.warnings[0]);
          }
        }
      } catch (err) {
        setIoProgress(null);
        setIoError({
          title: 'Error al importar STL',
          message:
            err instanceof Error
              ? err.message
              : 'No se pudo procesar la geometría STL.',
        });
      }
    },
    [pendingStl, store],
  );

  const handleGalleryModelFilesSelected = useCallback(
    async (fileList: FileList, targetFolderId: string | null) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const objFile = files.find((f) => f.name.toLowerCase().endsWith('.obj'));
      const mtlFile = files.find((f) => f.name.toLowerCase().endsWith('.mtl'));
      const stlFile = files.find((f) => f.name.toLowerCase().endsWith('.stl'));

      if (objFile) {
        if (objFile.size === 0) {
          setIoError({
            title: 'Archivo OBJ vacío',
            message: `El archivo "${objFile.name}" no contiene datos.`,
          });
          return;
        }
        if (objFile.size > MAX_IMPORT_FILE_BYTES) {
          setIoError({
            title: 'Archivo demasiado grande',
            message: `El archivo "${objFile.name}" supera el límite seguro de ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB.`,
          });
          return;
        }
        try {
          setIoProgress({
            title: 'Importando modelo OBJ a galería',
            label: `Leyendo "${objFile.name}"...`,
            progress: 0.05,
          });
          const objText = await objFile.text();
          const mtlText = mtlFile ? await mtlFile.text() : undefined;
          const result = await parseObjContent(objText, objFile.name, {
            mtlText,
            onProgress: (progress, label) => {
              setIoProgress({
                title: 'Importando modelo OBJ a galería',
                label,
                progress,
              });
            },
          });
          const modelProject = buildImportedModelProjectData({
            projectName: stripFileExtension(objFile.name),
            folderId: targetFolderId,
            objParts: result.parts,
          });
          const res = await store.importModelAsNewProject(modelProject);
          setIoProgress(null);
          if (!res.ok) {
            setIoError({
              title: 'Error al guardar modelo OBJ',
              message:
                res.error ??
                'No se pudo crear el proyecto en la galería.',
            });
            return;
          }
          if (result.warnings.length > 0) {
            store.showToast(result.warnings[0]);
          }
        } catch (err) {
          setIoProgress(null);
          setIoError({
            title: 'Error al importar OBJ',
            message:
              err instanceof Error
                ? err.message
                : 'El archivo OBJ está dañado o no pudo procesarse.',
          });
        }
        return;
      }

      if (stlFile) {
        if (stlFile.size === 0) {
          setIoError({
            title: 'Archivo STL vacío',
            message: `El archivo "${stlFile.name}" está vacío.`,
          });
          return;
        }
        if (stlFile.size > MAX_IMPORT_FILE_BYTES) {
          setIoError({
            title: 'Archivo demasiado grande',
            message: `El archivo "${stlFile.name}" supera el límite seguro de ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB.`,
          });
          return;
        }
        try {
          const buffer = await stlFile.arrayBuffer();
          const inspection = inspectStlBuffer(buffer);
          setPendingStl({
            fileName: stlFile.name,
            fileSizeBytes: stlFile.size,
            buffer,
            inspection,
            targetGalleryFolderId: targetFolderId,
            isGalleryImport: true,
          });
        } catch (err) {
          setIoError({
            title: 'Error al leer STL',
            message:
              err instanceof Error
                ? err.message
                : 'El archivo STL está dañado o no es compatible.',
          });
        }
        return;
      }

      setIoError({
        title: 'Formato no compatible',
        message:
          'Selecciona un modelo .obj (opcionalmente con .mtl) o un archivo .stl.',
      });
    },
    [store],
  );

  const handleImageFileSelected = useCallback(
    async (fileList: FileList | null, expectedFormat: 'jpg' | 'png') => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];
      try {
        const payload = await loadReferenceImageFile(file, expectedFormat);
        setPendingRefImage(payload);
      } catch (err) {
        setIoError({
          title: 'Imagen de referencia no compatible',
          message:
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la imagen seleccionada.',
        });
      }
    },
    [],
  );

  const handleConfirmReferenceImage = useCallback(
    (orientation: ReferenceImageOrientation) => {
      if (!pendingRefImage) return;
      store.addReferenceImage(pendingRefImage, orientation);
      setPendingRefImage(null);
    },
    [pendingRefImage, store],
  );

  /* ==========================================================================
   * Export Handlers (OBJ / STL)
   * ======================================================================== */
  const openExportModal = useCallback(
    (format: ExportFormat, scope: ExportScope) => {
      if (scope === 'selected' && !store.selectedObjectId) {
        store.showToast('Selecciona un objeto o exporta la escena completa');
        return;
      }
      setExportModalConfig({ format, scope });
    },
    [store],
  );

  const handleExecuteExport = useCallback(
    async (config: ExportRequestConfig) => {
      const sceneObjects = store.activeScene.objects;
      let targets: SceneObjectData[] = [];
      if (config.scope === 'selected') {
        const sel = sceneObjects.find((o) => o.id === store.selectedObjectId);
        if (sel) targets = [sel];
      } else if (config.scope === 'multiple') {
        const idSet = new Set(config.selectedIds);
        targets = sceneObjects.filter((o) => idSet.has(o.id));
      } else {
        targets = sceneObjects;
      }

      const evaluatedTargets = evaluateObjectsForExport(targets, sceneObjects);
      const baseFilename =
        config.scope === 'selected' && targets.length === 1
          ? stripFileExtension(targets[0].name)
          : stripFileExtension(store.project.name || 'escena');

      setExportModalConfig(null);

      try {
        if (config.format === 'obj') {
          setIoProgress({
            title: 'Exportando modelo OBJ',
            label: 'Preparando geometría...',
            progress: 0.1,
          });
          const result = await exportObjectsToObj(evaluatedTargets, {
            applyTransform: config.applyTransform,
            exportScale: config.exportScale,
            materials: store.materials,
            onProgress: (progress, label) => {
              setIoProgress({
                title: 'Exportando modelo OBJ',
                label,
                progress,
              });
            },
          });
          triggerFileDownload(
            result.objText,
            `${baseFilename}.obj`,
            'text/plain;charset=utf-8',
          );
          setIoProgress(null);
          const skippedMsg =
            result.skippedObjects.length > 0
              ? ` (${result.skippedObjects.length} omitido(s))`
              : '';
          store.showToast(
            `OBJ exportado: ${result.exportedCount} objeto(s)${skippedMsg}`,
          );
        } else {
          setIoProgress({
            title: 'Exportando modelo STL',
            label: 'Verificando y triangulando mallas...',
            progress: 0.1,
          });
          const result = await exportObjectsToStl(evaluatedTargets, {
            binary: config.stlBinary,
            applyTransform: config.applyTransform,
            exportScale: config.exportScale,
            onProgress: (progress, label) => {
              setIoProgress({
                title: 'Exportando modelo STL',
                label,
                progress,
              });
            },
          });
          triggerFileDownload(
            result.data,
            `${baseFilename}.stl`,
            config.stlBinary
              ? 'application/octet-stream'
              : 'model/stl;charset=utf-8',
          );
          setIoProgress(null);
          const skippedMsg =
            result.validation.skippedObjects.length > 0
              ? ` · ${result.validation.skippedObjects.length} omitido(s)`
              : '';
          store.showToast(
            `STL exportado (${result.totalTriangles.toLocaleString()} triángulos)${skippedMsg}`,
          );
        }
      } catch (err) {
        setIoProgress(null);
        setIoError({
          title: `Error al exportar ${config.format.toUpperCase()}`,
          message:
            err instanceof Error
              ? err.message
              : 'No se pudo completar la exportación.',
        });
      }
    },
    [store],
  );

  const enterModelerWithResetCamera = useCallback(() => {
    setActiveView('modeler');
    window.requestAnimationFrame(() => {
      viewportRef.current?.resetCamera();
    });
  }, []);

  const handleOpenProjectFromGallery = useCallback(
    async (projectId: string): Promise<boolean> => {
      const opened = await store.openProject(projectId);
      if (opened) {
        enterModelerWithResetCamera();
      }
      return opened;
    },
    [enterModelerWithResetCamera, store],
  );

  const handleCreateProjectFromGallery = useCallback(
    async (
      name: string,
      templateId: ProjectTemplateId,
      folderId: string | null,
    ) => {
      const created = await store.createProject(name, templateId, folderId);
      if (created) {
        enterModelerWithResetCamera();
      }
      return created;
    },
    [enterModelerWithResetCamera, store],
  );

  const handleReturnToGallery = useCallback(async () => {
    if (exitingToGallery) return;
    if (store.hasUnsavedChanges) {
      if (store.settings.autosaveEnabled) {
        setExitingToGallery(true);
        const savedOk = await store.saveProjectSilent();
        setExitingToGallery(false);
        if (savedOk) {
          setActiveView('gallery');
          return;
        }
      }
      setShowReturnGuardModal(true);
      return;
    }

    const thumb = viewportRef.current?.captureThumbnail();
    if (thumb) {
      await store.saveProjectSilent(thumb);
    }
    setActiveView('gallery');
  }, [exitingToGallery, store]);

  const handleExportNativeFromModeler = useCallback(async () => {
    const res = await store.exportNativeProject();
    if (!res) return;
    triggerFileDownload(
      res.content,
      res.filename,
      'application/json;charset=utf-8',
    );
    store.showToast(`Proyecto exportado: ${res.filename}`);
  }, [store]);

  const handleImportNativeFromModeler = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      try {
        const text = await fileList[0].text();
        const res = await store.importNativeProject(text);
        if (!res.ok || !res.project) {
          setIoError({
            title: 'Error al importar proyecto',
            message: res.error ?? 'No se pudo leer el archivo de proyecto.',
          });
          return;
        }
        const opened = await store.openProject(res.project.id, {
          skipRecoveryCheck: true,
        });
        if (opened) {
          enterModelerWithResetCamera();
        }
      } catch {
        setIoError({
          title: 'Error al importar proyecto',
          message: 'No se pudo leer el archivo seleccionado.',
        });
      }
    },
    [enterModelerWithResetCamera, store],
  );

  // Keyboard shortcuts for iPad Magic Keyboard / Desktop testing (only active inside modeler)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeView !== 'modeler') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const shiftHeld = e.shiftKey || store.screenModifiers.shift;
      const ctrlHeld = e.ctrlKey || e.metaKey || store.screenModifiers.ctrl;
      const altHeld = e.altKey || store.screenModifiers.alt;

      if (ctrlHeld && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (shiftHeld) store.redo();
        else store.undo();
        return;
      }
      if (ctrlHeld && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void store.saveProject();
        return;
      }

      if (e.key === 'Escape' && store.operatorSession) {
        e.preventDefault();
        store.cancelEditOperator();
        return;
      }
      if (e.key === 'Escape' && store.modalTransform) {
        e.preventDefault();
        store.cancelModalTransform();
        return;
      }
      if (e.key === 'Enter' && store.operatorSession) {
        e.preventDefault();
        store.confirmEditOperator();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'tab':
          if (!ctrlHeld && !altHeld) {
            e.preventDefault();
            store.toggleWorkMode(
              store.workMode === 'object' ? 'edit' : 'object',
            );
          }
          break;
        case 'g':
          if (!ctrlHeld && !altHeld && !e.repeat) {
            const now = performance.now();
            const isSecondG =
              store.modalTransform?.mode === 'move' ||
              now - lastGKeyTimeRef.current <= 450;
            lastGKeyTimeRef.current = now;
            if (
              isSecondG &&
              store.workMode === 'edit' &&
              (store.editSelectionMode === 'vertex' ||
                store.editSelectionMode === 'edge')
            ) {
              store.triggerGHoldSlide();
            } else {
              store.triggerGQuickTapMove();
            }
          }
          break;
        case 'r':
          if (!ctrlHeld && !altHeld) store.setActiveTool('rotate');
          break;
        case 's':
          if (!ctrlHeld && !altHeld) store.setActiveTool('scale');
          break;
        case 'q':
          if (!ctrlHeld && !altHeld) store.setActiveTool('select');
          break;
        case 'e':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.startEditOperator('extrude');
          }
          break;
        case 'i':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.startEditOperator('inset');
          }
          break;
        case 'b':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.startEditOperator('bevel');
          }
          break;
        case 'k':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.startEditOperator('loop_cut');
          }
          break;
        case 'm':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.startEditOperator('merge');
          }
          break;
        case 'f':
          if (!ctrlHeld && !altHeld && store.workMode === 'edit' && !store.operatorSession) {
            store.executeFillSelection();
          }
          break;
        case 'j':
          if (
            store.workMode === 'edit' &&
            !store.operatorSession &&
            !ctrlHeld &&
            !altHeld
          ) {
            e.preventDefault();
            store.executeConnectVertexPath();
          }
          break;
        case 'o':
          if (
            store.workMode === 'edit' &&
            !store.operatorSession &&
            !ctrlHeld
          ) {
            e.preventDefault();
            if (altHeld) {
              store.toggleProportionalConnected();
            } else if (shiftHeld) {
              store.cycleProportionalFalloff();
            } else {
              store.toggleProportionalEditing();
            }
          }
          break;
        case '[':
          if (
            store.workMode === 'edit' &&
            !store.operatorSession &&
            store.settings.proportionalEditing.enabled
          ) {
            e.preventDefault();
            store.setProportionalRadius(
              store.settings.proportionalEditing.radius * 0.9,
            );
          }
          break;
        case ']':
          if (
            store.workMode === 'edit' &&
            !store.operatorSession &&
            store.settings.proportionalEditing.enabled
          ) {
            e.preventDefault();
            store.setProportionalRadius(
              store.settings.proportionalEditing.radius * 1.1,
            );
          }
          break;
        case 'x':
          if (!ctrlHeld && !altHeld) {
            store.setAxisConstraint(store.axisConstraint === 'x' ? 'free' : 'x');
          }
          break;
        case 'y':
          if (!ctrlHeld && !altHeld) {
            store.setAxisConstraint(store.axisConstraint === 'y' ? 'free' : 'y');
          }
          break;
        case 'z':
          if (!ctrlHeld && !altHeld) {
            store.setAxisConstraint(store.axisConstraint === 'z' ? 'free' : 'z');
          }
          break;
        case 'a':
          if (!ctrlHeld && store.workMode === 'edit' && !store.operatorSession) {
            if (altHeld) store.deselectAllEditComponents();
            else store.selectAllEditComponents();
          }
          break;
        case 'delete':
        case 'backspace':
          if (store.workMode === 'edit' && !store.operatorSession) {
            store.deleteSelectedEditComponents();
          } else if (
            (store.selectedObjectIds.size > 0 || store.selectedObjectId) &&
            !store.operatorSession
          ) {
            store.deleteSelectedObjects();
          }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, store]);

  const canEditSelected = Boolean(
    store.selectedObject &&
      store.selectedObject.objectType === 'mesh' &&
      !store.selectedObject.locked,
  );

  const sceneStats: SceneStatsInfo = useMemo(() => {
    const topo = store.selectedObject
      ? {
          vertices: store.selectedObject.mesh.vertices.length,
          edges: store.selectedObject.mesh.edges.length,
          faces: store.selectedObject.mesh.faces.length,
        }
      : store.renderedObjects.reduce(
          (acc, obj) => {
            acc.vertices += obj.mesh.vertices.length;
            acc.edges += obj.mesh.edges.length;
            acc.faces += obj.mesh.faces.length;
            return acc;
          },
          { vertices: 0, edges: 0, faces: 0 },
        );
    return {
      objectCount: store.renderedObjects.length,
      selectedObjectCount: store.selectedObjectIds.size,
      selectedComponentCount: store.selectedComponentIds.size,
      activeObjectName: store.selectedObject?.name ?? null,
      vertices: topo.vertices,
      edges: topo.edges,
      faces: topo.faces,
      workMode: store.workMode,
      editSelectionMode: store.editSelectionMode,
    };
  }, [
    store.editSelectionMode,
    store.renderedObjects,
    store.selectedComponentIds.size,
    store.selectedObject,
    store.selectedObjectIds.size,
    store.workMode,
  ]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#18191c] text-[#e4e6eb] overflow-hidden select-none">
      {/* Hidden Safari iPad-compatible file pickers (invoked synchronously inside menu clicks) */}
      <input
        ref={objInputRef}
        type="file"
        accept=".obj,.mtl"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleObjFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={stlInputRef}
        type="file"
        accept=".stl"
        className="hidden"
        onChange={(e) => {
          void handleStlFileSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={jpgInputRef}
        type="file"
        accept=".jpg,.jpeg,image/jpeg"
        className="hidden"
        onChange={(e) => {
          void handleImageFileSelected(e.target.files, 'jpg');
          e.target.value = '';
        }}
      />
      <input
        ref={pngInputRef}
        type="file"
        accept=".png,image/png"
        className="hidden"
        onChange={(e) => {
          void handleImageFileSelected(e.target.files, 'png');
          e.target.value = '';
        }}
      />
      <input
        ref={nativeProjectInputRef}
        type="file"
        accept=".forma3d,.json,.forma3d.json,application/json"
        className="hidden"
        onChange={(e) => {
          void handleImportNativeFromModeler(e.target.files);
          e.target.value = '';
        }}
      />

      {/* A. Barra Superior Compacta y Desplegable */}
      <TopBar
        projectName={store.project.name}
        hasUnsavedChanges={store.hasUnsavedChanges}
        saveStatus={store.saveStatus}
        lastSaveError={store.lastSaveError}
        workMode={store.workMode}
        editSelectionMode={store.editSelectionMode}
        canEditSelected={canEditSelected}
        hasSelectedObject={Boolean(store.selectedObject)}
        displayMode={store.settings.displayMode}
        xrayTransparency={store.settings.xrayTransparency}
        showFaceOrientation={Boolean(store.settings.showFaceOrientation)}
        proportionalEnabled={store.settings.proportionalEditing.enabled}
        projection={store.projection}
        showOutliner={showOutliner}
        sceneStats={sceneStats}
        onReturnToGallery={() => {
          void handleReturnToGallery();
        }}
        onCreateProjectModal={() => setProjectModalMode('create')}
        onOpenProjectModal={() => setProjectModalMode('open')}
        onSaveProject={() => {
          void store.saveProject();
        }}
        onSaveAsProjectModal={() => setProjectModalMode('save_as')}
        onImportNativeProject={() => nativeProjectInputRef.current?.click()}
        onExportNativeProject={() => {
          void handleExportNativeFromModeler();
        }}
        onOpenSettingsModal={() => setSettingsModalTab('touch')}
        onImportObj={() => objInputRef.current?.click()}
        onImportStl={() => stlInputRef.current?.click()}
        onImportJpg={() => jpgInputRef.current?.click()}
        onImportPng={() => pngInputRef.current?.click()}
        onExportSelected={() => openExportModal('obj', 'selected')}
        onExportScene={() => openExportModal('obj', 'scene')}
        onExportObj={() =>
          openExportModal('obj', store.selectedObjectId ? 'selected' : 'scene')
        }
        onExportStl={() =>
          openExportModal('stl', store.selectedObjectId ? 'selected' : 'scene')
        }
        onSelectDisplayMode={store.setDisplayMode}
        onChangeXrayTransparency={store.setXrayTransparency}
        onToggleFaceOrientation={store.toggleFaceOrientation}
        onToggleProportional={store.toggleProportionalEditing}
        onChangeProjection={store.setProjection}
        onFocusSelected={() => viewportRef.current?.focusSelected()}
        onToggleWorkMode={store.toggleWorkMode}
        onChangeEditSelectionMode={store.changeEditSelectionMode}
        onToggleOutliner={() => setShowOutliner((prev) => !prev)}
      />

      {/* Main Workspace: Collapsible Left Tool Sidebar + 3D Viewport + Collapsible Outliner */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* B. Barra Lateral Izquierda Unificada de Herramientas */}
        <LeftToolSidebar
          workMode={store.workMode}
          editSelectionMode={store.editSelectionMode}
          edgeSelectionTool={store.edgeSelectionTool}
          activeTool={store.activeTool}
          moveSubMode={store.moveSubMode}
          axisConstraint={store.axisConstraint}
          activeOperatorType={store.operatorSession?.config.type ?? null}
          modalTransformMode={store.modalTransform?.mode ?? null}
          canEditSelected={canEditSelected}
          hasSelectedObject={Boolean(store.selectedObject)}
          hasSelectedComponents={store.selectedComponentIds.size > 0}
          multiSelectTouch={store.settings.multiSelectTouch}
          xrayEditMode={store.settings.displayMode === 'xray'}
          showFaceOrientation={Boolean(store.settings.showFaceOrientation)}
          showGrid={store.settings.showGrid}
          proportionalConfig={store.settings.proportionalEditing}
          proportionalModifierWarning={store.proportionalModifierWarning}
          touchSettings={store.settings.touch}
          effectiveModifiers={effectiveModifiers}
          screenModifiers={store.screenModifiers}
          onSelectTool={(tool) => {
            if (store.operatorSession) store.cancelEditOperator();
            store.setActiveTool(tool);
          }}
          onSelectMoveSubMode={store.setMoveSubMode}
          onChangeAxisConstraint={store.setAxisConstraint}
          onGQuickTapMove={store.triggerGQuickTapMove}
          onGHoldSlide={store.triggerGHoldSlide}
          onToggleWorkMode={store.toggleWorkMode}
          onChangeEditSelectionMode={store.changeEditSelectionMode}
          onChangeEdgeSelectionTool={store.setEdgeSelectionTool}
          onToggleMultiSelectTouch={() =>
            store.updateSettings({
              multiSelectTouch: !store.settings.multiSelectTouch,
            })
          }
          onSelectAll={() => {
            if (store.workMode === 'edit') {
              store.selectAllEditComponents();
            } else {
              store.selectAllSceneObjects();
            }
          }}
          onDeselectAll={() => {
            if (store.workMode === 'edit') {
              store.deselectAllEditComponents();
            } else {
              store.deselectAllSceneObjects();
            }
          }}
          onSelectConnected={store.selectConnectedEditComponents}
          onSetModifier={store.setScreenModifier}
          onToggleModifier={store.toggleScreenModifier}
          onReleaseAllModifiers={store.releaseScreenModifiers}
          onStartOperator={(type) => {
            store.startEditOperator(type);
          }}
          onFillSelection={store.executeFillSelection}
          onConnectVertexPath={store.executeConnectVertexPath}
          onExecuteContextualDelete={store.executeContextualDelete}
          onToggleFaceOrientation={store.toggleFaceOrientation}
          onRecalculateOutside={store.executeRecalculateOutside}
          onFlipNormals={store.executeFlipNormals}
          onToggleXray={store.toggleXrayDisplayMode}
          onToggleGrid={() =>
            store.updateSettings({ showGrid: !store.settings.showGrid })
          }
          onToggleProportional={store.toggleProportionalEditing}
          onToggleProportionalConnected={store.toggleProportionalConnected}
          onChangeProportionalFalloff={store.setProportionalFalloff}
          onChangeProportionalRadius={store.setProportionalRadius}
          onAddPrimitive={(type, options) => store.addPrimitive(type, options)}
          onDuplicateObject={store.duplicateSelectedObject}
          onApplyObjectTransform={store.applyObjectTransform}
          onCenterObjectOrigin={store.centerObjectOrigin}
          onSeparateSelectedGeometry={store.separateSelectedGeometry}
          onFocusCamera={() => viewportRef.current?.focusSelected()}
          onOpenToolSettings={() => setSettingsModalTab('tools')}
        />

        {/* C. Visor 3D */}
        <Viewport3D
          ref={viewportRef}
          objects={store.renderedObjects}
          materials={store.materials}
          selectedObject={store.selectedObject}
          selectedObjectId={store.selectedObjectId}
          selectedObjectIds={store.selectedObjectIds}
          workMode={store.workMode}
          editSelectionMode={store.editSelectionMode}
          edgeSelectionTool={store.edgeSelectionTool}
          selectedComponentIds={store.selectedComponentIds}
          activeTool={store.activeTool}
          axisConstraint={store.axisConstraint}
          projection={store.projection}
          cameraRotationLocked={store.cameraRotationLocked}
          settings={store.settings}
          meshRevision={store.meshRevision}
          toastMessage={store.toastMessage}
          screenShiftActive={store.screenShiftActive}
          screenModifiers={store.screenModifiers}
          operatorSession={store.operatorSession}
          operatorMergedCount={store.operatorMergedCount}
          operatorError={store.operatorError}
          operatorStatusMessage={store.operatorStatusMessage}
          operatorEffectiveMode={store.operatorEffectiveMode}
          loopCutPreviewSegments={store.loopCutPreviewSegments}
          loopCutRingEdgeIds={store.loopCutRingEdgeIds}
          loopCutFaceIds={store.loopCutFaceIds}
          loopCutIsClosed={store.loopCutIsClosed}
          loopCutError={store.loopCutError}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          onSelectObject={store.selectObject}
          onBoxSelectObjects={store.selectObjectsFromBox}
          onSelectComponent={store.selectComponentFromViewport}
          onBoxSelectComponents={store.selectComponentsFromBox}
          onPickLoopCutEdge={store.pickLoopCutEdge}
          onTwoFingerUndo={() => store.undo(true)}
          onThreeFingerRedo={() => store.redo(true)}
          onUndo={() => store.undo()}
          onRedo={() => store.redo()}
          onLiveObjectTransform={handleLiveObjectTransform}
          onCommitObjectTransform={handleCommitObjectTransform}
          onCommitMeshEdit={store.commitMeshEditFromGizmo}
          onUpdateOperatorConfig={store.updateOperatorConfig}
          onConfirmOperator={store.confirmEditOperator}
          onCancelOperator={store.cancelEditOperator}
          onChangeAxisConstraint={store.setAxisConstraint}
          onToggleProjection={store.setProjection}
          onToggleXray={store.toggleXrayDisplayMode}
          onToggleFaceOrientation={store.toggleFaceOrientation}
          onToggleGrid={() =>
            store.updateSettings({ showGrid: !store.settings.showGrid })
          }
          onToggleMultiSelectTouch={() =>
            store.updateSettings({
              multiSelectTouch: !store.settings.multiSelectTouch,
            })
          }
          onToggleScreenShift={store.toggleScreenShift}
          onReleaseScreenModifiers={store.releaseScreenModifiers}
          onEffectiveModifiersChange={setEffectiveModifiers}
          onUpdateTouchSettings={store.updateTouchSettings}
          onUpdateRadialSlot={store.updateRadialSlot}
          onResetRadialSlot={store.resetRadialSlot}
          onResetRadialLayout={store.resetRadialLayout}
          onAddPrimitive={(type, options) => store.addPrimitive(type, options)}
          onSelectTool={(tool) => {
            if (store.operatorSession) store.cancelEditOperator();
            store.setActiveTool(tool);
          }}
          onDuplicateObject={store.duplicateSelectedObject}
          onApplyObjectTransform={store.applyObjectTransform}
          onCenterObjectOrigin={store.centerObjectOrigin}
          onSeparateSelectedGeometry={store.separateSelectedGeometry}
          onHideObject={store.toggleObjectVisibility}
          onDeleteObject={store.deleteSelectedObjects}
          onToggleWorkMode={store.toggleWorkMode}
          onChangeEditSelectionMode={store.changeEditSelectionMode}
          onChangeEdgeSelectionTool={store.setEdgeSelectionTool}
          onSelectEdgeTopology={store.selectEdgeTopology}
          onSelectAll={store.selectAllEditComponents}
          onDeselectAll={store.deselectAllEditComponents}
          onStartOperator={store.startEditOperator}
          onSwitchMergeOperator={store.switchMergeOperator}
          onFillSelection={store.executeFillSelection}
          onConnectVertexPath={store.executeConnectVertexPath}
          onRecalculateOutside={store.executeRecalculateOutside}
          onFlipNormals={store.executeFlipNormals}
          onQuickDissolve={store.executeQuickDissolve}
          onExecuteContextualDelete={store.executeContextualDelete}
          onToggleProportional={store.toggleProportionalEditing}
          onToggleProportionalConnected={store.toggleProportionalConnected}
          onChangeProportionalRadius={store.setProportionalRadius}
          onSaveProject={() => {
            void store.saveProject();
          }}
          onOpenSettings={() => setSettingsModalTab('touch')}
          modalTransform={store.modalTransform}
          modalCancelNonce={store.modalCancelNonce}
          paused={activeView !== 'modeler'}
          onToggleCameraRotationLock={store.toggleCameraRotationLock}
          onChangeModalClamp={store.setModalTransformClamp}
          onCancelModalTransform={store.cancelModalTransform}
          onCompleteModalTransform={store.completeModalTransform}
        />

        {/* D. Panel Lateral Desplegable (Jerarquía y Modificadores) */}
        {showOutliner && (
          <OutlinerPanel
            scenes={store.scenes}
            activeSceneId={store.activeSceneId}
            activeCollectionId={store.activeCollectionId}
            objects={store.renderedObjects}
            selectedObjectId={store.selectedObjectId}
            selectedObjectIds={store.selectedObjectIds}
            workMode={store.workMode}
            editSelectionMode={store.editSelectionMode}
            selectedComponentIds={store.selectedComponentIds}
            liveTransformOverride={liveTransformOverride}
            onSelectObject={store.selectObject}
            onSelectObjectInScene={store.selectObjectInScene}
            onRenameObject={store.renameObject}
            onDuplicateObject={store.duplicateObjectById}
            onToggleVisibility={store.toggleObjectVisibility}
            onToggleLock={store.toggleObjectLock}
            onDeleteObject={store.deleteObject}
            onUpdateObjectTransform={store.updateObjectTransform}
            onUpdateEditCentroidAxis={store.updateSelectedVerticesPosition}
            onCreateScene={() => store.createScene()}
            onSwitchScene={store.switchScene}
            onRenameScene={store.renameScene}
            onDeleteScene={store.deleteScene}
            onCreateCollection={store.createCollection}
            onSelectCollection={store.selectCollection}
            onRenameCollection={store.renameCollection}
            onToggleCollectionExpanded={store.toggleCollectionExpanded}
            onDeleteCollection={store.deleteCollection}
            onMoveObjectToCollection={store.moveObjectToCollection}
            onUpdateReferenceImageProps={store.updateReferenceImageProps}
            modifierDiagnostics={store.selectedModifierDiagnostics.diagnostics}
            evaluatedVertexCount={
              store.selectedModifierDiagnostics.evaluatedVertexCount
            }
            evaluatedFaceCount={
              store.selectedModifierDiagnostics.evaluatedFaceCount
            }
            hasActiveModifiers={
              store.selectedModifierDiagnostics.hasActiveModifiers
            }
            onAddModifier={store.addModifier}
            onUpdateModifier={store.updateModifier}
            onReorderModifier={store.reorderModifier}
            onRemoveModifier={store.removeModifier}
            onApplyModifier={store.applyModifier}
            onRecalculateNormalsOutside={store.recalculateObjectNormalsOutside}
            onFlipNormals={store.flipObjectNormals}
            materials={store.materials}
            displayMode={store.settings.displayMode}
            onActivateMaterialPreview={() => store.setDisplayMode('material')}
            onCreateMaterial={store.createMaterial}
            onRenameMaterial={store.renameMaterial}
            onPushMaterialHistory={store.pushMaterialHistorySnapshot}
            onUpdateMaterial={store.updateMaterial}
            onDuplicateMaterial={store.duplicateMaterial}
            onDeleteMaterial={store.deleteMaterial}
            onAssignMaterialToObjects={store.assignMaterialToObjects}
            onSetObjectShading={store.setObjectShading}
            onClose={() => setShowOutliner(false)}
          />
        )}
      </div>

      {/* Project Gallery Launch Screen Overlay (preserves single ViewportEngine instance underneath) */}
      {activeView === 'gallery' && (
        <ProjectGallery
          projects={store.savedProjects}
          folders={store.folders}
          activeProjectId={store.project.id}
          hasActiveUnsavedChanges={store.hasUnsavedChanges}
          startupRecoveryList={store.startupRecoveryList}
          isReady={store.isGalleryReady}
          toastMessage={store.toastMessage}
          onOpenProject={handleOpenProjectFromGallery}
          onCreateProject={handleCreateProjectFromGallery}
          onRenameProject={store.renameProjectById}
          onDuplicateProject={store.duplicateProjectById}
          onDeleteProjects={store.deleteProjectsByIds}
          onMoveProjectsToFolder={store.moveProjectsToFolder}
          onCreateFolder={store.createFolder}
          onRenameFolder={store.renameFolder}
          onDeleteFolder={store.deleteFolder}
          onExportNativeProject={store.exportNativeProject}
          onImportNativeProject={store.importNativeProject}
          onImportModelFiles={(files, targetFolderId) => {
            void handleGalleryModelFilesSelected(files, targetFolderId);
          }}
          onApplyRecoveryDraft={async (record) => {
            await store.applyRecoveryDraft(record);
            enterModelerWithResetCamera();
          }}
          onDiscardRecoveryDraft={store.discardRecoveryDraft}
          onNotify={store.showToast}
        />
      )}

      {/* Modals */}
      {projectModalMode === 'create' && (
        <NewProjectModal
          folders={store.folders}
          defaultFolderId={store.project.folderId ?? null}
          onClose={() => setProjectModalMode(null)}
          onCreate={async ({ name, templateId, folderId }) => {
            const created = await handleCreateProjectFromGallery(
              name,
              templateId,
              folderId,
            );
            if (created) setProjectModalMode(null);
          }}
        />
      )}

      {(projectModalMode === 'open' || projectModalMode === 'save_as') && (
        <ProjectModal
          initialMode={projectModalMode}
          currentProjectId={store.project.id}
          currentProjectName={store.project.name}
          savedProjects={store.savedProjects}
          onClose={() => setProjectModalMode(null)}
          onCreateProject={(name) => {
            void handleCreateProjectFromGallery(
              name,
              'cube',
              store.project.folderId ?? null,
            );
          }}
          onSaveAsProject={(name) => {
            void store.saveProjectAs(name);
          }}
          onOpenProject={(id) => {
            void handleOpenProjectFromGallery(id);
          }}
          onSaveCurrent={() => {
            void store.saveProject();
          }}
          onDeleteProject={(id) => {
            void store.removeSavedProject(id);
          }}
        />
      )}

      {showReturnGuardModal && (
        <ReturnToGalleryModal
          projectName={store.project.name}
          saving={exitingToGallery}
          onCancel={() => setShowReturnGuardModal(false)}
          onDiscardAndExit={() => {
            setShowReturnGuardModal(false);
            setActiveView('gallery');
          }}
          onSaveAndExit={async () => {
            setExitingToGallery(true);
            const ok = await store.saveProjectSilent();
            setExitingToGallery(false);
            if (ok) {
              setShowReturnGuardModal(false);
              setActiveView('gallery');
            }
          }}
        />
      )}

      {store.pendingRecovery && (
        <RecoveryPromptModal
          record={store.pendingRecovery}
          onCancel={store.dismissPendingRecovery}
          onRecover={async () => {
            if (!store.pendingRecovery) return;
            await store.applyRecoveryDraft(store.pendingRecovery);
            enterModelerWithResetCamera();
          }}
          onDiscardDraft={async () => {
            const targetId = store.pendingRecovery?.projectId;
            if (!targetId) return;
            await store.discardRecoveryDraft(targetId);
            const opened = await store.openProject(targetId, {
              skipRecoveryCheck: true,
            });
            if (opened) enterModelerWithResetCamera();
          }}
        />
      )}

      {settingsModalTab && (
        <SettingsModal
          settings={store.settings}
          sceneStats={sceneStats}
          initialTab={settingsModalTab}
          onUpdateSettings={store.updateSettings}
          onUpdateTouchSettings={store.updateTouchSettings}
          onUpdateTouchModifier={store.updateTouchModifier}
          onUpdateRadialSlot={store.updateRadialSlot}
          onResetRadialSlot={store.resetRadialSlot}
          onResetRadialLayout={store.resetRadialLayout}
          onResetTouchSettings={store.resetTouchSettings}
          onUpdateToolConfig={store.updateToolConfig}
          onUpdateProportionalSettings={store.updateProportionalSettings}
          onResetToolConfig={store.resetToolConfig}
          onResetAllToolConfigs={store.resetAllToolConfigs}
          onClose={() => setSettingsModalTab(null)}
        />
      )}

      {pendingStl && (
        <StlImportModal
          pending={pendingStl}
          onCancel={() => setPendingStl(null)}
          onConfirm={(scale) => {
            void handleConfirmStlImport(scale);
          }}
        />
      )}

      {pendingRefImage && (
        <ReferenceImageImportModal
          payload={pendingRefImage}
          onCancel={() => setPendingRefImage(null)}
          onConfirm={handleConfirmReferenceImage}
        />
      )}

      {exportModalConfig && (
        <ExportModelModal
          initialFormat={exportModalConfig.format}
          initialScope={exportModalConfig.scope}
          sceneObjects={evaluateObjectsForExport(
            store.activeScene.objects,
            store.activeScene.objects,
          )}
          selectedObjectId={store.selectedObjectId}
          onCancel={() => setExportModalConfig(null)}
          onExport={(cfg) => {
            void handleExecuteExport(cfg);
          }}
        />
      )}

      {ioProgress && (
        <IoProgressModal
          title={ioProgress.title}
          label={ioProgress.label}
          progress={ioProgress.progress}
        />
      )}

      {ioError && (
        <IoErrorModal
          title={ioError.title}
          message={ioError.message}
          onClose={() => setIoError(null)}
        />
      )}
    </div>
  );
}
