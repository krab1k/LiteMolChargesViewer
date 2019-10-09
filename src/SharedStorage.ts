const _global = (window /* browser */ || global /* node */) as any;

export class SharedStorage{
    static isInitialised(){
        return _global.Storage!== void 0 && _global.Storage !== null;
    }

    static init(){
        _global.Storage = new Map<string, any>();
    }

    static set(key:string, value:any){
        _global.Storage.set(key, value);
    }

    static get(key:string){
        return _global.Storage.get(key);
    }

    static has(key:string){
        return _global.Storage.has(key);
    }
}