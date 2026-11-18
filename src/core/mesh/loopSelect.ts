import { EditableMesh, MeshFace } from './EditableMesh';

export type EdgeSelectionTool = 'single' | 'loop' | 'ring';

export interface EdgeLoopSelectionResult {
  valid: boolean;
  edgeIds: string[];
  isClosed: boolean;
  kind: 'loop' | 'ring';
  reason?: string;
}

/**
 * Checks whether a vertex lies along a manifold edge-loop continuation from `currEdgeId`.
 * Supports:
 * 1. Interior 4-valence manifold vertices (opposite edge sharing 0 faces with `currEdgeId`).
 * 2. Open mesh boundary edges (`faces.length === 1`) when the vertex has a unique other boundary edge.
 * 3. Wireframe chains (`faces.length === 0` everywhere around the vertex, degree 2).
 * 4. N-gon cap rims (valence-3 vertex where `currEdgeId` borders an N-gon > 4 verts and quads).
 */
function findNextLoopEdgeAtVertex(
  mesh: EditableMesh,
  currEdgeId: string,
  vertexId: string,
): string | null {
  const currEdge = mesh.getEdge(currEdgeId);
  if (!currEdge) return null;

  const currFaces = mesh.getFacesForEdge(currEdgeId);
  if (currFaces.length > 2) return null; // non-manifold edge

  const incEdges = mesh.getEdgesForVertex(vertexId);
  const incFaces = mesh.getFacesForVertex(vertexId);

  // Case 1: Pure wireframe chain (degree 2, no faces)
  if (currFaces.length === 0 && incFaces.length === 0) {
    if (incEdges.length !== 2) return null;
    const other = incEdges.find((eid) => eid !== currEdgeId) ?? null;
    if (!other || mesh.getFacesForEdge(other).length !== 0) return null;
    return other;
  }

  // Case 2: Open boundary edge (1 adjacent face)
  if (currFaces.length === 1) {
    const boundaryCandidates = incEdges.filter(
      (eid) => eid !== currEdgeId && mesh.getFacesForEdge(eid).length === 1,
    );
    if (boundaryCandidates.length === 1) {
      return boundaryCandidates[0];
    }
    return null;
  }

  // Case 3: Interior manifold edge (2 adjacent faces)
  const currFaceSet = new Set(currFaces);

  // 3a. Standard 4-valence manifold grid vertex: pick the opposite edge sharing 0 faces with currEdge
  if (incEdges.length === 4 && incFaces.length === 4) {
    // Ensure all incident edges at this vertex are manifold (<= 2 faces)
    for (const eid of incEdges) {
      if (mesh.getFacesForEdge(eid).length !== 2) return null;
    }
    const nonAdjacent: string[] = [];
    for (const eid of incEdges) {
      if (eid === currEdgeId) continue;
      const eFaces = mesh.getFacesForEdge(eid);
      const sharesFace = eFaces.some((fid) => currFaceSet.has(fid));
      if (!sharesFace) {
        nonAdjacent.push(eid);
      }
    }
    if (nonAdjacent.length === 1) {
      return nonAdjacent[0];
    }
    return null;
  }

  // 3b. Valence-3 N-gon cap rim (e.g. closed cylinder top/bottom cap where an N-gon > 4 meets quads)
  if (incEdges.length === 3 && incFaces.length === 3) {
    const ngonFaces: MeshFace[] = [];
    let quadCount = 0;
    for (const fid of currFaces) {
      const f = mesh.getFace(fid);
      if (!f) continue;
      if (f.vertexIds.length > 4) ngonFaces.push(f);
      else if (f.vertexIds.length === 4) quadCount++;
    }
    if (ngonFaces.length === 1 && quadCount === 1) {
      const ngonId = ngonFaces[0].id;
      const ngonOtherEdge = incEdges.find(
        (eid) => eid !== currEdgeId && mesh.getFacesForEdge(eid).includes(ngonId),
      );
      if (ngonOtherEdge && mesh.getFacesForEdge(ngonOtherEdge).length === 2) {
        return ngonOtherEdge;
      }
    }
  }

  // Pole (valence != 4, e.g. UV sphere pole, cube corner, T-junction) -> stop cleanly
  return null;
}

/**
 * True topological Edge Loop walk starting from `startEdgeId`.
 * Walks across both endpoints until hitting poles, open boundaries, or closing the loop.
 */
export function findEdgeLoop(
  mesh: EditableMesh,
  startEdgeId: string,
): EdgeLoopSelectionResult {
  const startEdge = mesh.getEdge(startEdgeId);
  if (!startEdge) {
    return {
      valid: false,
      edgeIds: [],
      isClosed: false,
      kind: 'loop',
      reason: 'Arista no encontrada en la malla.',
    };
  }

  const startFaces = mesh.getFacesForEdge(startEdgeId);
  if (startFaces.length > 2) {
    return {
      valid: false,
      edgeIds: [],
      isClosed: false,
      kind: 'loop',
      reason: 'La arista seleccionada es no múltiple (más de 2 caras).',
    };
  }

  const visited = new Set<string>([startEdgeId]);

  const walkDirection = (initialVertId: string): { edges: string[]; closed: boolean } => {
    const collected: string[] = [];
    let currEdgeId = startEdgeId;
    let currVertId = initialVertId;
    const maxSteps = mesh.edges.length + 2;

    for (let step = 0; step < maxSteps; step++) {
      const nextEdgeId = findNextLoopEdgeAtVertex(mesh, currEdgeId, currVertId);
      if (!nextEdgeId) {
        return { edges: collected, closed: false };
      }
      if (nextEdgeId === startEdgeId) {
        return { edges: collected, closed: true };
      }
      if (visited.has(nextEdgeId)) {
        return { edges: collected, closed: false };
      }
      const nextEdge = mesh.getEdge(nextEdgeId);
      if (!nextEdge) break;

      visited.add(nextEdgeId);
      collected.push(nextEdgeId);
      currVertId = nextEdge.v0 === currVertId ? nextEdge.v1 : nextEdge.v0;
      currEdgeId = nextEdgeId;
    }

    return { edges: collected, closed: false };
  };

  const forward = walkDirection(startEdge.v1);
  let ordered: string[];
  let isClosed = forward.closed;

  if (isClosed) {
    ordered = [startEdgeId, ...forward.edges];
  } else {
    const backward = walkDirection(startEdge.v0);
    ordered = [...backward.edges.reverse(), startEdgeId, ...forward.edges];
    isClosed = backward.closed;
  }

  if (ordered.length < 2) {
    return {
      valid: false,
      edgeIds: ordered,
      isClosed: false,
      kind: 'loop',
      reason: 'Esta arista no continúa en un Edge Loop válido (termina en polos o esquinas).',
    };
  }

  return {
    valid: true,
    edgeIds: ordered,
    isClosed,
    kind: 'loop',
  };
}

function getOppositeQuadEdge(
  mesh: EditableMesh,
  face: MeshFace,
  edgeId: string,
): string | null {
  if (face.vertexIds.length !== 4) return null;
  const edge = mesh.getEdge(edgeId);
  if (!edge) return null;
  const verts = face.vertexIds;
  for (let i = 0; i < 4; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 4];
    if ((a === edge.v0 && b === edge.v1) || (a === edge.v1 && b === edge.v0)) {
      const oppA = verts[(i + 2) % 4];
      const oppB = verts[(i + 3) % 4];
      return mesh.findEdgeId(oppA, oppB) ?? null;
    }
  }
  return null;
}

/**
 * True topological Edge Ring walk starting from `startEdgeId`.
 * Walks parallel opposite edges across quad faces; stops cleanly at boundaries, triangles, N-gons, or cycles.
 */
export function findEdgeRing(
  mesh: EditableMesh,
  startEdgeId: string,
): EdgeLoopSelectionResult {
  const startEdge = mesh.getEdge(startEdgeId);
  if (!startEdge) {
    return {
      valid: false,
      edgeIds: [],
      isClosed: false,
      kind: 'ring',
      reason: 'Arista no encontrada en la malla.',
    };
  }

  const startFaces = mesh.getFacesForEdge(startEdgeId);
  if (startFaces.length === 0) {
    return {
      valid: false,
      edgeIds: [],
      isClosed: false,
      kind: 'ring',
      reason: 'La arista seleccionada no tiene caras cuadrangulares adyacentes.',
    };
  }
  if (startFaces.length > 2) {
    return {
      valid: false,
      edgeIds: [],
      isClosed: false,
      kind: 'ring',
      reason: 'La arista seleccionada es no múltiple (más de 2 caras).',
    };
  }

  const visited = new Set<string>([startEdgeId]);

  const walkThroughFace = (initialFaceId: string): { edges: string[]; closed: boolean } => {
    const collected: string[] = [];
    let currEdgeId = startEdgeId;
    let currFaceId: string | null = initialFaceId;
    const maxSteps = mesh.faces.length + 2;

    for (let step = 0; step < maxSteps && currFaceId; step++) {
      const face = mesh.getFace(currFaceId);
      if (!face || face.vertexIds.length !== 4) {
        return { edges: collected, closed: false };
      }

      const oppEdgeId = getOppositeQuadEdge(mesh, face, currEdgeId);
      if (!oppEdgeId) {
        return { edges: collected, closed: false };
      }
      if (oppEdgeId === startEdgeId) {
        return { edges: collected, closed: true };
      }
      if (visited.has(oppEdgeId)) {
        return { edges: collected, closed: false };
      }

      const oppFaces = mesh.getFacesForEdge(oppEdgeId);
      if (oppFaces.length > 2) {
        return { edges: collected, closed: false };
      }

      visited.add(oppEdgeId);
      collected.push(oppEdgeId);

      if (oppFaces.length < 2) {
        // Reached an open mesh boundary cleanly after adding boundary opposite edge
        return { edges: collected, closed: false };
      }

      const nextFaceId: string | undefined =
        oppFaces[0] === currFaceId ? oppFaces[1] : oppFaces[0];
      currEdgeId = oppEdgeId;
      currFaceId = nextFaceId ?? null;
    }

    return { edges: collected, closed: false };
  };

  const dirA = walkThroughFace(startFaces[0]);
  let ordered: string[];
  let isClosed = dirA.closed;

  if (isClosed) {
    ordered = [startEdgeId, ...dirA.edges];
  } else if (startFaces.length === 2) {
    const dirB = walkThroughFace(startFaces[1]);
    ordered = [...dirB.edges.reverse(), startEdgeId, ...dirA.edges];
    isClosed = dirB.closed;
  } else {
    ordered = [startEdgeId, ...dirA.edges];
  }

  if (ordered.length < 2) {
    return {
      valid: false,
      edgeIds: ordered,
      isClosed: false,
      kind: 'ring',
      reason: 'Esta arista no pertenece a un Edge Ring cuadrangular válido.',
    };
  }

  return {
    valid: true,
    edgeIds: ordered,
    isClosed,
    kind: 'ring',
  };
}

export function resolveEdgeLoopSelection(
  mesh: EditableMesh,
  startEdgeId: string,
  kind: 'loop' | 'ring',
): EdgeLoopSelectionResult {
  return kind === 'ring'
    ? findEdgeRing(mesh, startEdgeId)
    : findEdgeLoop(mesh, startEdgeId);
}
