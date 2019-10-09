import { SharedStorage } from "./SharedStorage";
import { EventQueue, Events } from "./EventQueue";

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

    export function generateColorTheme(plugin: LiteMol.Plugin.Controller, charges: number[]){
        let colors = new Map<number, LiteMol.Visualization.Color>();       
        let minVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.min(cv, pv);
        });
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.max(cv, pv);
        });

        let indices = (plugin.selectEntities("molecule-het")[0].props as any).model.entity.props.indices;

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
        contents = contents.split("@<TRIPOS>ATOM")[1];
        contents = contents.split("@<TRIPOS>")[0];

        let lines = contents.split("\n").filter((v,i,a)=>{
            return v.length>0;
        });

        let charges = [];
        for(let l of lines){
            let parts = l.replace(/\s+/g," ").replace(/^\s/g,"").split(" ");
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

    export function loadData(plugin: LiteMol.Plugin.Controller, structureUrl: string, 
            chargesUrl: string, structureFormat: SupportedFormat, chargesFormat: SupportedChargesFormat) {
        plugin.clear();
        
        let modelLoadPromise = new Promise<any>((res,rej)=>{
            let model = plugin.createTransform()
                .add(plugin.root, Transformer.Data.Download, 
                    { 
                        url: structureUrl, 
                        type: 'String', id: "structure_element" 
                    })
                .then(Transformer.Molecule.CreateFromData, 
                    { 
                        format: getFormat(structureFormat)
                    }, 
                    { 
                        isBinding: true 
                    })
                .then(Transformer.Molecule.CreateModel, { modelIndex: 0 })
                .then(Transformer.Molecule.CreateMacromoleculeVisual, 
                    { 
                        polymer: true, polymerRef: 'polymer-visual', het: true,
                        hetRef: 'molecule-het', water: true, waterRef: 'molecule-het'
                    });
                                    
            plugin.applyTransform(model)
                .then(() => {
                    if(plugin.instance === void 0){
                        rej("Loading data interupted due to redraw.");
                        return;
                    }
                    let hasHet = (plugin.context.select('molecule-het').length>0);
                    let hasPolymer = (plugin.context.select('polymer-visual').length>0);
                    if((!hasHet) && !hasPolymer){
                        rej("Application was unable to retrieve protein structure file.");
                    }
                    else{      
                        loadCharges(chargesUrl).then(v=>{
                            let charges = parseCharges(v, chargesFormat);
                            if(charges !== void 0){
                                checkChargesCount(charges, plugin);
                                SharedStorage.set("CHARGES", charges);
                                generateThemes();
                            }
                        });
                        
                        res();
                    }
                })
                .catch(err=>{                    
                    console.error("Cannot apply transform.", err);
                });
        });

        let promises = [];

        promises.push(modelLoadPromise);

        return Promise.all(promises);
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
        if(charges === void 0){
            console.warn("No charges have been loaded! Skipping theme generation...");
            return;
        }
        let hasHet = (plugin.context.select('molecule-het').length>0);
        let hasPolymer = (plugin.context.select('polymer-visual').length>0);

        let colorByAtom = SharedStorage.get("LM_USE_DEFAULT_THEMES");
        if(colorByAtom!==void 0 && colorByAtom !== null && colorByAtom){
            let ballsAndSticksByElementSymbol = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                .filter((v,i,a)=>{
                return v.name === "Element Symbol";
            })[0];
            let cartoonsByChainId = LiteMol.Bootstrap.Visualization.Molecule.Default.Themes
                .filter((v,i,a)=>{
                return v.name === "Chain ID";
            })[0];

            let ballsAndSticksDefault = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get("BallsAndSticks");
            if(ballsAndSticksDefault !== void 0 && hasHet){
                let c = LiteMol.Core.Utils.FastMap.create<string, LiteMol.Visualization.Color>();
                ballsAndSticksByElementSymbol.colors!.forEach((cc, n) => {
                    c.set(n!, cc!);
                });                 

                applyTheme(ballsAndSticksByElementSymbol.provider(plugin.context.select("molecule-het")[0], 
                {
                    colors: c,
                    disableFog: ballsAndSticksDefault.theme.disableFog,
                    interactive: ballsAndSticksDefault.theme.interactive,
                    isSticky: true,
                    transparency: ballsAndSticksDefault.theme.transparency,
                    variables: ballsAndSticksDefault.theme.variables,

                }), plugin, "molecule-het");
            }

            let cartoonsDefault = LiteMol.Bootstrap.Visualization.Molecule.Default.ForType.get("Cartoons");
            if(cartoonsDefault !== void 0 && hasPolymer){
                let c = LiteMol.Core.Utils.FastMap.create<string, LiteMol.Visualization.Color>();
                cartoonsByChainId.colors!.forEach((cc, n) => {
                    c.set(n!, cc!);
                });                 

                applyTheme(cartoonsByChainId.provider(plugin.context.select("polymer-visual")[0], 
                {
                    colors: c,
                    disableFog: cartoonsDefault.theme.disableFog,
                    interactive: cartoonsDefault.theme.interactive,
                    isSticky: true,
                    transparency: cartoonsDefault.theme.transparency,
                    variables: cartoonsDefault.theme.variables,

                }), plugin, "polymer-visual");
            }
            return;
        }
        
        if(hasHet){
            applyTheme(generateColorTheme(plugin, charges), plugin, 'molecule-het');
        }
        if(hasPolymer){
            applyTheme(generateColorThemeCartoons(plugin, charges), plugin, 'polymer-visual');
        }
    }
}

export type SupportedFormat = "SDF" | "mmBCIF" | "mmCIF" | "PDB";

export type SupportedChargesFormat = "CHG" | "MOL2" | "TXT";
