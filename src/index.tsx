import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
// import registerServiceWorker from './registerServiceWorker';
import './styles/index.css';
import { EventQueue, Events } from './EventQueue';
import { SharedStorage } from './SharedStorage';
import { LMState } from "./State";

EventQueue.init();
SharedStorage.init();

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

ReactDOM.render(
    <App />,
  document.getElementById('root') as HTMLElement
);
// registerServiceWorker();
