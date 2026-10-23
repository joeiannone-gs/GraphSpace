
import { BitmapText, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { IProject, IGraph, INestedArray, INode, IIdList, IEdge, IPath, ICommit, IBranch, IBackwardDeltas, IForwardDeltas, Path } from '../proto/compiled';
import { Id, Tensor } from './common';
import nodeTypes, { categories } from '@/app/nodes/nodeTypes'
import { NodeTypeEnum } from '../proto/compiled';
// export enum NodeTypeEnum = NodeTypeEnum
export type NodeCategory = keyof typeof categories;



type MakeRequired<T, L extends keyof T> = {
    [K in L]-?: Exclude<T[K], null | undefined>;
} & T;


type DeepRequired<T, StopAt> = T extends object ? { [K in keyof T]-?: K extends StopAt ? Exclude<T[K], null> : DeepRequired<T[K], stopAt> } : 
    Exclude<T, null | undefined>


export type ForwardDeltas = DeepRequired<IForwardDeltas, "nodeIdMap" | "edgeIdMap" >


export type BackwardDeltas = DeepRequired<IBackwardDeltas, "nodeIdMap" | "edgeIdMap">

export interface Commit extends Required<ICommit> {
    backwardDeltas: BackwardDeltas
}
export interface Branch extends Required<IBranch> {
    forwardDeltas: ForwardDeltas
    backwardDeltas: BackwardDeltas
}

type AvailableTextures = 'baseNode' | 'absNode' | 'absNodeOverlay' | 'nodule'
export interface Graph extends DeepRequired<IGraph, "nodeIdMap" | "edgeIdMap"> { 
    nodeIdMap: { [k: string]: Node}
    edgeIdMap: { [k: string]: Edge}
    gradientPathMap: GradientPathMap
    container?: Container
    thumbnailContainer?: Container
    commitContainer?: Container
}

export interface Project extends MakeRequired<IProject, "id"> {
  commits: {
    [k: string]: Commit;
  };
  branches: {
    [k: string]: Branch;
  };
  branchOrder: string[]
}


export type GraphProperty = keyof Graph

export type NodeIdMap = Graph['nodeIdMap']
export type EdgeIdMap = Graph['edgeIdMap']
export type PathElems = {
  ids: string[];
  edgeIds?: Set<Id>;
}
export interface GradientPathMap extends NonNullable<IGraph['gradientPathMap']> {
  map: {
    [key: string]: PathElems
  }
}



export type NodeValue = Tensor;
export type NestedArray = INestedArray


export interface Edge extends MakeRequired<IEdge, "startPos" | "endPos"> {
  startPos: Pos
  endPos: Pos
  backprop: boolean

  container?: Container
  outline?: Graphics
  line?: Graphics
  startNodule?: Sprite
  endNodule?: Sprite

  thumbnailLine?: Graphics

  commitLine?: Graphics
}

export interface Node extends MakeRequired<INode, "type" | "position"> {
  displayValue?: Tensor,
  position: Pos,

  container?: Container
  mainDisplay?: Container
  outline?: Graphics
  edgeCreationOverlay?: Graphics
  edgeDropOverlay?: Graphics
  absNodeOverlay?: Sprite
  label?: BitmapText

  thumbnailContainer?: Container

  commitContainer?: Contain
}

export type Metadata = DeepRequired<Node['metadata'], "values">


export type NodePropValue = Node[keyof Node]
export type EdgePropValue = Edge[keyof Edge]


export type UpdatableProperty = Exclude<GraphProperty, "gradientPathMap">





export type Commits = Project["commits"];
export type Branches = Project['branches'];
export type Graphs = Project['graphs'];



export type IdList = MakeRequired<IIdList, "edgeIdMap" | "nodeIdMap">





export type DragTargetType = 'node' | 'abs' | 'start-nodule' | 'end-nodule' | null;

export interface DragTarget {
  type: DragTargetType;
  id: Id | null;
}