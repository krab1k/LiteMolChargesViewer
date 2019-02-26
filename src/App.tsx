import * as React from 'react';
import './styles/App.css';
import './ext/LiteMol/js/LiteMol-plugin';

import { LiteMolContainer } from './LMComponent';

interface AppState {}

class App extends React.Component<{}, AppState> {
  render() {
    return (
      <div className="App">
        <LiteMolContainer conformationId={null} />
      </div>
    );
  }
}

export default App;
