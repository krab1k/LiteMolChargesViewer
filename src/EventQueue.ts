type handler = (params?: any)=>void;

const _global = (window /* browser */ || global /* node */) as any;

export class EventQueue{
    static init(){
        _global.LiteMolChargesViewerEventQueue = {
            _handlers: new Map<string, handler[]>(),
            send: (command: string, params?: any)=>{
                let hndlrs = _global.LiteMolChargesViewerEventQueue._handlers.get(command);
                if(hndlrs === void 0 || hndlrs === null){
                    return;
                }
                for (let h of hndlrs){
                    h(params);
                }
            },
            subscribe: (command:string, h:handler)=>{
                let hndlrs = _global.LiteMolChargesViewerEventQueue._handlers.get(command);
                if(hndlrs === void 0 || hndlrs === null){
                    hndlrs = [];
                }
                hndlrs.push(h);
                _global.LiteMolChargesViewerEventQueue._handlers.set(command, hndlrs);
            },
            unsubscribe: (command:string, h:handler)=>{
                let handlers = _global.LiteMolChargesViewerEventQueue._handlers.get(command) as handler[];
                if(handlers !== void 0 && handlers !== null){
                    _global.LiteMolChargesViewerEventQueue._handlers.set(command, handlers.filter((v,i,a)=>{
                        return v !== h;
                    }));
                }
            }
        };
    }

    static send(command:string, params?: any){
        _global.LiteMolChargesViewerEventQueue.send(command, params);
    }

    static subscribe(command:string, h: handler){
        _global.LiteMolChargesViewerEventQueue.subscribe(command, h);
    }

    static unsubscribe(command:string, h: handler){
        _global.LiteMolChargesViewerEventQueue.unsubscribe(command, h);
    }
}

export enum Events{
    LM_START="lm-start",
    LM_STOP="lm-stop",
    LM_MOLECULE_LOADED="lm-molecule-loaded",
    LM_LOAD_MOLECULE="lm-load-molecule",
    LM_SET_DEFAULT_COLOR_SCHEME="lm-set-default-color-scheme",
    LM_INCOMPLETE_CHARGES_ERROR="lm-incomplete-charges-error"
}