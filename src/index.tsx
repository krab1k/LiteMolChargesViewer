import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import './styles/index.css';
import { EventQueue } from './EventQueue';
import { SharedStorage } from './SharedStorage';

EventQueue.init();
SharedStorage.init();

ReactDOM.render(
    <App />,
  document.getElementById('root') as HTMLElement
);
registerServiceWorker();
