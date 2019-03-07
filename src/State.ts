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
        let o = (Math.ceil(Number(nmbr)*10000)/10000);
        return o;
    }

    function applyTheme(theme:LiteMol.Visualization.Theme, plugin:LiteMol.Plugin.Controller, ref: string){
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
            finalCharge = roundTo4Positions(finalCharge / (atomEndIdx-atomStartIdx));

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

    function generateColorTheme(plugin: LiteMol.Plugin.Controller, charges: number[]){
        let colors = new Map<number, LiteMol.Visualization.Color>();       
        let minVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.min(cv, pv);
        });
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.max(cv, pv);
        });

        let bound = Math.max(maxVal, Math.abs(minVal));
        DEFAULT_THEME_COLOR_SETTINGS.minVal = -bound;
        DEFAULT_THEME_COLOR_SETTINGS.maxVal = bound;

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

        var rgb = LiteMol.Visualization.Color.fromRgb(255,255,255);

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
                        hetRef: 'molecule-het'
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
                                if(hasHet){
                                    applyTheme(generateColorTheme(plugin, charges), plugin, 'molecule-het');
                                }
                                if(hasPolymer){
                                    applyTheme(generateColorThemeCartoons(plugin, charges), plugin, 'polymer-visual');
                                }
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
}

export type SupportedFormat = "SDF" | "mmBCIF" | "mmCIF" | "PDB";

export type SupportedChargesFormat = "CHG" | "MOL2" | "TXT";
