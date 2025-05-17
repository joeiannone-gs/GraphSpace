import * as PIXI from 'pixi.js';
import { NODE_RADIUS } from '@/app/sizing/nodes';
import { Tensor } from '@/app/types/common';
import { truncateArray } from '@/app/services/math';
import { getArrayGraphic } from './components/arrayGraphic';



const FILE_NAME_TEXT_SIZE = 36


const fileNameStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: FILE_NAME_TEXT_SIZE,
    fill: 'grey',
    wordWrap: true,
    breakWords: true,
    wordWrapWidth: NODE_RADIUS * 0.8
});

const smallStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fill: 'grey',
});

export async function importDisplay(uploadedFileName: string,  dropIcon: PIXI.Sprite, displayValue?: Tensor, clear?: () => void) {


    const container = new PIXI.Container();


    if (!uploadedFileName) {
        const innerContainer = new PIXI.Container();

        // const dropZone = getDropZoneGraphic( dropIconSprite);
        dropIcon.width = 40
        dropIcon.height = 40
        innerContainer.addChild(dropIcon);

        const dropText = new PIXI.Text()
        dropText.text = 'drop files here'
        dropText.style = smallStyle
        dropText.y = 15;
        dropText.scale.set(0.2);
        dropText.anchor.set(0.5, 0);
        innerContainer.addChild(dropText);

        container.addChild(innerContainer);
    } else {

        const textContainer = new PIXI.Container()

        const fileNameText = new PIXI.Text();
        fileNameText.text = uploadedFileName;
        fileNameText.style = fileNameStyle;
        fileNameText.anchor.set(0.5);
        textContainer.addChild(fileNameText);

        if (clear) {
            const clearText = new PIXI.Text();
            clearText.on('hover', () => clearText.alpha = 0.5)
            clearText.on('pointerout', () => clearText.alpha = 1)
            clearText.cursor = 'pointer'
            clearText.text = 'clear files';
            clearText.style = smallStyle;
            clearText.anchor.set(0.5);
            clearText.cursor = 'pointer';
            clearText.y = FILE_NAME_TEXT_SIZE + 5;
            clearText.on('pointerdown', () => clear())
            textContainer.addChild( clearText);
        }

        if (displayValue) {
            const allocatedSize = [NODE_RADIUS*2, NODE_RADIUS*2]
            const arrayContainer = new PIXI.Container()
            const truncated = truncateArray(displayValue, 6, 3)
            const array = await getArrayGraphic(truncated, allocatedSize[1], allocatedSize[0], [] )
            arrayContainer.addChild(array)
            arrayContainer.pivot.set(NODE_RADIUS, NODE_RADIUS)
            arrayContainer.scale.set(0.5)
            container.addChild(arrayContainer)
        }

        textContainer.y = NODE_RADIUS * 0.75

        container.addChild(textContainer)
    }
    

    return container;
}

