/*
 * Copyright (c) 2016 - now David Sehnal, licensed under Apache 2.0, See LICENSE file for more info.
 */

import './ext/LiteMol/js/LiteMol-plugin';

import Views = LiteMol.Plugin.Views;
import Bootstrap = LiteMol.Bootstrap;
import Transformer = Bootstrap.Entity.Transformer;    
import LayoutRegion = Bootstrap.Components.LayoutRegion;
import Context = LiteMol.Plugin.Context;
import Visualization = Bootstrap.Visualization;
import Command = Bootstrap.Command;
import Interactivity = Bootstrap.Interactivity;
import Utils = LiteMol.Bootstrap.Utils;
import Query = LiteMol.Core.Structure.Query;
import Transforms = LiteMol.Bootstrap.Entity.Transformer;
import Entity = LiteMol.Bootstrap.Entity;
import Tree = LiteMol.Bootstrap.Tree;
import { SharedStorage } from './SharedStorage';
import { EventQueue, Events } from "./EventQueue";
import { LMState } from './State';
import { Controller } from 'LiteMol-plugin';

/** An ugly hack that will be removed when the time comes */
export let SuppressShowInteractionOnSelect:boolean = false;

/**
 * Support for custom highlight tooltips.
 */
export function HighlightCustomElements(context: Bootstrap.Context) {        
    context.highlight.addProvider(info => {
        if(info.kind !== 1 || (info as any).elements === void 0 || (info as any).elements.length === 0){
            return void 0;
        }
        if((info as any).source.ref==="molecule-het" || (info as any).source.props.label === "Balls and Sticks"){
            if(!SharedStorage.has("CHARGES") || SharedStorage.get("CHARGES").length === 0){
                return `<b>Charges not available</b>`;
            }
            let charges = SharedStorage.get("CHARGES");
            let chg = charges[(info as any).elements[0]];

            if (isNaN(chg)){
                return `<b>Charge</b>: (not available)`;
            }

            return `<b>Charge</b>: ${Number(chg).toFixed(4)}`;
        }
        else if((info as any).source.ref==="polymer-visual"){
            if(!SharedStorage.has("RESIDUE-CHARGES") || SharedStorage.get("RESIDUE-CHARGES").length === 0){
                return `<b>Charges not available</b>`;
            }
            let charges = SharedStorage.get("RESIDUE-CHARGES");
            let idxStart = (info as any).elements
                .reduce((p:number,c:number,ci:number,a:number[])=>{return Math.min(p, c);});
            let finalCharge = charges.get(idxStart);
            finalCharge = LMState.roundTo4Positions(finalCharge);
            
            if (isNaN(finalCharge)){
                return `<b>Charge</b>: (not available)`;
            }
            
            return `<b>Charge</b>: ${finalCharge}`;
        }
        else if((info as any).source.ref==="molecule-surface"){
            if(!SharedStorage.has("SURFACE-CHARGES") || SharedStorage.get("SURFACE-CHARGES").length === 0){
                return `<b>Charges not available</b>`;
            }
            let charges = SharedStorage.get("SURFACE-CHARGES");
            let chg = charges.get((info as any).elements[0]);
            chg = LMState.roundTo4Positions(chg);
            
            if (isNaN(chg)){
                return `<b>Charge</b>: (not available)`;
            }
            
            return `<b>Charge</b>: ${chg}`;
        }

        return "";
    });        
}

export function ShowInteractionOnSelect(radius: number) {
    if(!EventQueue.isInitialised()){
        EventQueue.init();
        SharedStorage.init();
    }
    EventQueue.subscribe(Events.LM_USE_DEFAULT_THEMES, (params)=>{
        if(params.value === true){
            let plugin = SharedStorage.get("LM-PLUGIN");
            let colorByAtom = params.value;
            if(SharedStorage.get(LMState.VIZUALIZATION_MODE) === LMState.MODE_BAS){
                return;
            }
            if(colorByAtom!==void 0 && colorByAtom !== null && colorByAtom){
                let ballsAndSticksByElementSymbol = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                    .filter((v,i,a)=>{
                    return v.name === "Element Symbol";
                })[0];

                let hasSelection = (plugin.context.select('residue-atoms-amb').length>0);

                let ballsAndSticksDefault = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get("BallsAndSticks");
                if(ballsAndSticksDefault !== void 0 && hasSelection){
                    let c = LiteMol.Core.Utils.FastMap.create<string, LiteMol.Visualization.Color>();
                    ballsAndSticksByElementSymbol.colors!.forEach((cc, n) => {
                        c.set(n!, cc!);
                    });                 

                    LMState.applyTheme(ballsAndSticksByElementSymbol.provider(plugin.context.select("residue-atoms-amb")[0], 
                    {
                        colors: c,
                        disableFog: ballsAndSticksDefault.theme.disableFog,
                        interactive: ballsAndSticksDefault.theme.interactive,
                        isSticky: true,
                        transparency: ballsAndSticksDefault.theme.transparency,
                        variables: ballsAndSticksDefault.theme.variables,

                    }), plugin, "residue-atoms-amb");
                }
                let hasLigSelection = (plugin.context.select('ligand-atoms').length>0);

                if(ballsAndSticksDefault !== void 0 && hasLigSelection){
                    let c = LiteMol.Core.Utils.FastMap.create<string, LiteMol.Visualization.Color>();
                    ballsAndSticksByElementSymbol.colors!.forEach((cc, n) => {
                        c.set(n!, cc!);
                    });                 

                    LMState.applyTheme(ballsAndSticksByElementSymbol.provider(plugin.context.select("ligand-atoms")[0], 
                    {
                        colors: c,
                        disableFog: ballsAndSticksDefault.theme.disableFog,
                        interactive: ballsAndSticksDefault.theme.interactive,
                        isSticky: true,
                        transparency: ballsAndSticksDefault.theme.transparency,
                        variables: ballsAndSticksDefault.theme.variables,

                    }), plugin, "ligand-atoms");
                }
                
            }
        }   
        else{
            let plugin = SharedStorage.get("LM-PLUGIN");
            let charges = SharedStorage.get("CHARGES");
            let colorByAtom = params.value;
            if(SharedStorage.get(LMState.VIZUALIZATION_MODE) === LMState.MODE_BAS){
                return;
            }
            if(colorByAtom!==void 0 && colorByAtom !== null && colorByAtom){
                return;
            }
            if(charges === void 0 || charges === null || charges.length === 0){
                //console.warn("No charges have been loaded! Skipping theme generation...");
                return;
            }
            if(plugin === void 0 || plugin === null){
                return;
            }
            let hasSelection = (plugin.context.select('residue-atoms-amb').length>0);
            let hasLigSelection = (plugin.context.select('ligand-atoms').length>0);
            if(hasSelection){
                let themeRAamb = LMState.generateColorThemeBySelector(plugin, charges, "residue-atoms-amb");
                LMState.applyTheme(themeRAamb, plugin, "residue-atoms-amb");
            }
            if(hasLigSelection){
                let themeLig = LMState.generateColorThemeBySelector(plugin, charges, "ligand-atoms");
                LMState.applyTheme(themeLig, plugin, "ligand-atoms");
            }
        } 
    });    
    return (context: Context) => {
        let lastRef: string | undefined = void 0;
        let ambRef: string | undefined = void 0;
        
        let ligandStyle: Visualization.Molecule.Style<Visualization.Molecule.BallsAndSticksParams> = {
            type: 'BallsAndSticks',
            taskType: 'Silent',
            params: { useVDW: false, vdwScaling: 0.25, bondRadius: 0.13, detail: 'Automatic' },
            theme: { template: Visualization.Molecule.Default.ElementSymbolThemeTemplate, colors: Visualization.Molecule.Default.ElementSymbolThemeTemplate.colors!.set('Bond', LiteMol.Visualization.Theme.Default.SelectionColor), transparency: { alpha: 0.4 } },
            isNotSelectable: true
        } 
            
        let ambStyle: Visualization.Molecule.Style<Visualization.Molecule.BallsAndSticksParams> = {
            type: 'BallsAndSticks',
            taskType: 'Silent',
            params: { useVDW: false, atomRadius: 0.15, bondRadius: 0.07, detail: 'Automatic' },
            theme: { template: Visualization.Molecule.Default.UniformThemeTemplate, colors: Visualization.Molecule.Default.UniformThemeTemplate.colors!.set('Uniform', { r: 0.4, g: 0.4, b: 0.4 }), transparency: { alpha: 0.75 } },
            isNotSelectable: true
        }

        function clean() {
            if (lastRef) {
                Command.Tree.RemoveNode.dispatch(context, lastRef);
                lastRef = void 0;
                ambRef = void 0;
            }    
        }

        context.behaviours.click.subscribe(info => {
            if(SharedStorage.get(LMState.VIZUALIZATION_MODE) === LMState.MODE_BAS){
                return;
            }

            if (SuppressShowInteractionOnSelect || Interactivity.isEmpty(info)) {
                clean(); 
                return;
            }

            if (info.source.ref === ambRef) {
                let model = Utils.Molecule.findModel(info.source);
                if (!model) return;

                let query = Query.atomsFromIndices(info.elements);
                let data = { entity: model, query };
                setTimeout(()=>{Command.Molecule.CreateSelectInteraction.dispatch(context, data);}, 0);
                return;
            }

            let isSelectable = Entity.isVisual(info.source) ? info.source.props.isSelectable : true;
            if (!isSelectable) return;

            clean();

            if (Interactivity.isEmpty(info) || !Utils.Molecule.findModelOrSelection(info.source)) return;
            
            let ligandQ = Query.atomsFromIndices(info.elements).wholeResidues();
            let ambQ = Query.atomsFromIndices(info.elements).wholeResidues().ambientResidues(radius);
            
            let ref = "residue-atoms"; // Utils.generateUUID();
            let action = Tree.Transform.build().add(info.source, Transforms.Basic.CreateGroup, { label: 'Interaction' }, { ref, isHidden: true });
            lastRef = ref;

            ambRef = "residue-atoms-amb"; // Utils.generateUUID();
            let ligRef = "ligand-atoms";
            
            action.then(Transforms.Molecule.CreateSelectionFromQuery, { query: ambQ, name: 'Ambience', silent: true, inFullContext: true }, { isBinding: true })
                .then(Transforms.Molecule.CreateVisual, { style: ambStyle }, { ref: ambRef });
            action.then(Transforms.Molecule.CreateSelectionFromQuery, { query: ligandQ, name: 'Ligand', silent: true, inFullContext: true }, { isBinding: true })
                .then(Transforms.Molecule.CreateVisual, { style: ligandStyle }, { ref: ligRef});
                
            Tree.Transform.apply(context, action).run().then(()=>{
                let plugin = SharedStorage.get("LM-PLUGIN");
                let charges = SharedStorage.get("CHARGES");
                let colorByAtom = SharedStorage.get("LM_USE_DEFAULT_THEMES");
                if(colorByAtom!==void 0 && colorByAtom !== null && colorByAtom){
                    return;
                }
                if(charges === void 0 || charges === null || charges.length === 0){
                    //console.warn("No charges have been loaded! Skipping theme generation...");
                    return;
                }
                if(plugin === void 0 || plugin === null){
                    return;
                }
                let themeRAamb = LMState.generateColorThemeBySelector(plugin, charges, "residue-atoms-amb");
                LMState.applyTheme(themeRAamb, plugin, "residue-atoms-amb");
                let themeLig = LMState.generateColorThemeBySelector(plugin, charges, ligRef);
                LMState.applyTheme(themeLig, plugin, ligRef);
            });                
        });               
    }
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
        ShowInteractionOnSelect(5),         
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