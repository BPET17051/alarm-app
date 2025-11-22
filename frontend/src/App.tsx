import { Home } from './pages/Home';
import { AlarmsProvider } from './context/AlarmsContext';

function App() {
  return (
    <AlarmsProvider>
      <Home />
    </AlarmsProvider>
  );
}

export default App;
