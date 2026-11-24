import React from 'react';
import videoAbout from "../assets/cursorful-video-1764166445864.mp4";

const About: React.FC = () => {
  return (
    <div className="w-full bg-white py-10 md:py-14 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="border-2 border-gray-900 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center border-b-2 lg:border-b-0 lg:border-r-2 border-gray-900">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight google-sans">
                What is Drew?
              </h2>
              <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                Drew is a platform where you can transform your ideas into a full fledged architecture and can collaborate with others too :)
              </p>
            </div>

            <div className="relative bg-gray-50 aspect-video lg:aspect-auto min-h-[200px] lg:min-h-[280px]">
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
