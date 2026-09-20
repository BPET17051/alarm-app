import { Home } from './pages/Home';
import { ChannelPicker } from './pages/ChannelPicker';
import { AlarmsProvider } from './context/AlarmsContext';
import { ChannelProvider, useChannel } from './context/ChannelContext';

function ChannelGate() {
  const { status, session, handleLeaseLost } = useChannel();

  if (status === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-muted">กำลังตรวจสอบช่อง...</div>;
  }
  if (status === 'active' && session) {
    return (
      <AlarmsProvider key={session.channelId} session={session} onLeaseLost={handleLeaseLost}>
        <Home />
      </AlarmsProvider>
    );
  }
  return <ChannelPicker />;
}

function App() {
  return (
    <ChannelProvider>
      <ChannelGate />
    </ChannelProvider>
  );
}

export default App;
