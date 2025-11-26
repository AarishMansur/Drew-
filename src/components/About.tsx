import React from 'react';
import videoAbout from "../assets/cursorful-video-1764166445864.mp4";

const About: React.FC = () => {
  return (
    <div className="w-full bg-white py-16 md:py-24 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="border-2 border-gray-900 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b-2 lg:border-b-0 lg:border-r-2 border-gray-900">
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight google-sans">
                What is Drew?
              </h2>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-6">
                Drew is a platform where you can transform your ideas into a full fledged architecture and can collaborate with others too :)
              </p>
            </div>

            <div className="relative bg-gray-50 aspect-video lg:aspect-auto min-h-[300px] lg:min-h-[500px]">
              <video
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                <source src={videoAbout} type="video/mp4" />
              </video>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
