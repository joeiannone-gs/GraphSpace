import {
    NODE_COLOR_LIGHT,
    NODE_COLOR_DARK,
    ABS_COLOR_LIGHT,
    ABS_COLOR_DARK,
    SELECTED_COLOR_LIGHT,
    SELECTED_COLOR_DARK,
    HIGHLIGHT_COLOR_LIGHT,
    HIGHLIGHT_COLOR_DARK,
    MULTICONNECT_COLOR_LIGHT,
    MULTICONNECT_COLOR_DARK,
    SAVE_NODE_COLOR_LIGHT,
    SAVE_NODE_COLOR_DARK,
    COMMIT_NODE_COLOR_LIGHT,
    COMMIT_NODE_COLOR_DARK
} from "../coloring/nodes"

import {
    EDGE_COLOR_LIGHT,
    EDGE_COLOR_DARK,
    BACKPROP_EDGE_COLOR_LIGHT,
    BACKPROP_EDGE_COLOR_DARK,
    SELECTED_COLOR_LIGHT as EDGE_SELECTED_COLOR_LIGHT,
    SELECTED_COLOR_DARK as EDGE_SELECTED_COLOR_DARK,
    NODULE_COLOR_LIGHT,
    NODULE_COLOR_DARK
} from "../coloring/edges"

import { 
    BACKGROUND_COLOR_LIGHT,
    BACKGROUND_COLOR_DARK, 
    BACKGROUND_LINE_COLOR_LIGHT,
    BACKGROUND_LINE_COLOR_DARK 
} from "../coloring/background"

import {
    SITE_HEADER_TEXT_LIGHT,
    SITE_HEADER_TEXT_DARK,
    PANEL_MAIN_HEADING_LIGHT,
    PANEL_MAIN_HEADING_DARK,
    PANEL_SUB_HEADING_LIGHT,
    PANEL_SUB_HEADING_DARK,
    TEXT_INPUT_LIGHT,
    TEXT_INPUT_DARK,
    TEXT_AREA_LIGHT,
    TEXT_AREA_DARK
} from "../coloring/text"

import {
    PANEL_BACKGROUND_COLOR_LIGHT,
    PANEL_BACKGROUND_COLOR_DARK,
    TEXT_INPUT_BACKGROUND_LIGHT,
    TEXT_INPUT_BACKGROUND_DARK,
    TEXT_AREA_BACKGROUND_LIGHT,
    TEXT_AREA_BACKGROUND_DARK,
    SUB_HEADER_BACKGROUND_LIGHT,
    SUB_HEADER_BACKGROUND_DARK
} from "../coloring/panels"

import {
    GRAPH_THUMBNAIL_MAIN_COLOR_LIGHT,
    GRAPH_THUMBNAIL_MAIN_COLOR_DARK,
    GRAPH_THUMBNAIL_SELECTED_COLOR_LIGHT,
    GRAPH_THUMBNAIL_SELECTED_COLOR_DARK,
    GRAPH_THUMBNAIL_TEXT_COLOR_LIGHT,
    GRAPH_THUMBNAIL_TEXT_COLOR_DARK,
    ABS_THUMBNAIL_MAIN_COLOR_LIGHT,
    ABS_THUMBNAIL_MAIN_COLOR_DARK,
    ABS_THUMBNAIL_SELECTED_COLOR_LIGHT,
    ABS_THUMBNAIL_SELECTED_COLOR_DARK,
    ABS_THUMBNAIL_TEXT_COLOR_LIGHT,
    ABS_THUMBNAIL_TEXT_COLOR_DARK,
    ABS_THUMBNAIL_BACKGROUND_COLOR_LIGHT,
    ABS_THUMBNAIL_BACKGROUND_COLOR_DARK,
    DOTS_COLOR_LIGHT,
    DOTS_COLOR_DARK
} from "../coloring/thumbnails"

import {
    BUTTON_TEXT_LIGHT,
    BUTTON_TEXT_DARK,
    BUTTON_FILL_LIGHT,
    BUTTON_FILL_DARK
} from "../coloring/buttons"

export const getColoring = (darkMode: boolean) => {
    return {
        nodeColoring: {
            base: darkMode ? NODE_COLOR_DARK : NODE_COLOR_LIGHT,
            abs: darkMode ? ABS_COLOR_DARK : ABS_COLOR_LIGHT,
            selected: darkMode ? SELECTED_COLOR_DARK : SELECTED_COLOR_LIGHT,
            highlighted: darkMode ? HIGHLIGHT_COLOR_DARK : HIGHLIGHT_COLOR_LIGHT,
            multiConnect: darkMode ? MULTICONNECT_COLOR_DARK : MULTICONNECT_COLOR_LIGHT,
            save: darkMode ? SAVE_NODE_COLOR_DARK : SAVE_NODE_COLOR_LIGHT,
            commit: darkMode ? COMMIT_NODE_COLOR_DARK : COMMIT_NODE_COLOR_LIGHT
        },
        edgeColoring: {
            edge: darkMode ? EDGE_COLOR_DARK : EDGE_COLOR_LIGHT,
            selected: darkMode ? EDGE_SELECTED_COLOR_DARK : EDGE_SELECTED_COLOR_LIGHT,
            nodule: darkMode ? NODULE_COLOR_DARK : NODULE_COLOR_LIGHT,
            backprop: darkMode ? BACKPROP_EDGE_COLOR_DARK : BACKPROP_EDGE_COLOR_LIGHT
        },
        backgroundColoring: {
            fill: darkMode ? BACKGROUND_COLOR_DARK : BACKGROUND_COLOR_LIGHT,
            lines: darkMode ? BACKGROUND_LINE_COLOR_DARK : BACKGROUND_LINE_COLOR_LIGHT, 
        },
        textColoring: {
            siteHeader: darkMode ? SITE_HEADER_TEXT_DARK : SITE_HEADER_TEXT_LIGHT,
            panelMainHeading: darkMode ? PANEL_MAIN_HEADING_DARK : PANEL_MAIN_HEADING_LIGHT,
            panelSubHeading: darkMode ? PANEL_SUB_HEADING_DARK : PANEL_SUB_HEADING_LIGHT,
            textInput: darkMode ? TEXT_INPUT_DARK : TEXT_INPUT_LIGHT,
            textArea: darkMode ? TEXT_AREA_DARK : TEXT_AREA_LIGHT
        },
        panelColoring: {
            background: darkMode ? PANEL_BACKGROUND_COLOR_DARK : PANEL_BACKGROUND_COLOR_LIGHT,
            textInputBackground: darkMode ? TEXT_INPUT_BACKGROUND_DARK : TEXT_INPUT_BACKGROUND_LIGHT,
            textAreaBackground: darkMode ? TEXT_AREA_BACKGROUND_DARK : TEXT_AREA_BACKGROUND_LIGHT,
            subHeaderBackground: darkMode ? SUB_HEADER_BACKGROUND_DARK : SUB_HEADER_BACKGROUND_LIGHT
        },
        thumbnailColoring: {
            graph: {
                main: darkMode ? GRAPH_THUMBNAIL_MAIN_COLOR_DARK : GRAPH_THUMBNAIL_MAIN_COLOR_LIGHT,
                selected: darkMode ? GRAPH_THUMBNAIL_SELECTED_COLOR_DARK : GRAPH_THUMBNAIL_SELECTED_COLOR_LIGHT,
                text: darkMode ? GRAPH_THUMBNAIL_TEXT_COLOR_DARK : GRAPH_THUMBNAIL_TEXT_COLOR_LIGHT,
            },
            abs: {
                main: darkMode ? ABS_THUMBNAIL_MAIN_COLOR_DARK : ABS_THUMBNAIL_MAIN_COLOR_LIGHT,
                selected: darkMode ? ABS_THUMBNAIL_SELECTED_COLOR_DARK : ABS_THUMBNAIL_SELECTED_COLOR_LIGHT,
                text: darkMode ? ABS_THUMBNAIL_TEXT_COLOR_DARK : ABS_THUMBNAIL_TEXT_COLOR_LIGHT,
                background: darkMode ? ABS_THUMBNAIL_BACKGROUND_COLOR_DARK : ABS_THUMBNAIL_BACKGROUND_COLOR_LIGHT,
            },
            dots: darkMode ? DOTS_COLOR_DARK : DOTS_COLOR_LIGHT
        },
        buttonColoring: {
            text: darkMode ? BUTTON_TEXT_DARK : BUTTON_TEXT_LIGHT,
            fill: darkMode ? BUTTON_FILL_DARK : BUTTON_FILL_LIGHT
        },
    }
}

export const convertToString = (hex: number) => {
    return `#${hex.toString(16).padStart(6, '0')}`
}