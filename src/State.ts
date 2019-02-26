import { SharedStorage } from "./SharedStorage";

export namespace LMState {

    import Transformer = LiteMol.Bootstrap.Entity.Transformer;

    export interface SurfaceTag { type: string; element?: any; }

    function applyTheme(theme:LiteMol.Visualization.Theme, plugin:LiteMol.Plugin.Controller, ref: string){
        LiteMol.Bootstrap.Command.Visual.ResetScene.getStream(plugin.context).subscribe((val)=>{
            LiteMol.Bootstrap.Command.Visual.UpdateBasicTheme.dispatch(plugin.context, { 
                visual: plugin.context.select(ref)[0] as any, theme
            });
        });
        LiteMol.Bootstrap.Command.Visual.UpdateBasicTheme.dispatch(plugin.context, { 
            visual: plugin.context.select(ref)[0] as any, theme
        });
    }

    function generateColorTheme(charges: number[]){
        let colors = new Map<number, LiteMol.Visualization.Color>();       
        let minVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.min(cv, pv);
        });
        let maxVal = charges.reduce((pv,cv,ci,a)=>{
            return Math.max(cv, pv);
        });
        
        for(let i=0;i<charges.length;i++){
            let chg = charges[i];
            let color = getColor(chg, {
                minColor: LiteMol.Visualization.Color.fromRgb(255,0,0),
                maxColor: LiteMol.Visualization.Color.fromRgb(0,0,255),
                minVal,
                maxVal,
                centerAbsolute: true,
                centerPosition: 0,
                maxColorMiddle: LiteMol.Visualization.Color.fromRgb(255,255,255),
                minColorMiddle: LiteMol.Visualization.Color.fromRgb(255,255,255),
                skipMiddle: false
            });
            colors.set(i, color);
        }

        let theme = LiteMol.Visualization.Theme.createMapping(LiteMol.Visualization.Theme.createColorMapMapping(
                (idx:number)=>{
                    return idx;
                },
                colors,
                LiteMol.Visualization.Color.fromRgb(255,255,255)
            ));
         return theme;            
    } 

    interface ColorPaletteFunctionSettings{
        minVal:number;
        maxVal:number;
        minColor: LiteMol.Visualization.Color;
        maxColor: LiteMol.Visualization.Color;
        minColorMiddle: LiteMol.Visualization.Color;
        maxColorMiddle: LiteMol.Visualization.Color;
        skipMiddle: boolean;
        centerPosition:number;
        centerAbsolute:boolean;
    }

    function getColor(value: number, settings: ColorPaletteFunctionSettings){
        let minVal = settings.minVal;
        let maxVal = settings.maxVal;
        let minColor = settings.minColor;
        let maxColor = settings.maxColor;
        let minColorMiddle = settings.minColorMiddle;
        let maxColorMiddle = settings.maxColorMiddle;
        let skipMiddle = settings.skipMiddle;
        let middle = (settings.centerAbsolute)?settings.centerPosition:(minVal+maxVal)/2;

        var rgb = LiteMol.Visualization.Color.fromRgb(255,255,255);

        if(value<(minVal+maxVal)/2){
            let t = (value - minVal) / (middle - minVal);
            LiteMol.Visualization.Color.interpolate(minColor, maxColorMiddle, t, rgb);
        }
        else{
            let t = (value - middle) / (maxVal - middle);
            LiteMol.Visualization.Color.interpolate(minColorMiddle, maxColor, t, rgb);
        }

        if(skipMiddle&&settings.centerAbsolute){
            throw new Error("Cannot config absolute center and skip center at once! Forbidden configuration -> "
                + "skipMiddle=true && centerAbsolute=true");
        }
        if(skipMiddle&&!settings.centerAbsolute){
            let t = (value - minVal) / (maxVal - minVal);
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
                        polymer: false, 
                        het: true,
                        hetRef: 'molecule-het'
                    });
                    
            plugin.applyTransform(model)
                .then(() => {
                    if(plugin.instance === void 0){
                        rej("Loading data interupted due to redraw.");
                        return;
                    }
                    if(plugin.context.select('molecule-het').length!==1){
                        rej("Application was unable to retrieve protein structure file.");
                    }
                    else{                        
                        loadCharges(chargesUrl).then(v=>{
                            
                            let charges = parseCharges(v, chargesFormat);
                            if(charges !== void 0){
                                SharedStorage.set("CHARGES", charges);
                                applyTheme(generateColorTheme(charges), plugin, 'molecule-het');
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

export type SupportedChargesFormat = "CHG" | "MOL2";