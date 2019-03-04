/*
 * Copyright (c) 2016 - now David Sehnal, licensed under Apache 2.0, See LICENSE file for more info.
 */

import './ext/LiteMol/js/LiteMol-plugin';

import Views = LiteMol.Plugin.Views;
import Bootstrap = LiteMol.Bootstrap;
import Transformer = Bootstrap.Entity.Transformer;    
import LayoutRegion = Bootstrap.Components.LayoutRegion;
import { SharedStorage } from './SharedStorage';
import { LMState } from './State';

/**
 * Support for custom highlight tooltips.
 */
export function HighlightCustomElements(context: Bootstrap.Context) {        
    context.highlight.addProvider(info => {
        if(info.kind !== 1 || (info as any).elements === void 0 || (info as any).elements.length === 0){
            return void 0;
        }
        if((info as any).source.ref==="molecule-het"){
            if(!SharedStorage.has("CHARGES")){
                return void 0;
            }
            let charges = SharedStorage.get("CHARGES");
            let chg = charges[(info as any).elements[0]];

            if (isNaN(chg)){
                return `<b>Charge</b>: (not available)`;
            }

            return `<b>Charge</b>: ${Number().toFixed(4)}`;
        }
        if((info as any).source.ref==="polymer-visual"){
            if(!SharedStorage.has("RESIDUE-CHARGES")){
                return void 0;
            }
            let charges = SharedStorage.get("RESIDUE-CHARGES");
            let idxStart = (info as any).elements
                .reduce((p:number,c:number,ci:number,a:number[])=>{return Math.min(p, c);});
            let finalCharge = charges.get(idxStart);
            finalCharge = LMState.roundTo4Positions(finalCharge / (info as any).elements.length);
            
            if (isNaN(finalCharge)){
                return `<b>Charge</b>: (not available)`;
            }
            
            return `<b>Charge</b>: ${finalCharge}`;
        }

        return "";
    });        
}

export const LMPluginSpec: LiteMol.Plugin.Specification = {
    settings: {
    },
    transforms: [
        // Molecule(model) transforms
        { transformer: Transformer.Molecule.CreateModel, view: Views.Transform.Molecule.CreateModel, 
            initiallyCollapsed: true },
        { transformer: Transformer.Molecule.CreateSelection, view: Views.Transform.Molecule.CreateSelection, 
            initiallyCollapsed: true },        
                        
        { transformer: Transformer.Molecule.CreateAssembly, view: Views.Transform.Molecule.CreateAssembly, 
            initiallyCollapsed: true },
        { transformer: Transformer.Molecule.CreateSymmetryMates, 
            view: Views.Transform.Molecule.CreateSymmetryMates, initiallyCollapsed: true },
        
        { transformer: Transformer.Molecule.CreateMacromoleculeVisual, view: Views.Transform.Empty },
        { transformer: Transformer.Molecule.CreateVisual, view: Views.Transform.Molecule.CreateVisual }
    ],
    behaviours: [            
        Bootstrap.Behaviour.SetEntityToCurrentWhenAdded,
        Bootstrap.Behaviour.FocusCameraOnSelect,
        
        // this colors the visual when a selection is created on it.
        Bootstrap.Behaviour.ApplySelectionToVisual,
        
        // this colors the visual when it's selected by mouse or touch
        Bootstrap.Behaviour.ApplyInteractivitySelection,
        
        // this shows what atom/residue is the pointer currently over
        Bootstrap.Behaviour.Molecule.HighlightElementInfo,
        
        // distance to the last "clicked" element
        Bootstrap.Behaviour.Molecule.DistanceToLastClickedElement,

        Bootstrap.Behaviour.UnselectElementOnRepeatedClick,

        HighlightCustomElements
    ],            
    components: [
        LiteMol.Plugin.Components.Visualization.HighlightInfo(LayoutRegion.Main, true),               
        LiteMol.Plugin.Components.Entity
            .Current('LiteMol', LiteMol.Plugin.VERSION.number)(LayoutRegion.Right, true),
        LiteMol.Plugin.Components.Transform.View(LayoutRegion.Right),
        LiteMol.Plugin.Components.Context.Log(LayoutRegion.Bottom, true),
        LiteMol.Plugin.Components.Context.Overlay(LayoutRegion.Root),
        LiteMol.Plugin.Components.Context.Toast(LayoutRegion.Main, true),
        LiteMol.Plugin.Components.Context.BackgroundTasks(LayoutRegion.Main, true)
    ],
    viewport: { 
        view: Views.Visualization.Viewport,
        controlsView: Views.Visualization.ViewportControls
    },
    layoutView: Views.Layout, 
    tree: {
        region: LayoutRegion.Left,
        view: Views.Entity.Tree
    }
};