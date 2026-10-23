import { Container } from 'pixi.js';
import { getOmitted } from '../nodes/nodeDisplays/components/helpers';
import { ViewportValues } from '../store/features/workspace/workspaceTypes';
import { ArrayRange, Id, Pos, Size, Slice, Tensor } from '../types/common';
import { EdgeIdMap, Graph } from '../types/main';
import { NODE_RADIUS } from '@/app/sizing/nodes';


export const generateId  = (length: number): Id => [...Array(length)].map(() =>
  Math.floor(Math.random()* 16).toString(16)).join('');

export function normalizeValue(value: number, oldMin: number, oldMax: number, newMin: number, newMax: number): number {
    return ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
}


export function findMinMaxXY(points: number[][]): {minX: number, maxX: number, minY: number, maxY: number} {
    let minX = points[0][0], maxX = points[0][0], minY = points[0][1], maxY = points[0][1];
    for(let i = 1; i < points.length; i++) {
        minX = Math.min(minX, points[i][0]);
        maxX = Math.max(maxX, points[i][0]);
        minY = Math.min(minY, points[i][1]);
        maxY = Math.max(maxY, points[i][1]);
    }
    return {minX, maxX, minY, maxY};
}


export const getCenterAndScale = (positions: Pos[], radii: number, containerRadius: number) => {
    let centerX = 0;
    let centerY = 0;
    let newScale = 1;

    const numPositions = positions?.length;

    if (numPositions && numPositions !== 0) {
        // Calculate the bounding box of the objects
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < positions.length; i++) {
            const position = positions[i];
            minX = Math.min(minX, position[0] - radii);
            minY = Math.min(minY, position[1] - radii);
            maxX = Math.max(maxX, position[0] + radii);
            maxY = Math.max(maxY, position[1] + radii);
        }

        // Calculate the center of the bounding box
        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;

        // Calculate the maximum distance from the center to any corner of the bounding box
        const maxDist = Math.max(
            Math.sqrt((maxX - centerX) ** 2 + (maxY - centerY) ** 2),
            Math.sqrt((maxX - centerX) ** 2 + (minY - centerY) ** 2),
            Math.sqrt((minX - centerX) ** 2 + (maxY - centerY) ** 2),
            Math.sqrt((minX - centerX) ** 2 + (minY - centerY) ** 2)
        );

        // Adjust scale to fit all points within the container radius
        newScale = containerRadius / maxDist;
    }

    if (numPositions === 1) newScale = (containerRadius / radii) * 0.8

    return {centerX, centerY, newScale};
}


export const calculateCentroid = (positions: Pos[]): Pos => {
    if (positions.length === 0) return [0, 0];

    let sumX = 0;
    let sumY = 0;
    positions.forEach(position => {
        sumX += position[0];
        sumY += position[1];
    });

    return [sumX / positions.length, sumY / positions.length];
}

/**
 * Imagine two circles, one whose center is @param startposition and radius is @param r1 and the other whose center is @param endPosition
 * and has radius @param r2 . Now draw a line from the first circle's center to the second circle's center. This function returns
 * the segment of the line outside of both circles. @return the starting and ending points of the line
 */
export const shortestEdge = ( startPosition: Pos, endPosition: Pos, r1: number, r2: number ): {
    closest1: Pos;
    closest2: Pos;
  } => {

  const x1 = startPosition[0];
  const x2 = endPosition[0];
  const y1 = startPosition[1];
  const y2 = endPosition[1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const unitVector = [dx / distance, dy / distance];

  const closest1: Pos = [x1 + r1 * unitVector[0], y1 + r1 * unitVector[1]];
  const closest2: Pos = [x2 - r2 * unitVector[0], y2 - r2 * unitVector[1]];

  return {closest1, closest2}
}

/**
 * Calculates the intersection of two lines.
 *
 * First line is @param p0 to @param p1
 * Second line is @param p2 to @param p3
 */
export function lineIntersection(p0: Pos, p1: Pos, p2: Pos, p3: Pos) {
    const A1 = p1[1] - p0[1];
    const B1 = p0[0] - p1[0];
    const C1 = A1 * p0[0] + B1 * p0[1];

    const A2 = p3[1] - p2[1];
    const B2 = p2[0] - p3[0];
    const C2 = A2 * p2[0] + B2 * p2[1];

    const det = A1 * B2 - A2 * B1;

    if (det === 0) {
        return null
    } else {
        const x = (B2 * C1 - B1 * C2) / det;
        const y = (A1 * C2 - A2 * C1) / det;
        return [x, y] as Pos
    }
}

export const calculateRelativePosition = (globalPos: Pos, localPos: Pos, scale?: number) => {
    let x = scale ? ((globalPos[0] - localPos[0]) / scale) : (globalPos[0] - localPos[0]);
    let y = scale ? ((globalPos[1] - localPos[1]) / scale) : (globalPos[1] - localPos[1]);

    return [x, y] as Pos
}



export function truncateString(str: string, maxLength: number) {
    if (!str) {
        console.error('No string to truncate')
        return ''
    }
    // Check if the string's length is greater than the maximum allowed length
    if (str.length > maxLength) {
      // If so, truncate the string to the maxLength minus 3 (to accommodate the ellipsis) and append '...'
      return str.substring(0, maxLength - 3) + '...';
    } else {
      // If the string is within the limit, return it as is
      return str;
    }
  }


  export function screenToWorld(screenPos: Pos, viewportValues: ViewportValues): Pos {
    const screenX = screenPos[0]
    const screenY = screenPos[1]
    // Normalize screen coordinates to [0, 1]
    const normalizedX = screenX / window.innerWidth;
    const normalizedY = screenY / window.innerHeight;

    // Scale normalized coordinates to world space
    const worldWidth = viewportValues.bottomRight[0] - viewportValues.topLeft[0];
    const worldHeight = viewportValues.bottomRight[1] - viewportValues.topLeft[1];
    const worldX = viewportValues.topLeft[0] + normalizedX * worldWidth;
    const worldY = viewportValues.topLeft[1] + normalizedY * worldHeight;

    return [worldX, worldY];
}

export function worldToScreen(worldPos: Pos, viewportValues: ViewportValues): Pos {
    const worldX = worldPos[0];
    const worldY = worldPos[1];

    // Get world space dimensions
    const worldWidth = viewportValues.bottomRight[0] - viewportValues.topLeft[0];
    const worldHeight = viewportValues.bottomRight[1] - viewportValues.topLeft[1];

    // Convert world coordinates to normalized [0,1] space
    const normalizedX = (worldX - viewportValues.topLeft[0]) / worldWidth;
    const normalizedY = (worldY - viewportValues.topLeft[1]) / worldHeight;

    // Scale to screen space
    const screenX = normalizedX * window.innerWidth;
    const screenY = normalizedY * window.innerHeight;

    return [screenX, screenY];
}

export const isPointWithinCircle = (point: Pos, circleRadius: number, circleCenter: Pos) => {
    const dx = point[0] - circleCenter[0];
    const dy = point[1] - circleCenter[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circleRadius;
}

export const calculatePointDifference = (point1: Pos, point2: Pos): Pos => {
    const diffX = point1[0] - point2[0];
    const diffY = point1[1] - point2[1];
    return [diffX, diffY];
}

export const findCircleLineIntersections = (circleCenter: Pos, radius: number, point: Pos): Pos[] => {
    const [cx, cy] = circleCenter;
    const [px, py] = point;

    // Calculate the direction vector from circleCenter to point
    const dx = px - cx;
    const dy = py - cy;

    // Parametric line equation is circleCenter + t * direction
    // Circle equation is (x - cx)^2 + (y - cy)^2 = radius^2
    // Substitute the line equation into the circle equation and solve for t
    const A = dx * dx + dy * dy;
    const B = 2 * (dx * (cx - cx) + dy * (cy - cy));
    const C = (cx - cx) * (cx - cx) + (cy - cy) * (cy - cy) - radius * radius;

    const det = B * B - 4 * A * C;
    
    // Calculate both solutions for t
    const t1 = (-B + Math.sqrt(det)) / (2 * A);
    const t2 = (-B - Math.sqrt(det)) / (2 * A);

    // Calculate intersection points
    const intersection1: Pos = [cx + t1 * dx, cy + t1 * dy];
    const intersection2: Pos = [cx + t2 * dx, cy + t2 * dy];

    return [intersection1, intersection2];
    
}

export const pointComparison = (p1: Pos, p2: Pos, p3: Pos, mode: 'closest' | 'furthest'): Pos => {
    const dist1 = Math.sqrt((p1[0] - p3[0]) ** 2 + (p1[1] - p3[1]) ** 2);
    const dist2 = Math.sqrt((p2[0] - p3[0]) ** 2 + (p2[1] - p3[1]) ** 2);
    if (mode === 'closest') {
        return dist1 < dist2 ? p1 : p2;
    } else {
        return dist1 > dist2 ? p1 : p2;
    }
}

export const calculateDistance = (point1: Pos, point2: Pos): number => {
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}


export const isCircleContainedInBox = (circleCenter: Pos, circleRadius: number, boxCenter: Pos, boxSize: Size) => {
    const [circleX, circleY] = circleCenter;
    const [boxCenterX, boxCenterY] = boxCenter;
    const [boxWidth, boxHeight] = boxSize;

    // Calculate the box's upper-left and lower-right corners
    const boxUpperLeftX = boxCenterX - boxWidth / 2;
    const boxUpperLeftY = boxCenterY - boxHeight / 2;
    const boxLowerRightX = boxCenterX + boxWidth / 2;
    const boxLowerRightY = boxCenterY + boxHeight / 2;

    // Check all sides
    const isLeftInside = (circleX - circleRadius) >= boxUpperLeftX;
    const isRightInside = (circleX + circleRadius) <= boxLowerRightX;
    const isTopInside = (circleY - circleRadius) >= boxUpperLeftY;
    const isBottomInside = (circleY + circleRadius) <= boxLowerRightY;

    return isLeftInside && isRightInside && isTopInside && isBottomInside;
}


export const calculateNodesWithinBrush = (abstractionNodesInFocus: Id[], graph: Graph, brush: [Pos, Pos]) => {

    let nodesToCheck: Id[] = []
    const selectedNodes: Id[] = []


    if (abstractionNodesInFocus.length > 0) {
        //Get All children of each abstraction node that is in focus
        let childrenIds: Id[] = []
        abstractionNodesInFocus.forEach((absId: Id) => {
            const absChildrenIds= graph?.nodeIdMap[absId].children || []
            childrenIds = childrenIds.concat(absChildrenIds)
        })
        nodesToCheck = childrenIds ?? []
    } else {
        //If not, check all nodes without a parent
        const allTopLevelNodes = Object.keys(graph?.nodeIdMap || {}).filter((nodeId: Id) => !graph.nodeIdMap[nodeId].parent);
        // const allTopLevelNodes = Object.keys(graph?.nodeIdMap || {})
        nodesToCheck = allTopLevelNodes
    }

    //Of the nodesToCheck, which ones are fully in the selection brush?

    nodesToCheck.forEach((nodeId: Id) => {
        const node = graph.nodeIdMap[nodeId]
        const scaler = node.parent ? graph.nodeIdMap[node.parent]?.childrenScale : 1
        const nodeRadius = scaler  * NODE_RADIUS
        const brushCenter = [(brush[0][0] + brush[1][0]) / 2, (brush[0][1] + brush[1][1]) / 2] as Pos
        const brushSize = [Math.abs(brush[0][0] - brush[1][0]), Math.abs(brush[0][1] - brush[1][1])] as Size
        if (isCircleContainedInBox(node?.position, nodeRadius, brushCenter, brushSize)) {
            selectedNodes.push(nodeId)
        }
    })

    return selectedNodes
}


export function calculateEdgesWithinBrush(graph: Graph, brush: [Pos, Pos]) {

    const edgesWithinBrush = new Set<Id>()

    for ( let [id, edge] of Object.entries(graph.edgeIdMap)) {
        const isPointWithinBrush = (pos: Pos) => {
            const x = pos[0]
            const y = pos[1]
            const isWithinX = x >= Math.min(brush[0][0], brush[1][0]) && x <= Math.max(brush[0][0], brush[1][0])
            const isWithinY = y >= Math.min(brush[0][1], brush[1][1]) && y <= Math.max(brush[0][1], brush[1][1])
            return isWithinX && isWithinY
        }

        const startInBrush = isPointWithinBrush(edge.startPos)
        const endInBrush = isPointWithinBrush(edge.endPos)
        
        if (startInBrush && endInBrush) edgesWithinBrush.add(id)
    }

    return edgesWithinBrush
}



export const getDepth = (tensor: Tensor): number => {
    let depth = 0;
    let current = tensor;
    while (Array.isArray(current)) {
        depth++;
        current = current[0];
    }
    return depth;
};

export function truncateArray(array: Tensor, maxElems = 5, maxStringLength = 10) {
    function _truncateRecursive(arr: Tensor, depth = 0): number | Tensor {
      // Base case: if not an array, process numbers for precision or return the value as is.
      if (!Array.isArray(arr)) {
        if (typeof arr === 'number') {
          if (arr.toString().length > maxStringLength) {
            return Number(arr.toPrecision(maxStringLength));
          }
        }
        return arr;
      }
  
      if (arr.length > maxElems) {
        const firstPart = arr.slice(0, maxElems - 1).map(item => _truncateRecursive(item, depth + 1));
        const omittedSlice = arr.slice(maxElems - 1, arr.length - 1);
        let omittedCount = 0;
        for (const item of omittedSlice) {
          if (typeof item === 'string') {
            const match = item.match(/^\.\.\.(\d+)\.\.\.$/);
            if (match) {
              omittedCount += getOmitted(item) + 1
            }
          } else {
              omittedCount += 1;
          }
        }
        const lastPart = [_truncateRecursive(arr[arr.length - 1], depth + 1)];
        
        return [...firstPart, `...${omittedCount}...`, ...lastPart];
      } else {
        return arr.map(item => _truncateRecursive(item, depth + 1));
      }
    }
  
    return _truncateRecursive(array);
  }
  

  
export function isRectangular(arr: Tensor): boolean {
    if (!Array.isArray(arr)) {
      return true;  // Base case: non-array elements are considered "rectangular"
    }
  
    if (arr.length === 0) {
      return true;  // Empty arrays are considered rectangular
    }
  
    const firstElementShape = getShape(arr[0]);
  
    const res = arr.every(element => {
      // Skip elements that contain "..."
      if ((typeof element === 'string') && element.includes("...")) return true;
      
      const shape = getShape(element);
      return isEqualShape(shape, firstElementShape) && isRectangular(element);
    });

    return res
  }
  
  export function getShape(arr: Tensor) {
    let shape = [];
    let current = arr;
    while (Array.isArray(current)) {
      shape.push(current.length);
      current = current[0];
    }
    return shape;
  }
  
  export function isEqualShape(shape1: number[], shape2: number[]) {
    return shape1.length === shape2.length && 
           shape1.every((dim, i) => dim === shape2[i]);
  }




export function isPositionInSlice(pos: number[], slice: Slice ) {
    // If position has more dimensions than slice, return false
    if (pos.length > slice.length) return false;

    // Check each dimension
    for (let i = 0; i < pos.length; i++) {
        const currentPos = pos[i];
        const currentSlice = slice[i];
        
        // Check if position is within slice range
        if (!isIndexInRange(currentPos, currentSlice)) {
            return false;
        }
    }

    return true;
}



export function isIndexInRange(num: number, range: ArrayRange) {
    let [start, stop, stride] = range;
    if (stride === 0) throw new Error("Stride cannot be zero.");

    // If stop is not the sentinel (-1) and start is greater than stop, swap them.
    if (stop !== -1 && start > stop) {
        [start, stop] = [stop, start];
    }
    
    // If stop is -1, interpret it as Infinity (i.e., the whole length of the array)
    const effectiveStop = stop === -1 ? Infinity : stop;

    return num >= start && num < effectiveStop && (num - start) % stride === 0;
}



export function updateScaleAndPositions(graph: Graph, container: Container, size: Size) {
  const padding = 2
  const nodes = Object.values(graph.nodeIdMap)
  const positions = [];
  for (let i = 0; i < nodes.length; i++) {
      positions.push(nodes[i].position);
  }
  const { centerX, centerY, newScale} = getCenterAndScale(positions, NODE_RADIUS, size[1]/2)
  container.pivot.set(centerX, centerY)
  container.position.set(size[0]/2, size[1]/2)
  container.scale.set(newScale)
}