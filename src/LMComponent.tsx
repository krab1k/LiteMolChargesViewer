import * as React from 'react';

import './ext/LiteMol/js/LiteMol-plugin';

import Plugin = LiteMol.Plugin;
import Bootstrap = LiteMol.Bootstrap;

import { LMPluginSpec } from './PluginSpec';
import { LMState, SupportedFormat, SupportedChargesFormat } from './State';

import { EventQueue, Events } from "./EventQueue";

import './ext/LiteMol/css/LiteMol-plugin.min.css';
import './styles/lmcomponent.css';

import './ext/LiteMol/fonts/fontello.ttf';
import './ext/LiteMol/fonts/fontello.woff';
import './ext/LiteMol/fonts/fontello.woff2';
import './ext/LiteMol/fonts/fontello.eot';
import './ext/LiteMol/fonts/fontello.svg';
import { SharedStorage } from './SharedStorage';

let DEBUG=false;

interface Props{
    conformationId: number | null;
}

interface LoadDataArgs{
    structure_url:string;
    structure_format: SupportedFormat;
    charges_url:string;
    charges_format: SupportedChargesFormat;
}

export class LiteMolContainer extends React.Component<Props,any>{
    private currentElement: HTMLDivElement|null;
    private setCurrentElementRef: (a:HTMLDivElement)=>void;
    private plugin: LiteMol.Plugin.Controller | null = null;

    private loadData(params: LoadDataArgs){
        let plugin = this.plugin;
        if(plugin === null){
            return;
        }
        LMState.loadData(plugin, params.structure_url, params.charges_url, 
            params.structure_format, params.charges_format).then(val=>{
                EventQueue.send(Events.LM_MOLECULE_LOADED);
        }).catch(e=>{
            console.error(e);
        });
    }

    private stopLiteMol(){
        if(this.plugin === null){
            return;
        }
        SharedStorage.set("LM-PLUGIN", null);
        this.plugin.clear();
        this.plugin.destroy();
        this.plugin = null;
        EventQueue.send(Events.LM_STOP);
    }
    
    private startLiteMol(containerElement: HTMLDivElement, conformationId: number|null){
        if(this.plugin !== null){
            this.stopLiteMol();
        }
        this.currentElement = containerElement;
        this.plugin = Plugin.create({
            target: this.currentElement,
            viewportBackground: '#000',
            layoutState: {
                hideControls: true,
                isExpanded: false,
                collapsedControlsLayout: Bootstrap.Components.CollapsedControlsLayout.Landscape
            },
            customSpecification: LMPluginSpec,
        });

        EventQueue.send(Events.LM_START, {
            plugin: this.plugin
        });

        SharedStorage.set("LM-PLUGIN", this.plugin);

        if(!DEBUG){
            let itm = document.getElementsByClassName("lm-icon-tools").item(0);
            if(itm !== null && itm.parentElement !== null){
                itm.parentElement.style.setProperty("display", "none");
            }
        }

        this.plugin.subscribe(LiteMol.Bootstrap.Command.Visual.ResetScene, (e)=>{
            switch(SharedStorage.get(LMState.VIZUALIZATION_MODE)){
                case LMState.MODE_BAS: LMState.switchToBaS(this.plugin); break;
                case LMState.MODE_SURFACE: LMState.switchToSurface(this.plugin); break;
                case LMState.MODE_CARTOONS: LMState.switchToCartoons(this.plugin); break;
            }
        });
        this.plugin.subscribe(LiteMol.Bootstrap.Event.Molecule.ModelSelect, (e)=>{
            let basVisible = LMState.isVisible(this.plugin,"molecule-bas");
            let surfaceVisible = LMState.isVisible(this.plugin,"molecule-surface");
            let cartoonsVisible = LMState.isVisible(this.plugin,"polymer-visual");

            if((basVisible && surfaceVisible)||(basVisible&&cartoonsVisible)||(cartoonsVisible&&surfaceVisible)){
                switch(SharedStorage.get(LMState.VIZUALIZATION_MODE)){
                    case LMState.MODE_BAS: LMState.switchToBaS(this.plugin); break;
                    case LMState.MODE_SURFACE: LMState.switchToSurface(this.plugin); break;
                    case LMState.MODE_CARTOONS: LMState.switchToCartoons(this.plugin); break;
                }
            }
        });
    }

    constructor(props:Props){
        super(props);
        this.currentElement = null;
        this.plugin = null;
        this.setCurrentElementRef = element => {
            if(element === void 0 || element === null){
                this.currentElement = null;
                return;
            }
            else{
                this.startLiteMol(element, props.conformationId);  
            }
        };
    }

    componentWillReceiveProps(nextProps:Props){
        if(this.props.conformationId === nextProps.conformationId){
            return;
        }
        this.stopLiteMol();
        if(this.currentElement !== null){
            this.startLiteMol(this.currentElement, nextProps.conformationId);
        }
    }

    componentWillUnmount(){
        // LiteMol plugin will be deattached by setCurrentElementRef
        EventQueue.unsubscribe(Events.LM_LOAD_MOLECULE, this.loadData.bind(this));
    }

    componentDidMount(){
        EventQueue.subscribe(Events.LM_LOAD_MOLECULE, this.loadData.bind(this));
    }
    
    render(){
        return (
            <div className="litemol" ref={this.setCurrentElementRef} />
        );
    }
}