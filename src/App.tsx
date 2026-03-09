import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { RoomPage } from './pages/RoomPage'

const App = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/room/:roomCode" element={<RoomPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
