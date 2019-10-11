import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
// import registerServiceWorker from './registerServiceWorker';
import './styles/index.css';
import { EventQueue, Events } from './EventQueue';
import { SharedStorage } from './SharedStorage';
import { LMState } from "./State";

if(!EventQueue.isInitialised()){
  EventQueue.init();
  SharedStorage.init();
}

EventQueue.subscribe(Events.LM_SET_DEFAULT_COLOR_SCHEME, (settings)=>{
  SharedStorage.set("THEME_COLOR_SETTINGS", settings);
  LMState.generateThemes();
});

EventQueue.subscribe(Events.LM_STOP, ()=>{
  SharedStorage.set("LM-PLUGIN", void 0);
});

EventQueue.subscribe(Events.LM_START, (params)=>{
  SharedStorage.set("LM-PLUGIN", params.plugin);
});

EventQueue.subscribe(Events.LM_USE_DEFAULT_THEMES, (params)=>{
  SharedStorage.set("LM_USE_DEFAULT_THEMES", params.value);
  LMState.generateThemes();
});

EventQueue.subscribe(Events.LM_SWITCH_TO_SURFACE, ()=>{
  let plugin = SharedStorage.get("LM-PLUGIN");
  if(plugin !== void 0 && plugin !== null){
    LMState.switchToSurface(plugin);
  }
});

EventQueue.subscribe(Events.LM_SWITCH_TO_CARTOONS, ()=>{
  let plugin = SharedStorage.get("LM-PLUGIN");
  if(plugin !== void 0 && plugin !== null){
    LMState.switchToCartoons(plugin);
  }
});

EventQueue.subscribe(Events.LM_SWITCH_TO_BALLS_AND_STICKS, ()=>{
  let plugin = SharedStorage.get("LM-PLUGIN");
  if(plugin !== void 0 && plugin !== null){
    LMState.switchToBaS(plugin);
  }
});

ReactDOM.render(
    <App />,
  document.getElementById('root') as HTMLElement
);
// registerServiceWorker();
