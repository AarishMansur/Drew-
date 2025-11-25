import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Footer from '../components/Footer';
import { ToastContainer } from 'react-toastify';
import About from '../components/About';
import { useLocation, useNavigate } from 'react-router-dom';
import Login from '../components/Login';

gsap.registerPlugin(ScrollTrigger);

type ShapeType = 'circle' | 'square' | 'rectangle';

type ContentItem = 
  | { type: 'text'; value: string }
  | { type: 'icon'; id: number; shape: ShapeType; color: string; aspect: number };

const CONTENT: ContentItem[] = [
  { type: 'text', value: "Build" },
  { type: 'icon', id: 0, shape: 'circle', color: 'bg-blue-500', aspect: 1 },
  { type: 'text', value: "Draw" },
  { type: 'icon', id: 1, shape: 'square', color: 'bg-rose-500', aspect: 1 },
  { type: 'text', value: "Shape" },
  { type: 'icon', id: 2, shape: 'rectangle', color: 'bg-amber-400', aspect: 1.6 },
  { type: 'text', value: "and" },
  { type: 'icon', id: 3, shape: 'circle', color: 'bg-emerald-500', aspect: 1 },
  { type: 'text', value: "Colloborate" },
  { type: 'icon', id: 4, shape: 'square', color: 'bg-indigo-500', aspect: 1 },
];

export const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const iconsContainerRef = useRef<HTMLDivElement>(null);
  
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const placeholderRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  const clonesContainerRef = useRef<HTMLDivElement>(null);
  const clonesRefs = useRef<HTMLDivElement[]>([]);

  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const lockedPositions = useRef<Array<{x: number, y: number, width: number, height: number}>>([]);

 

  const location = useLocation();
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    const textSegmentCount = CONTENT.filter(c => c.type === 'text').length;
    const indices = Array.from({ length: textSegmentCount }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!containerRef.current || !iconsContainerRef.current || !headerRef.current) return;

      const isMobile = window.innerWidth < 768;
      const baseTargetHeight = isMobile ? 30 : 60;
      
      const firstIcon = iconRefs.current[0];
      const initialHeight = firstIcon ? firstIcon.getBoundingClientRect().height : (isMobile ? 40 : 150);
      
      const targetScale = baseTargetHeight / initialHeight;
      
      const gap = isMobile ? 8 : 16; 
      
      let totalInitialWidth = 0;
      const iconItems = CONTENT.filter(c => c.type === 'icon') as Extract<ContentItem, { type: 'icon' }>[];
      
      iconItems.forEach(item => {
         totalInitialWidth += (initialHeight * item.aspect);
      });
      totalInitialWidth += gap * (iconItems.length - 1);

      let currentX = 0;
      const iconOffsetsX = iconItems.map((item) => {
        const width = initialHeight * item.aspect;
        const centerOfItem = currentX + (width / 2);
        currentX += width + gap;
        return centerOfItem - (totalInitialWidth / 2);
      });

      gsap.set(headerRef.current, { y: 0, opacity: 1, visibility: 'visible' });
      gsap.set(iconsContainerRef.current, { y: 0, scale: 1, opacity: 1, visibility: 'visible' });
      if (clonesContainerRef.current) gsap.set(clonesContainerRef.current, { visibility: 'hidden' });
      gsap.set(containerRef.current, { backgroundColor: '#F0F0F0' });

      const trigger = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "+=3500",
        pin: true,
        scrub: 1,
        pinSpacing: true,
        onUpdate: (self) => {
          const progress = self.progress;
          
          if (progress <= 0.2) {
            const phaseProgress = progress / 0.2;

            const headerP = Math.min(phaseProgress * 2, 1);
            gsap.set(headerRef.current, {
              y: -100 * headerP, 
              opacity: 1 - headerP,
              visibility: headerP >= 1 ? 'hidden' : 'visible'
            });

            gsap.set(iconsContainerRef.current, {
              y: 0, 
              scale: 1,
              opacity: 1,
              visibility: 'visible'
            });

            if (clonesContainerRef.current) clonesContainerRef.current.style.visibility = 'hidden';
            gsap.set(containerRef.current, { backgroundColor: '#F0F0F0' });
            
            lockedPositions.current = [];
          }

          else if (progress > 0.2 && progress <= 0.5) {
            const phaseProgress = (progress - 0.2) / 0.3;

            gsap.set(headerRef.current, { opacity: 0, visibility: 'hidden' });

            if (phaseProgress > 0.5) {
                gsap.set(containerRef.current, { backgroundColor: '#ffffff' });
            } else {
                gsap.set(containerRef.current, { backgroundColor: '#F0F0F0' });
            }

            const containerPaddingBottom = isMobile ? 32 : 48; 
            const containerH = initialHeight + containerPaddingBottom;
            
            const startY = 0;
            const targetY = -(window.innerHeight / 2 - containerH / 2);

            const currentY = gsap.utils.interpolate(startY, targetY, phaseProgress);
            const currentScale = gsap.utils.interpolate(1, targetScale, phaseProgress);

            gsap.set(iconsContainerRef.current, {
              y: currentY,
              scale: currentScale,
              opacity: 1,
              visibility: 'visible'
            });

            if (clonesContainerRef.current) clonesContainerRef.current.style.visibility = 'hidden';
            
            lockedPositions.current = [];
          }

          else if (progress > 0.5 && progress <= 0.75) {
            const phaseProgress = (progress - 0.5) / 0.25;

            gsap.set(containerRef.current, { backgroundColor: '#ffffff' });
            gsap.set(iconsContainerRef.current, { opacity: 0, visibility: 'hidden' });
            if (clonesContainerRef.current) clonesContainerRef.current.style.visibility = 'visible';

            const viewportCenterX = window.innerWidth / 2;
            const viewportCenterY = window.innerHeight / 2;

            clonesRefs.current.forEach((clone, i) => {
              if (!clone) return;
              const placeholder = placeholderRefs.current[i];
              if (!placeholder) return;
              const item = iconItems[i];

              const startX = viewportCenterX + (iconOffsetsX[i] * targetScale) - ((initialHeight * item.aspect * targetScale) / 2);
              const startY = viewportCenterY - (baseTargetHeight / 2);

              const phRect = placeholder.getBoundingClientRect();
              const targetX = phRect.left;
              const targetY = phRect.top;

              let currentX, currentY;
              if (phaseProgress < 0.5) {
                 const pY = phaseProgress / 0.5;
                 const easedPY = 1 - Math.pow(1 - pY, 3);
                 currentY = gsap.utils.interpolate(startY, targetY, easedPY);
                 currentX = startX; 
              } else {
                 const pX = (phaseProgress - 0.5) / 0.5;
                 const easedPX = 1 - Math.pow(1 - pX, 3);
                 currentY = targetY;
                 currentX = gsap.utils.interpolate(startX, targetX, easedPX);
              }
              
              gsap.set(clone, {
                x: currentX,
                y: currentY,
                width: baseTargetHeight * item.aspect,
                height: baseTargetHeight,
                opacity: 1
              });
              
              if (phaseProgress >= 0.99) {
                lockedPositions.current[i] = {
                  x: targetX,
                  y: targetY,
                  width: baseTargetHeight * item.aspect,
                  height: baseTargetHeight
                };
              }
            });

            textRefs.current.forEach(t => t && (t.style.opacity = '0'));
          }

          else {
            const phaseProgress = (progress - 0.75) / 0.25;

            gsap.set(containerRef.current, { backgroundColor: '#ffffff' });
            gsap.set(iconsContainerRef.current, { opacity: 0, visibility: 'hidden' });
            if (clonesContainerRef.current) clonesContainerRef.current.style.visibility = 'visible';

            clonesRefs.current.forEach((clone, i) => {
              const item = iconItems[i];
              if (clone) {
                if (lockedPositions.current[i]) {
                  gsap.set(clone, {
                    x: lockedPositions.current[i].x,
                    y: lockedPositions.current[i].y,
                    width: lockedPositions.current[i].width,
                    height: lockedPositions.current[i].height,
                    opacity: 1
                  });
                } else {
                  const ph = placeholderRefs.current[i];
                  if (ph) {
                    const r = ph.getBoundingClientRect();
                    const pos = {
                      x: r.left,
                      y: r.top,
                      width: baseTargetHeight * item.aspect,
                      height: baseTargetHeight
                    };
                    lockedPositions.current[i] = pos;
                    gsap.set(clone, {
                      x: pos.x,
                      y: pos.y,
                      width: pos.width,
                      height: pos.height,
                      opacity: 1
                    });
                  }
                }
              }
            });

            textRefs.current.forEach((text, index) => {
               if (!text) return;
               const randIndex = shuffledIndices.indexOf(index);
               const total = textRefs.current.length;
               
               const start = (randIndex / total) * 0.6;
               const end = start + 0.4;
               
               let a = (phaseProgress - start) / (end - start);
               a = gsap.utils.clamp(0, 1, a);
               
               text.style.opacity = a.toString();
            });
          }
        }
      });

      return () => {
        trigger.kill();
      };
    }, containerRef);

    return () => ctx.revert();
  }, [shuffledIndices]);

 


 
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectParam = params.get("redirect");

    if (redirectParam) {
  
      sessionStorage.setItem("postLoginRedirect", redirectParam);
     
      sessionStorage.setItem("authModalTrigger", "share");
   
      navigate("/", { replace: true });
      return;
    }

  
    if (sessionStorage.getItem("authModalTrigger") === "share") {
      setIsLoginOpen(true);
      sessionStorage.removeItem("authModalTrigger");
    }
  }, [location.search, navigate]);

  
  return (
    <>
    
      <div ref={containerRef} className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-[#F0F0F0]">
        
        <div ref={headerRef} className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4 pointer-events-none">
          <div className="text-center pointer-events-auto">
              <h1 className="text-6xl md:text-9xl font-bold text-gray-900 mb-4 tracking-tighter leading-none google-sans">
                Drew
              </h1>
              <p className="text-xl md:text-2xl text-gray-500 font-medium mb-8">
                Shape your idea into an architecture
              </p>
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="px-8 py-3 rounded-full bg-black text-white font-semibold hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
              >
                Start Now
              </button>
          </div>
        </div>

        <div className="relative z-10 max-w-5xl px-4 md:px-8 text-center w-full">
          <div className="text-4xl md:text-7xl lg:text-8xl font-bold text-gray-900 flex flex-wrap justify-center items-center gap-x-2 md:gap-x-4 gap-y-1 md:gap-y-2" style={{ lineHeight: '1.2' }}>
            {CONTENT.map((item, index) => {
              if (item.type === 'text') {
                const textIndex = CONTENT.slice(0, index).filter(i => i.type === 'text').length;
                return (
                  <span 
                    key={index} 
                    ref={el => { textRefs.current[textIndex] = el; }}
                    className="opacity-0 google-sans " 
                  >
                    {item.value}
                  </span>
                );
              } else {
                return (
                  <span
                    key={index}
                    ref={el => { placeholderRefs.current[item.id] = el; }}
                    className="inline-block bg-transparent"
                    style={{
                      height: 'clamp(30px, 5vw, 60px)',
                      width: `calc(clamp(30px, 5vw, 60px) * ${item.aspect})`,
                      verticalAlign: 'middle'
                    }}
                  />
                );
              }
            })}
          </div>
        </div>

        <div 
          ref={iconsContainerRef}
          className="absolute bottom-0 left-0 w-full flex justify-center items-end pb-8 md:pb-12 gap-2 md:gap-4 pointer-events-none z-30 origin-center px-4"
        >
          {CONTENT.filter(c => c.type === 'icon').map((item, i) => (
            <div 
              key={(item as any).id}
              ref={el => { iconRefs.current[i] = el; }}
              className={`relative shadow-lg ${(item as any).color}`}
              style={{
                 height: 'clamp(25px, 15vw, 150px)', 
                 width: `calc(clamp(25px, 15vw, 150px) * ${(item as any).aspect})`,
                 borderRadius: (item as any).shape === 'circle' ? '9999px' : ((item as any).shape === 'rectangle' ? '12px' : '4px')
              }}
            />
          ))}
        </div>

        <div 
          ref={clonesContainerRef}
          className="fixed inset-0 pointer-events-none z-50 invisible"
        >
           {CONTENT.filter(c => c.type === 'icon').map((item, i) => (
              <div
                key={`clone-${(item as any).id}`}
                ref={el => { clonesRefs.current[i] = el!; }}
                className={`absolute shadow-sm ${(item as any).color}`}
                style={{
                  width: 0,
                  height: 0,
                  left: 0,
                  top: 0,
                  borderRadius: (item as any).shape === 'circle' ? '9999px' : ((item as any).shape === 'rectangle' ? '12px' : '4px')
                }}
              />
           ))}
        </div>

      </div>
      <About />
      <Footer />

      
      
      <ToastContainer 
  position="top-right"
  autoClose={3000}
  hideProgressBar={false}
  newestOnTop
  closeOnClick
  pauseOnHover
  draggable
  theme="dark"
/>

      {/* Login Modal Overlay */}
      {isLoginOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsLoginOpen(false);
            }
          }}
        >
          <Login onClose={() => setIsLoginOpen(false)} />
        </div>
      )}
    </>
  );
};