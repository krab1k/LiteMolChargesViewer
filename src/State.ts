import { SharedStorage } from "./SharedStorage";
import { EventQueue, Events } from "./EventQueue";

import './ext/LiteMol/js/LiteMol-plugin';

export namespace LMState {

    import Transformer = LiteMol.Bootstrap.Entity.Transformer;

    export interface SurfaceTag { type: string; element?: any; }

    let DEFAULT_THEME_COLOR_SETTINGS: ColorPaletteFunctionSettings = {
        minColor: LiteMol.Visualization.Color.fromRgb(255,0,0),
        maxColor: LiteMol.Visualization.Color.fromRgb(0,0,255),
        minVal: null,
        maxVal: null,
        centerAbsolute: true,
        centerPosition: 0,
        maxColorMiddle: LiteMol.Visualization.Color.fromRgb(255,255,255),
        minColorMiddle: LiteMol.Visualization.Color.fromRgb(255,255,255),
        skipMiddle: false
    };

    export let VIZUALIZATION_MODE = "visualization-mode";
    export let MODE_SURFACE = "surface";
    export let MODE_CARTOONS = "cartoons";
    export let MODE_BAS = "balls-and-sticks";

    let lm_get_visualization_mode_hndlr = (hndlr)=>{
        hndlr(SharedStorage.get(VIZUALIZATION_MODE));
    };

    export function roundTo4Positions(nmbr:number){
        return (Math.ceil(Number(nmbr) * 10000) / 10000);
    }

    export function applyTheme(theme:LiteMol.Visualization.Theme, plugin:LiteMol.Plugin.Controller, ref: string){
        LiteMol.Bootstrap.Command.Visual.UpdateBasicTheme.dispatch(plugin.context, { 
            visual: plugin.context.select(ref)[0] as any, theme
        });
    }

    interface UserRGBColor {
        r: number;
        g: number;
        b: number;
    }

    function userRGBtoLMRGB(uRGB:UserRGBColor) {
        return LiteMol.Visualization.Color.fromRgb(uRGB.r, uRGB.g, uRGB.b);
    }

    function createTheme(colors:Map<number, LiteMol.Visualization.Color>){
        let fallbackcolor:UserRGBColor = {
            r: 0,
            g: 255,
            b: 0
        };
        let userColorSettings = SharedStorage.get("THEME_COLOR_SETTINGS");
        if(userColorSettings !== void 0 && userColorSettings.fallbackColor !== void 0){
            fallbackcolor = userColorSettings.fallbackColor;
        }

        let theme = LiteMol.Visualization.Theme.createMapping(LiteMol.Visualization.Theme.createColorMapMapping(
            (idx:number)=>{
                if(!colors.has(idx)){
                    return void 0;
                }
                return idx;
            },
            colors,
            userRGBtoLMRGB(fallbackcolor)
        ));
        theme.isSticky = true;
        return theme; 
    }

    function getLMMoleculeProps(plugin: LiteMol.Plugin.Controller):null|any{
        let data = null;
        plugin.context.tree.refs.forEach((v,k,ctx)=>{
            if("molecule" in v[0].props){
                data = (v[0].props as any).molecule.models[0].data;
            }
        });

        return data;
    }

    function generateColorThemeCartoons(plugin: LiteMol.Plugin.Controller, charges: number[]){
        let colors = new Map<number, LiteMol.Visualization.Color>();       

        let minVal = 0;
        let maxVal = 0;
        let residueCharges = new Map<number, number>();
        let residueChargesIdxMapping = new Map<number, number>();
        
        let data = getLMMoleculeProps(plugin);
        if(data === null){
            throw new Error("LiteMol element tree is not initialized yet!");
        }
        let residueData = data.residues;
        for(let i = 0;i<residueData.count;i++){
            let atomStartIdx = residueData.atomStartIndex[i];
            let atomEndIdx = residueData.atomEndIndex[i];
            let finalCharge = 0;
            
            for(let aIdx=atomStartIdx; aIdx<atomEndIdx; aIdx++){
                finalCharge += charges[aIdx];
            }

            if(isNaN(finalCharge)){
                continue;
            }

            minVal = Math.min(minVal, finalCharge);
            maxVal = Math.max(maxVal, finalCharge);

            residueCharges.set(atomStartIdx, finalCharge);
            for(let aIdx=atomStartIdx; aIdx<atomEndIdx; aIdx++){
                residueChargesIdxMapping.set(aIdx, finalCharge);
            }
        }

        SharedStorage.set("RESIDUE-CHARGES", residueCharges);

        let themeColorSettings = getAndAdaptColorSettings(minVal, maxVal);

        residueChargesIdxMapping.forEach((v,k,m)=>{
            let chg = v;
            if(isNaN(chg)){
                return;
            }
            let color = getColor(chg, themeColorSettings);
            colors.set(k, color);
        });
       
        return createTheme(colors);        
    } 

    function getAndAdaptColorSettings(minVal:number, maxVal:number){
        let themeColorSettings:ColorPaletteFunctionSettingsFromUser = SharedStorage.get("THEME_COLOR_SETTINGS");
        if(themeColorSettings === void 0){
            themeColorSettings = DEFAULT_THEME_COLOR_SETTINGS;
        }

        let cloned:ColorPaletteFunctionSettings = {
            centerAbsolute: DEFAULT_THEME_COLOR_SETTINGS.centerAbsolute,
            centerPosition: DEFAULT_THEME_COLOR_SETTINGS.centerPosition,
            maxColor: (themeColorSettings.maxColor === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.maxColor
                : userRGBtoLMRGB(themeColorSettings.maxColor),
            minColor: (themeColorSettings.minColor === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.minColor
                : userRGBtoLMRGB(themeColorSettings.minColor),
            minVal: (themeColorSettings.minVal === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.minVal
                : themeColorSettings.minVal,
            maxVal: (themeColorSettings.maxVal === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.maxVal
                : themeColorSettings.maxVal,
            minColorMiddle: (themeColorSettings.middleColor === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.minColorMiddle
                : userRGBtoLMRGB(themeColorSettings.middleColor),
            maxColorMiddle: (themeColorSettings.middleColor === void 0)
                ? DEFAULT_THEME_COLOR_SETTINGS.maxColorMiddle
                : userRGBtoLMRGB(themeColorSettings.middleColor),
            skipMiddle: DEFAULT_THEME_COLOR_SETTINGS.skipMiddle
        };

        let bound = Math.max(maxVal, Math.abs(minVal));
        if(themeColorSettings.minVal===null){
            cloned.minVal = -bound;
        }
        if(themeColorSettings.maxVal===null){
            cloned.maxVal = bound;
        }

        return cloned;
    }

    export function generateColorTheme(plugin: LiteMol.Plugin.Controller, charges: number[], visualRef: string){
        let colors = new Map<number, LiteMol.Visualization.Color>();       
        let minVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.min(cv, pv);
        });
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.max(cv, pv);
        });

        let props = (plugin.selectEntities(visualRef)[0].props as any);
        let indices = props.model.entity.props.indices;
        if (indices === void 0){
            indices = props.model.entity.props.model.positions.indices;
        }
        let themeColorSettings = getAndAdaptColorSettings(minVal, maxVal);
        for(let i=0;i<indices.length;i++){
            let chg = charges[indices[i]];
            if(isNaN(chg)){
                continue;
            }
            let color = getColor(chg, themeColorSettings);
            colors.set(indices[i], color);
        }

        return createTheme(colors);          
    } 

    export function generateColorThemeBySelector(plugin: LiteMol.Plugin.Controller, charges: number[], selector: string){
        let colors = new Map<number, LiteMol.Visualization.Color>();       
        let minVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.min(cv, pv);
        });
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.max(cv, pv);
        });

        let results = plugin.selectEntities(selector);
        if(results===void 0 || results.length === 0){
            return;
        }
        let props = (results[0].props as any);
        let indices = props.model.entity.props.indices;

        let themeColorSettings = getAndAdaptColorSettings(minVal, maxVal);
        for(let i=0;i<indices.length;i++){
            if(Number(indices[i])>=charges.length){
                continue;
            }
            let chg = charges[indices[i]];
            if(isNaN(chg)){
                continue;
            }
            let color = getColor(chg, themeColorSettings);
            colors.set(indices[i], color);
        }

        return createTheme(colors);          
    } 

    interface ColorPaletteFunctionSettingsFromUser{
        minVal?:number|null;
        maxVal?:number|null;
        minColor?: UserRGBColor;
        maxColor?: UserRGBColor;
        middleColor?: UserRGBColor;
        fallbackColor?: UserRGBColor;
    }

    interface ColorPaletteFunctionSettings{
        minVal:number|null;
        maxVal:number|null;
        minColor: LiteMol.Visualization.Color;
        maxColor: LiteMol.Visualization.Color;
        minColorMiddle: LiteMol.Visualization.Color;
        maxColorMiddle: LiteMol.Visualization.Color;
        skipMiddle: boolean;
        centerPosition:number;
        centerAbsolute:boolean;
    }

    function getColorForSurface(value: number, settings: ColorPaletteFunctionSettings) {
        let color = {
            r: settings.minColorMiddle.r,
            g: settings.minColorMiddle.g,
            b: settings.minColorMiddle.b,
        };

        if (isNaN(value)) {
            color = userRGBtoLMRGB({ 
                r: 0,
                g: 255,
                b: 0})
            return color;
        }

        if (value <= settings.minVal) {
            color.r = settings.minColor.r;
            color.g = settings.minColor.g;
            color.b = settings.minColor.b;
            return color;
        }
        if (value >= settings.maxVal) {
            color.r = settings.maxColor.r;
            color.g = settings.maxColor.g;
            color.b = settings.maxColor.b;
            return color;
        }
        var t, target, mid = settings.minColorMiddle;
        if (value <= 0) {
            t = value / settings.minVal;
            target = settings.minColor;
        }
        else {
            t = value / settings.maxVal;
            target = settings.maxColor;
        }

        color.r = mid.r + (target.r - mid.r) * t;
        color.g = mid.g + (target.g - mid.g) * t;
        color.b = mid.b + (target.b - mid.b) * t;

        return color;
    }

    function getColor(value: number, settings: ColorPaletteFunctionSettings){
        let minVal = (settings.minVal===null)?-1:settings.minVal;
        let maxVal = (settings.maxVal===null)?1:settings.maxVal;
        let minColor = settings.minColor;
        let maxColor = settings.maxColor;
        let minColorMiddle = settings.minColorMiddle;
        let maxColorMiddle = settings.maxColorMiddle;
        let skipMiddle = settings.skipMiddle;
        let middle = (settings.centerAbsolute)?settings.centerPosition:(minVal+maxVal)/2;

        const rgb = LiteMol.Visualization.Color.fromRgb(255, 255, 255);

        if(minVal === maxVal && minVal === 0){
            return rgb;
        }

        if(value<(minVal+maxVal)/2){
            let d = (middle - minVal);
            let t = (value - minVal) / ((d!==0)?d:1);
            LiteMol.Visualization.Color.interpolate(minColor, maxColorMiddle, t, rgb);
        }
        else{
            let d = (maxVal - middle);
            let t = (value - middle) / ((d!==0)?d:1);
            LiteMol.Visualization.Color.interpolate(minColorMiddle, maxColor, t, rgb);
        }

        if(skipMiddle&&settings.centerAbsolute){
            throw new Error("Cannot config absolute center and skip center at once! Forbidden configuration -> "
                + "skipMiddle=true && centerAbsolute=true");
        }
        if(skipMiddle&&!settings.centerAbsolute){
            let d = (maxVal - minVal);
            let t = (value - minVal) / ((d!==0)?d:1);
            LiteMol.Visualization.Color.interpolate(minColor, maxColor, t, rgb);
        }

        if(minVal === maxVal){
            let t = 0.5;
            LiteMol.Visualization.Color.interpolate(minColor, maxColorMiddle, t, rgb);
        }

        return rgb;
    }

    function getFormat(format:SupportedFormat){
        switch(format){
            case "SDF": return LiteMol.Core.Formats.Molecule.SupportedFormats.SDF;
            case "mmCIF": return LiteMol.Core.Formats.Molecule.SupportedFormats.mmCIF;
            case "mmBCIF": return LiteMol.Core.Formats.Molecule.SupportedFormats.mmBCIF;
            case "PDB": return LiteMol.Core.Formats.Molecule.SupportedFormats.PDB;
            default: throw new Error(`Format ${format} is not supported!`);
        }
    }

    function loadCharges(url:string){
        return new Promise<string>((res,rej)=>{
            fetch(url).then(v=>{
                v.text()
                    .then(val=>{
                        res(val);
                    })
                    .catch(err=>{
                        rej(err);
                    });
            })
            .catch(e=>{
                rej(e);
            });
        });
    }

    function parseCharges(contents:string, format:SupportedChargesFormat){
        switch(format){
            case "CHG": return parseCHG(contents);
            case "MOL2": return parseMOL2(contents);
            case "TXT": return parseTXT(contents);
            default: throw new Error(`Format ${format} is not supported!`);
        }
    }
    
    function parseCHG(contents:string){
        let lines = contents.split("\n").filter((v,i,a)=>{
            return v.length>0;
        });
        let chgLines = lines.splice(2);
        let charges = [];
        for(let l of chgLines){
            let parts = l.replace(/\s+/g," ").replace(/^\s/g,"").split(" ");
            charges.push(Number(parts[2]));
        }
        return charges;
    }

    function parseMOL2(contents:string){
        if(contents.indexOf("@<TRIPOS>ATOM") < 0
            || contents.indexOf("@<TRIPOS>") < 0 ){
            return [];
        }
        contents = contents.split("@<TRIPOS>ATOM")[1];
        contents = contents.split("@<TRIPOS>")[0];

        let lines = contents.split("\n").filter((v,i,a)=>{
            return v.length>0;
        });

        let charges = [];
        for(let l of lines){
            let parts = l.replace(/\s+/g," ").replace(/^\s/g,"").split(" ");
            if(parts.length<=1){
                continue;
            }
            charges.push(Number(parts[8]));
        }

        return charges;
    }

    function parseTXT(contents:string) {
        let lines = contents.split("\n");
        let chgLine = lines[1];
        let charges = [];
        for(let l of chgLine.split(/\s+/)) {
            charges.push(Number(l));
        }
        return charges;
    }

    function checkChargesCount(charges: number[], plugin: LiteMol.Plugin.Controller){
        let data = getLMMoleculeProps(plugin);
        if(data === null){
            return;
        }

        if(data.atoms.count !== charges.length){
            EventQueue.send(Events.LM_INCOMPLETE_CHARGES_ERROR, {
                atomCount: data.atoms.count,
                chargesCount: charges.length
            });
        }
    }

    function createModel(plugin: LiteMol.Plugin.Controller, structureUrl: string, structureFormat: SupportedFormat){
        let model = plugin.createTransform()
                .add(plugin.root, Transformer.Data.Download, 
                    { 
                        url: structureUrl, 
                        type: 'String', id: "structure_element" 
                    })
                .then(Transformer.Molecule.CreateFromData, 
                    { 
                        format: getFormat(structureFormat),

                    }, 
                    { 
                        isBinding: true 
                    })
                .then(Transformer.Molecule.CreateModel, { modelIndex: 0 }, {ref: "structure_model"});
            return plugin.applyTransform(model);
    }

    function getModelNode(plugin: LiteMol.Plugin.Controller, node?:LiteMol.Bootstrap.Entity.Any): LiteMol.Bootstrap.Entity.Any|null{
        if(node === void 0){
            node = plugin.root;
        }

        if(node.ref === "structure_model"){
            return node;
        }

        for(let n of node.children){
            let rv = getModelNode(plugin,n);
            if( rv!== null){
                return rv;
            }
        }

        return null;
    }

    export function loadData(plugin: LiteMol.Plugin.Controller, structureUrl: string, 
            chargesUrl: string, structureFormat: SupportedFormat, chargesFormat: SupportedChargesFormat) {
        EventQueue.unsubscribe(Events.LM_GET_VISUALIZATION_MODE, lm_get_visualization_mode_hndlr);

        SharedStorage.set("CHARGES", []);
        SharedStorage.set("RESIDUE-CHARGES", []);
        SharedStorage.set("SURFACE-CHARGES", []);

        plugin.clear();
        
        let modelLoadPromise = new Promise<any>((res,rej)=>{
            let defaultBaSThemeTempl = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get("BallsAndSticks");
            let defaultBaSTheme:LiteMol.Bootstrap.Visualization.Style<"Cartoons" | "Calpha" | "BallsAndSticks" | "VDWBalls" | "Surface", any> ={
                isNotSelectable: defaultBaSThemeTempl.isNotSelectable,
                taskType: defaultBaSThemeTempl.taskType,
                type: defaultBaSThemeTempl.type,
                params: defaultBaSThemeTempl.params,
                theme: {
                    colors: defaultBaSThemeTempl.theme.colors,
                    disableFog: defaultBaSThemeTempl.theme.disableFog,
                    interactive: defaultBaSThemeTempl.theme.interactive,
                    template: defaultBaSThemeTempl.theme.template,
                    transparency: {
                        writeDepth: defaultBaSThemeTempl.theme.transparency.writeDepth,
                        alpha: 0
                    }
                }
            };
            let defaultSurfaceThemeTempl = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get("Surface");
            let defaultSurfaceTheme:LiteMol.Bootstrap.Visualization.Style<"Cartoons" | "Calpha" | "BallsAndSticks" | "VDWBalls" | "Surface", any> ={
                isNotSelectable: defaultSurfaceThemeTempl.isNotSelectable,
                taskType: defaultSurfaceThemeTempl.taskType,
                type: defaultSurfaceThemeTempl.type,
                params: defaultSurfaceThemeTempl.params,
                theme: {
                    colors: defaultSurfaceThemeTempl.theme.colors,
                    disableFog: defaultSurfaceThemeTempl.theme.disableFog,
                    interactive: defaultSurfaceThemeTempl.theme.interactive,
                    template: defaultSurfaceThemeTempl.theme.template,
                    transparency: {
                        writeDepth: defaultSurfaceThemeTempl.theme.transparency.writeDepth,
                        alpha: 0
                    }
                }
            };

            createModel(plugin, structureUrl, structureFormat).then(()=>{
                let node = getModelNode(plugin);
                if(node === null){
                    return;
                }
                let basTransform = plugin.createTransform()
                    .add(node, Transformer.Molecule.CreateVisual, 
                    { 
                        style: {
                            isNotSelectable: false,
                            type: "BallsAndSticks",
                            taskType: "Background",
                            params: LiteMol.Bootstrap.Visualization.Molecule.Default.BallsAndSticksParams,
                            theme: defaultBaSTheme.theme,
                        }
                    },{
                        ref: "molecule-bas",
                        isBinding: false,
                        isHidden: false,
                    });
                let defaultSfcP = LiteMol.Bootstrap.Visualization.Molecule.Default.SurfaceParams;

                let surfaceParams = {
                    automaticDensity: false,
                    density: 1.77,
                    isWireframe: defaultSfcP.isWireframe,
                    probeRadius: 0.5,//defaultSfcP.probeRadius,
                    smoothing: defaultSfcP.smoothing
                };
                let surfaceTransform = plugin.createTransform()
                    .add(node, Transformer.Molecule.CreateVisual, 
                    { 
                        style: {
                            isNotSelectable: false,
                            type: "Surface",
                            taskType: "Background",
                            params: surfaceParams,
                            theme: defaultSurfaceTheme.theme,
                        }
                    },{
                        ref: "molecule-surface",
                        isBinding: false,
                        isHidden: false,
                    });
                        
                let polymerTransform = plugin.createTransform()
                    .add(node, Transformer.Molecule.CreateMacromoleculeVisual, 
                    { 
                        polymer: true, polymerRef: 'polymer-visual', het: true,
                        hetRef: 'molecule-het', water: true, waterRef: 'molecule-het'
                    });
                
                let promises = [];

                promises.push(plugin.applyTransform(basTransform));
                promises.push(plugin.applyTransform(surfaceTransform));
                promises.push(plugin.applyTransform(polymerTransform));

                Promise.all(promises).then(()=>{
                    if(plugin.instance === void 0){
                        rej("Loading data interupted due to redraw.");
                        return;
                    }
                    let hasHet = (plugin.context.select('molecule-het').length>0);
                    let hasPolymer = (plugin.context.select('polymer-visual').length>0);
                    let hasBaS = (plugin.context.select('molecule-bas').length>0);
                    let hasSurface = (plugin.context.select('molecule-surface').length>0);
                    if((!hasHet) && !hasPolymer && !hasBaS && !hasSurface){
                        rej("Application was unable to retrieve protein structure file.");
                    }
                    else{      
                        loadCharges(chargesUrl).then(v=>{
                            let charges = parseCharges(v, chargesFormat);
                            if(charges !== void 0){
                                checkChargesCount(charges, plugin);
                                SharedStorage.set("CHARGES", charges);
                                checkPolymerSize(plugin);
                                generateThemes();
                            }
                        });
                        res();
                    }
                }).catch(err=>{
                    console.error("Cannot apply transform.", err);
                });
            });
        });
        
        return modelLoadPromise.then((val)=>{
            EventQueue.subscribe(Events.LM_GET_VISUALIZATION_MODE, lm_get_visualization_mode_hndlr);
        });
    }

    export function generateThemes(plugin?:LiteMol.Plugin.Controller){
        if(plugin === void 0){
            plugin = SharedStorage.get("LM-PLUGIN");
        }
        if(plugin === void 0){
            console.warn("There is no plugin instance available for rendering theme. Skipping theme generation...");
            return;
        }
        let charges = SharedStorage.get("CHARGES");
        
        let hasSurface = (plugin.context.select('molecule-surface').length>0);
        let hasHetBaS = (plugin.context.select('molecule-bas').length>0);
        let hasHet = (plugin.context.select('molecule-het').length>0);
        let hasPolymer = (plugin.context.select('polymer-visual').length>0);

        let colorByAtom = SharedStorage.get("LM_USE_DEFAULT_THEMES");
        if(charges === void 0 || charges === null || charges.length === 0){
            //console.warn("No charges have been loaded! Skipping theme generation...");
            colorByAtom = true;
        }
        if(colorByAtom!==void 0 && colorByAtom !== null && colorByAtom){
            let ballsAndSticksByElementSymbol = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                .filter((v,i,a)=>{
                return v.name === "Element Symbol";
            })[0];
            let cartoonsByChainId = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                .filter((v,i,a)=>{
                return v.name === "Chain ID";
            })[0];
            let surfaceDefaultTheme = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                .filter((v,i,a)=>{
                return v.name === "Chain ID";
            })[0];

            applyDefaultTheme(hasHet, ballsAndSticksByElementSymbol,"BallsAndSticks", plugin, "molecule-het");
            if(hasPolymer){
                applyDefaultTheme(hasPolymer, cartoonsByChainId, "Cartoons", plugin, "polymer-visual");
            }
            applyDefaultTheme(hasHetBaS, ballsAndSticksByElementSymbol,"BallsAndSticks", plugin, "molecule-bas");
            applyDefaultTheme(hasSurface, surfaceDefaultTheme,"Surface", plugin, "molecule-surface", 1);
            return;
        }
        
        if(hasHet){
            applyTheme(generateColorTheme(plugin, charges, "molecule-het"), plugin, 'molecule-het');
        }
        if(hasPolymer){
            applyTheme(generateColorThemeCartoons(plugin, charges), plugin, 'polymer-visual');
        }
        if(hasHetBaS){
            applyTheme(generateColorTheme(plugin, charges, 'molecule-bas'), plugin, 'molecule-bas');
        }
        if(hasSurface){
            applyTheme(generateColorThemeSurface(plugin, charges), plugin, 'molecule-surface');
        }
    }

    function applyDefaultTheme(hasRef: boolean, defaultThemeTemplate: LiteMol.Bootstrap.Visualization.Theme.Template, 
        defaultThemeType: "Cartoons" | "Calpha" | "BallsAndSticks" | "VDWBalls" | "Surface",
        plugin: LiteMol.Plugin.Controller, visualRef: string, transparencyAlpha?:number){
        let defaultTheme = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get(defaultThemeType);
        if(defaultTheme !== void 0 && hasRef){
            let c = LiteMol.Core.Utils.FastMap.create<string, LiteMol.Visualization.Color>();
            defaultThemeTemplate.colors!.forEach((cc, n) => {
                c.set(n!, cc!);
            });   
            
            let transparency = defaultTheme.theme.transparency;
            if(transparencyAlpha !== void 0){
                transparency.alpha = transparencyAlpha;
            }
            applyTheme(defaultThemeTemplate.provider(plugin.context.select(visualRef)[0], 
            {
                colors: c,
                disableFog: defaultTheme.theme.disableFog,
                interactive: defaultTheme.theme.interactive,
                isSticky: true,
                transparency: transparency,
                variables: defaultTheme.theme.variables,
    
            }), plugin, visualRef);
        }
    }

    export function checkPolymerSize(plugin: LiteMol.Plugin.Controller){
        let polymerVisual = plugin.context.select("polymer-visual");
        let count = 0;
        if(polymerVisual.length>0){
            count = (polymerVisual[0].props as any).model.model.data.atoms.count;
        }
        else{
            let basVisual = plugin.context.select("molecule-bas");
            count = (basVisual[0].props as any).model.entity.props.model.data.atoms.count;
        }
        if(count < 100){
            if(polymerVisual.length>0){
                LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                    entity: plugin.context.select("polymer-visual")[0],
                    visible: false
                });
            }
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("molecule-bas")[0],
                visible: true
            });
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("molecule-surface")[0],
                visible: false
            });
            visualizationModeChanged(MODE_BAS);
        }
        else{
            if(polymerVisual.length>0){
                LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                    entity: plugin.context.select("polymer-visual")[0],
                    visible: true
                });
            }
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("molecule-bas")[0],
                visible: !(polymerVisual.length>0)
            });
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("molecule-surface")[0],
                visible: false
            });
            visualizationModeChanged((polymerVisual.length>0)?MODE_CARTOONS:MODE_BAS);
        }
    }

    function visualizationModeChanged(newMode:string){
        SharedStorage.set(VIZUALIZATION_MODE, newMode);
        EventQueue.send(Events.LM_VISUALIZATION_MODE_CHANGED, { mode: SharedStorage.get(VIZUALIZATION_MODE)});
    }

    function generateColorThemeSurface(plugin: LiteMol.Plugin.Controller, charges: number[]){     
        let colors = new Map<number, LiteMol.Visualization.Color>();       

        let results = plugin.selectEntities('molecule-surface');
        if(results===void 0 || results.length === 0){
            return;
        }
        let props = (results[0].props as any);
        let indices = props.model.entity.props.indices;
        if(indices === void 0){
            indices = props.model.entity.props.model.positions.indices;
        }

        /*let entity = results[0];
        let model = LiteMol.Bootstrap.Utils.Molecule.findModel(entity)!.props.model;
        let atomRadius = LiteMol.Bootstrap.Utils.vdwRadiusFromElementSymbol(model);
        let surfaceParams = LiteMol.Bootstrap.Visualization.Molecule.Default.SurfaceParams;
        let density = surfaceParams.density;
        let probeRadius = surfaceParams.probeRadius;
        let vdwScaleFactor;

        // make the atoms artificially bigger for low resolution surfaces
        if (density >= 0.99)  {
            // so that the number is float and not int32 internally 
            vdwScaleFactor = 1.000000001; 
        }
        else {
            vdwScaleFactor = 1 + (1 - density * density);
        }*/

        let minVal = charges.reduce((pv,cv,ci,a)=>{
            //let r = vdwScaleFactor * atomRadius(ci) + probeRadius;
            return Math.min(cv/*/r*/, pv);
        }, Number.MAX_VALUE);
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            //let r = vdwScaleFactor * atomRadius(ci) + probeRadius;
            return Math.max(cv/*/r*/, pv);
        }, Number.MIN_VALUE);

        let themeColorSettings = getAndAdaptColorSettings(minVal, maxVal);
        let surfaceCharges = new Map<number, number>();
        for(let i=0;i<indices.length;i++){
            //let r = vdwScaleFactor * atomRadius(i) + probeRadius;
            if(Number(indices[i])>=charges.length){
                console.log(charges.length + "[ind:"+indices[i]+"] {i:"+i+"}");
                continue;
            }
            /*if(isNaN(r)||r==0){
                console.log("R:");
                console.log(r);
                continue;
            }*/
            let chg = charges[indices[i]]/*/r*/;
            surfaceCharges.set(indices[i], chg);
            if(isNaN(chg)){
                colors.set(indices[i], void 0);
                continue;
            }
            let color = getColorForSurface(chg, themeColorSettings);
            colors.set(indices[i], color);
        }

        SharedStorage.set("SURFACE-CHARGES", surfaceCharges);

        return createTheme(colors);        
    } 

    export function switchToSurface(plugin: LiteMol.Plugin.Controller){
        let polymerVisual = plugin.context.select("polymer-visual");
        if(polymerVisual.length>0){
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("polymer-visual")[0],
                visible: false
            });
        }
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-bas")[0],
            visible: false
        });
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-surface")[0],
            visible: true
        });
        visualizationModeChanged(MODE_SURFACE);
    }

    export function isVisible(plugin:LiteMol.Plugin.Controller, selector:string){
        if(plugin.context.select(selector)[0] === void 0){
            return false;
        }
        return plugin.context.select(selector)[0].state.visibility === 0;
    }

    export function switchToCartoons(plugin: LiteMol.Plugin.Controller){
        let polymerVisual = plugin.context.select("polymer-visual");
        if(polymerVisual.length>0){
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("polymer-visual")[0],
                visible: true
            });
        }
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-bas")[0],
            visible: !(polymerVisual.length>0)
        });
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-surface")[0],
            visible: false
        });
        visualizationModeChanged((polymerVisual.length>0)?MODE_CARTOONS:MODE_BAS);
    }

    export function switchToBaS(plugin: LiteMol.Plugin.Controller){
        let polymerVisual = plugin.context.select("polymer-visual");
        if(polymerVisual.length>0){
            LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
                entity: plugin.context.select("polymer-visual")[0],
                visible: false
            });
        }
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-bas")[0],
            visible: true
        });
        LiteMol.Bootstrap.Command.Entity.SetVisibility.dispatch(plugin.context, {
            entity: plugin.context.select("molecule-surface")[0],
            visible: false
        });
        visualizationModeChanged(MODE_BAS);
    }

}

export type SupportedFormat = "SDF" | "mmBCIF" | "mmCIF" | "PDB";

export type SupportedChargesFormat = "CHG" | "MOL2" | "TXT";
