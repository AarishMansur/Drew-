import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  LayoutGrid, 
  ChevronDown, 
  LogOut,
  FolderOpen,
  Trash2
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHook';
import { addSpace, deleteSpace, setCurrentSpace } from '../features/space/spaceSlice';
import { supabase } from '../lib/supabase';


const signOut = async () => {
  const { error } = await supabase.auth.signOut()
   console.log("Error in singing out",error);
};

export default function Home() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();


  const spaces = useAppSelector((state) => state.space.list);
  const userId = useAppSelector((state) => state.auth.userId);
  const currentUser = useAppSelector((state) => state.auth);

  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isSpacesExpanded, setIsSpacesExpanded] = useState(true);

  const handleCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSpaceName.trim()) {
      const id = crypto.randomUUID();
      
      const newSpace = {
        userId,
        spaceId: id,
        name: newSpaceName,
        updatedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric'
        }),
        sharedLink: `${window.location.origin}/space/${id}`,
        participants: 1,
      };

      dispatch(addSpace(newSpace));
      dispatch(setCurrentSpace(id));
      
      setNewSpaceName('');
      setIsModalOpen(false);
      
      navigate(`/space/${id}`);
    }
  };

  const handleDeleteSpace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this space?')) {
      dispatch(deleteSpace(id));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
    
      <style>{`
        @keyframes border-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .moving-border-container {
          position: relative;
          overflow: hidden;
          padding: 2px; /* Width of the border */
          border-radius: 0.85rem;
          isolation: isolate;
        }
        .moving-border-container::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 270deg,
            #000 360deg
          );
          animation: border-spin 4s linear infinite;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }
        .moving-border-container:hover::before {
          opacity: 1;
        }
        .moving-border-content {
          background: white;
          height: 100%;
          width: 100%;
          border-radius: 0.75rem;
          z-index: 1;
        }
      `}</style>

    
      <aside className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0 transition-all duration-300">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center">
               <span className="text-white text-xs font-bold">D</span>
             </div>
             Drew
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
               <div className="flex items-center justify-between mb-2 group">
                  <button 
                    onClick={() => setIsSpacesExpanded(!isSpacesExpanded)}
                    className="flex items-center gap-1 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors"
                  >
                     <span>Your Spaces</span>
                     <ChevronDown className={`w-3 h-3 transition-transform ${isSpacesExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-black transition-colors"
                    title="Create New Space"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
               </div>
               
               {isSpacesExpanded && (
                 <ul className="space-y-1">
                   {spaces.length === 0 && (
                      <li className="text-xs text-gray-400 italic px-3 py-2">No spaces yet</li>
                   )}
                   {spaces.map((space) => (
                     <li key={space.spaceId} className="group flex items-center">
                       <button 
                          onClick={() => {
                            dispatch(setCurrentSpace(space.spaceId));
                            navigate(`/space/${space.spaceId}`);
                          }}
                          className="flex-1 flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-200/50 hover:text-gray-900 transition-colors text-left"
                       >
                         <FolderOpen className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                         <span className="truncate">{space.name || space.spaceId}</span>
                       </button>
                       <button
                          onClick={(e) => handleDeleteSpace(e, space.spaceId)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded transition-all"
                          title="Delete Space"
                       >
                         <Trash2 className="w-3 h-3" />
                       </button>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
        </div>

        <div className="p-4 border-t border-gray-200">
           <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-200/50 cursor-pointer transition-colors group">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-sm">
                {currentUser.userName.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{currentUser.userName}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
              </div>
              <LogOut 
                className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignOut();
                }}
              />
           </div>
        </div>
      </aside>

     
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white shrink-0">
           <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative">
          
           {spaces.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-4 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                   <LayoutGrid className="w-10 h-10 text-gray-300" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No Spaces Created Yet</h2>
                <p className="text-gray-500 mb-8 text-center max-w-md">
                  Start your architectural journey by creating your first space. Collaborate, draw, and build your ideas.
                </p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-gray-200"
                >
                  <Plus className="w-5 h-5" />
                  Create New Space
                </button>
             </div>
           ) : (
             <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex flex-col items-center justify-center h-56 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all group"
                  >
                     <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                        <Plus className="w-6 h-6 text-gray-600 group-hover:text-black" />
                     </div>
                     <span className="font-medium text-gray-600 group-hover:text-gray-900">Create New Space</span>
                  </button>

                 
                  {spaces.map((space) => (
                    <div 
                      key={space.spaceId}
                      onClick={() => {
                        dispatch(setCurrentSpace(space.spaceId));
                        navigate(`/space/${space.spaceId}`);
                      }}
                      className="moving-border-container cursor-pointer group"
                    >
                      <div className="moving-border-content flex flex-col justify-between p-6 transition-colors h-56 border border-gray-200 group-hover:border-transparent">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-gray-50 to-gray-100/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500 z-0"></div>
                          
                          <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300 shadow-sm">
                              <LayoutGrid className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-xl text-gray-900 mb-1 truncate pr-4">{space.name}</h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              Edited {space.updatedAt}
                            </p>
                          </div>

                          <div className="relative z-10 mt-auto pt-4 flex items-center justify-between border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                             <div className="flex -space-x-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500 border border-white text-[10px] text-white flex items-center justify-center">
                                  {currentUser.userName.charAt(0)}
                                </div>
                             </div>
                             <span className="text-xs text-gray-400 group-hover:translate-x-1 transition-transform">Open Canvas &rarr;</span>
                          </div>
                      </div>
                    </div>
                  ))}
               </div>
             </div>
           )}
        </div>
      </main>

      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-bold text-gray-900">Create Space</h3>
                    <p className="text-sm text-gray-500 mt-1">Give your new architecture space a name.</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                   <FolderOpen className="w-5 h-5 text-gray-600" />
                 </div>
              </div>

              <form onSubmit={handleCreateSpace}>
                <div className="mb-8">
                  <label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-2 ml-1">
                    Space Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="spaceName"
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      placeholder="e.g., Living Room Redesign"
                      className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white text-lg"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 focus:outline-none transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newSpaceName.trim()}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-black rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                  >
                    Create Space
                  </button>
                </div>
              </form>
            </div>
            <div className="h-1.5 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 w-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}