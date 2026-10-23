import { Id } from "@/app/types/common";
import { Edge } from '@/app/types/main';
import { Node } from '@/app/types/main';




type ImmutableProp = { [K in 'position' | 'childrenScale' | 'parent']: Node[K]}
export type ChangedNodeProps = Record<Id, ImmutableProp >

type MutableProp = { [K in 'children' | 'incomingEdges' | 'outgoingEdges']: Node[K]}
export type NodePropAdditions = Record<Id, MutableProp >

export type NodePropSubtractions = NodePropAdditions


export class NodeAccumulator {
  all: Record<Id, Set<keyof Node>> = {}
  update: ChangedNodeProps = {}
  add: NodePropAdditions = {}
  sub: NodePropSubtractions = {}

    createEntry<EntryType extends 'update' | 'add' | 'sub'>(entryType: EntryType, id: Id, property: keyof Node, value: Node[keyof Node]) {

    
      const entry = this[entryType][id] || {}
      this[entryType][id] = entry

      if (!this.all[id]) this.all[id] = new Set();


      if (entryType === 'add' || entryType === 'sub') {
        const mutableEntry = entry as MutableProp
        const mutableProperty = property as keyof MutableProp 

        if (!mutableEntry[mutableProperty]) mutableEntry[mutableProperty] = []
        mutableEntry[mutableProperty].push(...value as Node[keyof MutableProp] || []) 
        
        this.all[id].add(mutableProperty)

      } else if (entryType === "update") {
        const immutableEntry = entry as ImmutableProp
        const immutableProperty = property as keyof ImmutableProp

        immutableEntry[immutableProperty] = value as Node[keyof ImmutableProp]

        this.all[id].add(immutableProperty)
      }
    }

    get allIds() {      
      return new Set(Object.keys(this.all))
    }
}




export class EdgeAccumulator {
  all: Record<Id, Set<keyof Edge>> = {}
  update: Map<Id,  { [K in keyof Edge]+?: Edge[K] }> = new Map()

  createEntry<Type extends keyof Edge>(entryType: 'update', id: Id, property: Type, value: Edge[Type]) {

    if (!this.all[id]) this.all[id] = new Set();
    if (!this[entryType].get(id) ) this[entryType].set(id, {})
    
    const changes = this[entryType].get(id)
    if (changes) changes[property] = value

    this.all[id].add(property);
  }
  
}


