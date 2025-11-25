import { BrowserRouter , Routes, Route,  } from "react-router-dom";
import {Hero} from "./pages/Hero";
import Home from "./pages/Home";
import AuthCallback from "./pages/AuthCallBack";
import Canva from "./pages/Canva";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/home" element={<Home />} />
        <Route path="/space/:spaceId" element={<Canva />} />
      </Routes>
    </BrowserRouter>
  );
}
