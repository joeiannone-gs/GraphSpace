import { selectCurrentProject } from '@/app/store/features/workspace/selectors/project'
import store from '@/app/store/store'
import {  Branches, Commits } from '@/app/types/main'
import * as PIXI from 'pixi.js'
import { Id, Pos } from '@/app/types/common'
import { edgeLineGraphic } from '@/app/services/graphics'
import { selectBranches, selectCommitIdMap } from '@/app/store/features/workspace/selectors/commitHistory'
import {  shortestEdge, updateScaleAndPositions } from '@/app/services/math'
import { graphController, graphs } from '@/app/globalObjs'


const COMMIT_SPACING = 100
const BRANCH_SPACING = 125
const COMMIT_NODE_RADIUS = 30
const SAVE_NODE_RADIUS = COMMIT_NODE_RADIUS
const ARROW_SIZE = 3

export class CommitGraph { 

    pixiContainer = new PIXI.Container()

    renderer: PIXI.Renderer
    ticker: PIXI.Ticker
    commits: Commits = {}
    branches: Branches = {}
    branchOrder: Id[] = []
    commitPositions = new Map<Id, Pos> 
    onNewBranch;
    currentBranchName: string = "main"

    currentBranchIndicator = new PIXI.Graphics();
    commitGraphContainer = new PIXI.Container()

    constructor(renderer: PIXI.Renderer, ticker: PIXI.Ticker, onNewBranch: (commitId: Id) => void) {

        this.renderer = renderer
        this.ticker = ticker
        this.onNewBranch = onNewBranch
        this.pixiContainer.addChild(this.currentBranchIndicator)
        this.pixiContainer.addChild(this.commitGraphContainer)
        
        const project = selectCurrentProject(store.getState().workspace)!

        this.currentBranchName = store.getState().workspace.currentBranchName ?? "main"
        this.commits = project?.commits ?? {}
        this.branches = project.branches 
        this.branchOrder = project.branchOrder

        this.createGraph()
        this.createCurrentBranchIndicator()

        const updateFunction = () => {
            const branchesChanged = selectBranches(store.getState().workspace) !== this.branches
            const commitsChanged = selectCommitIdMap(store.getState().workspace) !== this.commits

            const shouldUpdateGraph = branchesChanged || commitsChanged

            this.commits = selectCommitIdMap(store.getState().workspace) ?? {}
            this.branches = selectBranches(store.getState().workspace) ?? {}
            this.branchOrder = selectCurrentProject(store.getState().workspace)?.branchOrder  ?? []

            if (shouldUpdateGraph) {
                this.commitGraphContainer.removeChildren()
                this.createGraph()
            }
            const shouldUpdateIndicator = (this.currentBranchName !== store.getState().workspace.currentBranchName) || shouldUpdateGraph
            if (shouldUpdateIndicator) {
                this.createCurrentBranchIndicator()
                this.currentBranchName = store.getState().workspace.currentBranchName ?? "main"
            }
        }

        this.ticker.add(updateFunction)
    
        
    }

    private createGraph() {
        let currentPosition = [0, -BRANCH_SPACING] as Pos

        const renderedCommits = new Set<Id>()

        for (let branchId of this.branchOrder) {
            
            const branch = this.branches[branchId]

            currentPosition = this.branchSpan(branchId)[1]

            let curr = branch?.latestCommitId
            let arrowEnd: Pos;
            if (curr) {
                if (this.commits[curr]?.branchName == branch.name) {
                    arrowEnd = [currentPosition[0] - COMMIT_SPACING, currentPosition[1]] as Pos
                } else {
                    const branchedPosition = this.commitPositions.get(curr)?? [0,0]
                    arrowEnd = branchedPosition 
                }
                this.createArrow(currentPosition, arrowEnd, 0.5)
            }

            this.createSaveNode(currentPosition, branchId)


            while (curr && this.commits[curr]?.branchName === branch.name) {
                currentPosition = [currentPosition[0] - COMMIT_SPACING, currentPosition[1]]
                this.commitPositions.set(curr, currentPosition)
                this.createCommitNode(currentPosition, curr)
                renderedCommits.add(curr)
                const prevCommitId = this.commits[curr].prevCommitId
                const prevCommit = this.commits[prevCommitId ?? ""]
                if (prevCommit) {
                    let arrowEnd: Pos;
                    if (prevCommit.branchName == branch.name) {
                        arrowEnd = [currentPosition[0] - COMMIT_SPACING, currentPosition[1]]
                        curr = prevCommitId
                    } else {
                        arrowEnd = this.commitPositions.get(prevCommitId ?? "") ?? [0,0]
                        curr = null
                    }
                    this.createArrow(currentPosition, arrowEnd)
                } else {
                    curr = null
                }
            }
        }
    }

    private createCommitNode(pos: Pos, commitId: Id) {

        const container = new PIXI.Container()

        const graphContainer = graphController.getDisplay(commitId, 'commit', this.renderer)
        fitWithinNodeInterval(commitId, graphContainer)
        const c0 = new PIXI.Container()
        c0.addChild(graphContainer)
        c0.pivot.set(SAVE_NODE_RADIUS)
        const circle = new PIXI.Graphics()
        circle.circle(0, 0, COMMIT_NODE_RADIUS)
        circle.stroke({color: 0xFFFFFF})
        const branchButton = createBranchButton(() => this.onNewBranch(commitId))
        container.addChild(c0)
        container.addChild(circle)
        container.addChild(branchButton)
        container.x = pos[0]; container.y = pos[1]
        this.commitGraphContainer.addChild(container)
    }
    
    private createSaveNode(pos: Pos, branchId: Id) {
        const container = new PIXI.Container()

        const graphContainer = graphController.getDisplay(branchId, 'commit', this.renderer)

        fitWithinNodeInterval(branchId, graphContainer)
        const c0 = new PIXI.Container()
        c0.addChild(graphContainer)
        c0.pivot.set(SAVE_NODE_RADIUS)
        const circle = new PIXI.Graphics()
        circle.circle(0, 0, SAVE_NODE_RADIUS)
        circle.stroke({color: 0xFFFFFF})
        container.addChild(c0)
        container.addChild(circle)
        container.x = pos[0]; container.y = pos[1]
        this.commitGraphContainer.addChild(container)
    }

    private createArrow(startPos: Pos, endPos: Pos, alpha = 1 ) {
        const g = new PIXI.Graphics()
        const { closest1, closest2} = shortestEdge(startPos, endPos, COMMIT_NODE_RADIUS, COMMIT_NODE_RADIUS)
        edgeLineGraphic(g, closest1, closest2, ARROW_SIZE, ARROW_SIZE, "both" )
        g.fill({color: 0xFFFFFF, alpha})
        this.commitGraphContainer.addChild(g)
    }

    private createCurrentBranchIndicator() {

        const currentBranchId = this.selectCurrentBranchId() ??""
        const [branchStart, branchEnd] = this.branchSpan(currentBranchId)
        const topLeft = [branchStart[0] - COMMIT_NODE_RADIUS, branchStart[1] - COMMIT_NODE_RADIUS]
        const bottomRight = [branchEnd[0] + COMMIT_NODE_RADIUS, branchEnd[1] + COMMIT_NODE_RADIUS]

        const padding = 10
        this.currentBranchIndicator.clear()
        this.currentBranchIndicator.roundRect(
            topLeft[0] - padding, 
            topLeft[1] - padding, 
            bottomRight[0] - topLeft[0] + padding * 2, 
            bottomRight[1] - topLeft[1] + padding * 2, 
            5
        )
        this.currentBranchIndicator.stroke({color: 0xFFFFFF})
    }

    /* Selectors */

    private selectCurrentBranchId() {
        const state = store.getState()
        const project = selectCurrentProject(state.workspace)
        if (project) {
            const branchId = Object.keys(project.branches).find(id => 
                project.branches[id].name === state.workspace.currentBranchName
            )
            return branchId
        }
    }


    /* Helpers */
    private branchSpan(branchId: Id) {
       return getBranchSpan(this.branches, this.branchOrder, this.commits, branchId)
    }
}



/* Helpers */


function fitWithinNodeInterval(graphId: Id, container: PIXI.Container) {
     // Initial update
     updateScaleAndPositions(graphs[graphId], container, [SAVE_NODE_RADIUS * 2, SAVE_NODE_RADIUS * 2])
        
     // Set interval to update scale and positions every 100ms
     const intervalId = setInterval(() => {
         if (graphs[graphId] && container) {
             updateScaleAndPositions(graphs[graphId], container, [SAVE_NODE_RADIUS * 2, SAVE_NODE_RADIUS * 2])
         } else {
             clearInterval(intervalId)
         }
     }, 100)
}




const createBranchButton = (onNewBranch:  () => void ) => {

    const width = 35
    const height = 10

    const container = new PIXI.Container()

    const b1 = new PIXI.Graphics()
    b1.roundRect(0, 0, width, height, 2)
    b1.fill({ color: 0xFFFFFF, alpha: 1})

    const b2 = new PIXI.Graphics()
    b2.roundRect(0, 0, width, height, 2)
    b2.fill({ color: 0x00000, alpha: 0.5})

    const text = new PIXI.Text({
        text: '+ Branch',
        style: {
            fontFamily: 'Arial',
            fontSize: height*2,
            fill: 0xFFFFFF,
            align: 'center',
        }
    });
    text.eventMode = "none"
    text.scale.set(0.3)
    text.anchor.set(0.5)
    text.y = height / 2
    text.x = width / 2
    container.addChild(b1); container.addChild(b2); container.addChild(text)
    container.y = COMMIT_NODE_RADIUS * 0.80
    container.pivot.set(width/2, 0)
    b2.cursor = 'pointer'
    b2.on('pointerdown', onNewBranch)
    container.on('pointerover', () => b2.alpha = 0.5)
    container.on('pointerout', () => b2.alpha = 1)
    return container
}


export const getBranchSpan = (branches: Branches, branchOrder: Id[], commits: Commits, branchId: Id) => {
    let commitsFromEndTotal = 0
    let commitsFromEndOnBranch = 0
    const branch = branches[branchId]
    if (branch?.latestCommitId) {
        commitsFromEndTotal++
        commitsFromEndOnBranch++

        let commit = commits[branch.latestCommitId]
        let curr = commit?.prevCommitId
        while (curr) {
            if (commits[curr]?.branchName == branch.name) {
                commitsFromEndOnBranch++
            }

            commitsFromEndTotal++
            commit = commits[curr]
            curr = commit.prevCommitId
        }

        if (commits[branch.latestCommitId]?.branchName != branch.name) {
            commitsFromEndOnBranch = 0
        }
    } 
    
    const branchesFromOrigin = branchOrder.findIndex((id) => id == branchId) + 1
    const endPos = [commitsFromEndTotal * (COMMIT_SPACING), branchesFromOrigin * (BRANCH_SPACING)] as Pos
    const startPos = [endPos[0] - commitsFromEndOnBranch * COMMIT_SPACING, endPos[1]] as Pos
    return [startPos, endPos]
}