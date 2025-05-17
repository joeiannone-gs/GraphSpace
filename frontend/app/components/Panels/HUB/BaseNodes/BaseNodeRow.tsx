import { categories, nodeTypes} from '@/app/nodes/nodeTypes';
import { NodeThumbnail } from './NodeThumbnail';
import { NodeCategory, NodeTypeEnum } from '@/app/types/main';






export function BaseNodeRow({cat}: {cat: NodeCategory }){


    return (
        <div>
            <h3 style={{fontFamily: 'Century Gothic', color: 'grey'}}>{cat}</h3>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap',
                border: '1px solid rgba(0,0,0,0.9)',
                padding: '1rem',
                borderRadius: '0.5rem'
            }}>
                {Object.entries(nodeTypes).map(([nodeType, nodeInfo]) => 
                    nodeInfo.category === cat ? <NodeThumbnail key={nodeType} type={Number(nodeType)} /> : null
                )}
            </div>
        </div>
    )
}